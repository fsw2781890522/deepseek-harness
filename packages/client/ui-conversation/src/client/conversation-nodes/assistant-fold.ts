import type {
  AssistantBlock, AssistantMessageNode, ConversationLocation, ConversationMatch,
  ConversationNodeContext, ConversationNodeDefinition,
} from '@deepseek-ai/dsh-client-runtime/client'
import {
  emptyAssistantBlock, isAppendSurfaceEvent, isTokenDelta, toAssistantBlock, toAssistantBlocks,
} from '@deepseek-ai/dsh-client-runtime/client'
import { CHAT_SYNTHETIC_SEQ_OFFSETS } from './common.ts'

/** Shared Assistant step fold used by the reply and reasoning Chat Definitions. */
export interface AssistantState {
  readonly turn: number
  readonly step: number
  readonly blocks: readonly (AssistantBlock | undefined)[]
  readonly firstReplySeq: number | undefined
  readonly firstReplyTime: number | undefined
  readonly firstReasoningSeq: number | undefined
  readonly firstReasoningTime: number | undefined
  readonly lastReasoningTime: number | undefined
  readonly firstTokenTime: number | undefined
  readonly hidden: boolean
  readonly reasoningHidden: boolean
  readonly final: ConversationMatch | undefined
  readonly usage: unknown
}

/**
 * Open one Assistant step fold.
 * @param turn - owning turn number.
 * @param step - owning step number.
 * @returns empty step state.
 */
export function initialAssistantState(turn: number, step: number): AssistantState {
  return {
    turn,
    step,
    blocks: [],
    firstReplySeq: undefined,
    firstReplyTime: undefined,
    firstReasoningSeq: undefined,
    firstReasoningTime: undefined,
    lastReasoningTime: undefined,
    firstTokenTime: undefined,
    hidden: false,
    reasoningHidden: false,
    final: undefined,
    usage: undefined,
  }
}

/**
 * Compact sparse streamed blocks into a dense list.
 * @param blocks - index-addressed streamed blocks.
 * @returns defined blocks in index order.
 */
export function compactBlocks(blocks: readonly (AssistantBlock | undefined)[]): AssistantBlock[] {
  return blocks.filter((block): block is AssistantBlock => block !== undefined)
}

/**
 * Test whether blocks carry user-visible reply material (not Think or Tool heads).
 * @param blocks - dense Assistant blocks.
 * @returns whether a reply row should materialize.
 */
export function hasReplyContent(blocks: readonly AssistantBlock[]): boolean {
  return blocks.some((block) => {
    if (block.kind === 'tool-call' || block.kind === 'reasoning') return false
    if (block.kind === 'text') return block.text.trim() !== ''
    return true
  })
}

/**
 * Test whether blocks carry non-empty reasoning.
 * @param blocks - dense Assistant blocks.
 * @returns whether a Think row should materialize.
 */
export function hasReasoningContent(blocks: readonly AssistantBlock[]): boolean {
  return blocks.some(block => block.kind === 'reasoning' && block.text.trim() !== '')
}

/**
 * Collect reasoning blocks that still have text.
 * @param blocks - dense Assistant blocks.
 * @returns reasoning blocks with non-empty text.
 */
export function reasoningBlocks(
  blocks: readonly AssistantBlock[],
): Extract<AssistantBlock, { kind: 'reasoning' }>[] {
  return blocks.filter(
    (block): block is Extract<AssistantBlock, { kind: 'reasoning' }> =>
      block.kind === 'reasoning' && block.text.trim() !== '',
  )
}

function hasToolHeads(blocks: readonly AssistantBlock[]): boolean {
  return blocks.some(block => block.kind === 'tool-call')
}

function hasInterruptionEvidence(blocks: readonly AssistantBlock[]): boolean {
  return hasReplyContent(blocks) || hasReasoningContent(blocks) || hasToolHeads(blocks)
}

/**
 * Whether an interrupted Assistant step still owns a reply row.
 * @param blocks - dense Assistant blocks.
 * @param interrupted - whether the step froze without a final message.
 * @returns whether the reply Node should stay visible.
 */
export function hasInterruptedReply(blocks: readonly AssistantBlock[], interrupted: boolean): boolean {
  return hasReplyContent(blocks) || (interrupted && hasToolHeads(blocks))
}

/**
 * Route one Assistant lifecycle event to its per-step identity.
 * @param event - raw Session event.
 * @returns start or update match, otherwise null.
 */
export function matchAssistantLifecycle(
  event: Parameters<ConversationNodeDefinition['match']>[0],
): { id: string; role: 'start' | 'update' } | null {
  if (event.type === 'step/start') return { id: `${event.data.turn}:${event.data.step}`, role: 'start' }
  if (event.type === 'assistant/chunk'
    || (event.type === 'assistant/message' && isAppendSurfaceEvent(event))) {
    return { id: `${event.data.turn}:${event.data.step}`, role: 'update' }
  }
  if (event.type === 'llm/retry') {
    return { id: `${event.data.turn}:${event.data.step}`, role: 'update' }
  }
  return null
}

/**
 * Publication cadence for one Assistant lifecycle match.
 * @param match - routed Assistant match.
 * @returns engine publication request.
 */
export function assistantPublication(
  match: ConversationMatch,
): 'none' | 'immediate' | 'animation-frame' {
  if (match.event.type === 'step/start') return 'none'
  if (match.event.type !== 'assistant/chunk') return 'immediate'
  const type = match.event.data.chunk.type
  return type === 'usage' || type === 'finish' ? 'none' : 'animation-frame'
}

function resetForRetry(state: AssistantState): AssistantState {
  return {
    ...initialAssistantState(state.turn, state.step),
    firstTokenTime: state.firstTokenTime,
    hidden: true,
    reasoningHidden: true,
  }
}

function stampLaneTimes(
  state: AssistantState,
  seq: number,
  time: number,
  blocks: readonly AssistantBlock[],
): Pick<
  AssistantState,
  | 'firstReplySeq' | 'firstReplyTime'
  | 'firstReasoningSeq' | 'firstReasoningTime' | 'lastReasoningTime'
  | 'hidden' | 'reasoningHidden'
> {
  const reply = hasReplyContent(blocks)
  const reasoning = hasReasoningContent(blocks)
  return {
    firstReplySeq: state.firstReplySeq ?? (reply ? seq : undefined),
    firstReplyTime: state.firstReplyTime ?? (reply ? time : undefined),
    firstReasoningSeq: state.firstReasoningSeq ?? (reasoning ? seq : undefined),
    firstReasoningTime: state.firstReasoningTime ?? (reasoning ? time : undefined),
    lastReasoningTime: state.lastReasoningTime ?? (reasoning ? time : undefined),
    hidden: reply ? false : state.hidden,
    reasoningHidden: reasoning ? false : state.reasoningHidden,
  }
}

function updateChunk(state: AssistantState, match: ConversationMatch): AssistantState {
  if (match.event.type !== 'assistant/chunk') return state
  const chunk = match.event.data.chunk
  const blocks = [...state.blocks]
  switch (chunk.type) {
    case 'block-start':
      blocks[chunk.index] = emptyAssistantBlock(chunk.blockType)
      break
    case 'text-delta': {
      const previous = blocks[chunk.index]
      blocks[chunk.index] = { kind: 'text', text: (previous?.kind === 'text' ? previous.text : '') + chunk.text }
      break
    }
    case 'reasoning-delta': {
      const previous = blocks[chunk.index]
      blocks[chunk.index] = { kind: 'reasoning', text: (previous?.kind === 'reasoning' ? previous.text : '') + chunk.text }
      break
    }
    case 'tool-call-delta': {
      const previous = blocks[chunk.index]
      const base = previous?.kind === 'tool-call'
        ? previous
        : { kind: 'tool-call' as const, callId: '', name: '', argsRaw: '' }
      blocks[chunk.index] = {
        kind: 'tool-call',
        callId: base.callId || String(chunk.id),
        name: chunk.name ?? base.name,
        argsRaw: base.argsRaw + chunk.argumentsDelta,
      }
      break
    }
    case 'block-end':
      blocks[chunk.index] = toAssistantBlock(chunk.block)
      break
    case 'usage':
      return { ...state, usage: chunk.usage }
    default:
      return state
  }
  const dense = compactBlocks(blocks)
  const firstToken = isTokenDelta(chunk)
  const reasoningDelta = chunk.type === 'reasoning-delta' || (
    chunk.type === 'block-end' && chunk.block.type === 'reasoning'
  )
  return {
    ...state,
    blocks,
    ...stampLaneTimes(state, match.event.seq, match.event.time, dense),
    ...reasoningDelta ? { lastReasoningTime: match.event.time } : {},
    ...firstToken && state.firstTokenTime === undefined
      ? { firstTokenTime: match.event.time }
      : {},
  }
}

/**
 * Fold one post-start Assistant match into step state.
 * @param state - current step state.
 * @param match - routed update.
 * @returns next step state.
 */
export function updateAssistantState(state: AssistantState, match: ConversationMatch): AssistantState {
  if (match.event.type === 'assistant/chunk') return updateChunk(state, match)
  if (match.event.type === 'assistant/message') {
    const blocks = toAssistantBlocks(match.event.data.message.content)
    return {
      ...state,
      blocks,
      final: match,
      usage: match.event.data.usage,
      ...stampLaneTimes(state, match.event.seq, match.event.time, blocks),
    }
  }
  if (match.event.type === 'llm/retry') return resetForRetry(state)
  return state
}

function closedBoundary(location: ConversationLocation): { seq: number; time: number } | undefined {
  if (location.kind === 'step' && location.step.status === 'closed' && location.step.end !== undefined) {
    return location.step.end
  }
  if ((location.kind === 'step' || location.kind === 'turn')
    && location.turn.status === 'closed' && location.turn.end !== undefined) {
    return location.turn.end
  }
  return undefined
}

/**
 * Build the finalized or interruption-frozen Assistant message for one step.
 * @param state - current step state.
 * @param context - owning Context.
 * @returns presentation message, or undefined while the step is still open without interruption evidence.
 */
export function finalAssistantNode(
  state: AssistantState,
  context: ConversationNodeContext<AssistantState>,
): AssistantMessageNode | undefined {
  const final = state.final
  if (final?.event.type === 'assistant/message') {
    const event = final.event
    return {
      kind: 'assistant',
      seq: event.seq,
      messageId: event.data.message.id,
      time: event.time,
      turn: state.turn,
      step: state.step,
      blocks: toAssistantBlocks(event.data.message.content),
      usage: event.data.usage,
      timing: {
        stepStartTime: context.start?.event.time ?? null,
        firstTokenTime: state.firstTokenTime ?? null,
        completedTime: event.time,
      },
      ...event.data.interrupted === true ? { interrupted: true } : {},
    }
  }
  const location = context.start?.location ?? context.matches.at(-1)?.location
  const boundary = location === undefined ? undefined : closedBoundary(location)
  const blocks = compactBlocks(state.blocks)
  if (boundary === undefined || !hasInterruptionEvidence(blocks)) return undefined
  return {
    kind: 'assistant',
    seq: boundary.seq + CHAT_SYNTHETIC_SEQ_OFFSETS.interruptedAssistant,
    time: boundary.time,
    turn: state.turn,
    step: state.step,
    blocks,
    interrupted: true,
  }
}

/**
 * Rebuild step state from loaded matches when the live fold is absent.
 * @param context - owning Context.
 * @returns reconstructed state, or undefined when no Assistant evidence is loaded.
 */
export function fallbackAssistantState(
  context: ConversationNodeContext<AssistantState>,
): AssistantState | undefined {
  let state: AssistantState | undefined
  for (const match of context.matches) {
    if (match.event.type === 'assistant/chunk') {
      state ??= initialAssistantState(match.event.data.turn, match.event.data.step)
      state = updateChunk(state, match)
      continue
    }
    if (match.event.type === 'assistant/message') {
      state ??= initialAssistantState(match.event.data.turn, match.event.data.step)
      state = updateAssistantState(state, match)
      continue
    }
    if (match.event.type === 'llm/retry' && state !== undefined) {
      state = resetForRetry(state)
    }
  }
  return state
}

/**
 * Keep a previously materialized Chat Node as hidden instead of withdrawing it.
 * @param context - owning Context.
 * @param hidden - retry-hidden flag for this row.
 * @param projected - whether this row currently has content.
 * @returns whether buildViewNode must return a hidden Node.
 */
export function retainHiddenAssistantNode(
  context: ConversationNodeContext<AssistantState>,
  hidden: boolean,
  projected: { readonly visible: boolean; readonly settled: AssistantMessageNode | undefined },
): boolean {
  if (projected.settled !== undefined || projected.visible) return false
  const current = context.current.get('chat')
  return hidden && current !== undefined && current !== null
}

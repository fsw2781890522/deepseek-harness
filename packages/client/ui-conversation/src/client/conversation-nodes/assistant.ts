import type { Context } from '@deepseek-ai/cordis'
import type {
  AssistantMessageNode, ConversationNodeContext, ConversationNodeDefinition,
} from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-llm-retry/types'
import type { AssistantChatData } from '../contract/chat-nodes.ts'
import {
  assistantPublication, compactBlocks, fallbackAssistantState, finalAssistantNode,
  hasInterruptedReply, initialAssistantState, matchAssistantLifecycle,
  retainHiddenAssistantNode, updateAssistantState, type AssistantState,
} from './assistant-fold.ts'
import { chatNode } from './common.ts'

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ChatNodeDataMap {
    /** Streaming, settled, or interrupted Assistant reply. */
    'assistant-step': AssistantChatData
  }
}

declare module '@deepseek-ai/dsh-client-runtime/client' {
  interface ConversationStepDataMap {
    /** Streaming, settled, or interrupted Assistant material for this Step. */
    'assistant-step': AssistantChatData
  }
}

interface AssistantProjection {
  readonly data: AssistantChatData
  readonly anchorSeq: number
  readonly visible: boolean
  readonly settled: AssistantMessageNode | undefined
}

function projectAssistant(context: ConversationNodeContext<AssistantState>): AssistantProjection | undefined {
  const state = context.state ?? fallbackAssistantState(context)
  if (state === undefined) return undefined
  const settled = finalAssistantNode(state, context)
  const blocks = settled?.blocks ?? compactBlocks(state.blocks)
  const interrupted = settled?.interrupted === true
  const visible = hasInterruptedReply(blocks, interrupted)
  const status = interrupted
    ? 'interrupted'
    : settled === undefined ? 'running' : 'settled'
  const anchorSeq = state.firstReplySeq ?? settled?.seq ?? context.matches[0]?.event.seq ?? 0
  const time = state.firstReplyTime ?? settled?.time ?? context.matches[0]?.event.time ?? 0
  return {
    anchorSeq,
    visible,
    settled,
    data: {
      status,
      turn: state.turn,
      step: state.step,
      blocks,
      time,
      ...state.usage === undefined ? {} : { usage: state.usage },
      ...settled === undefined ? {} : { finalNode: settled },
    },
  }
}

/** Per-step Assistant reply Definition. Think rows are a sibling `assistant-reasoning` Context. */
export const assistantDefinition: ConversationNodeDefinition<AssistantState> = {
  kind: 'assistant-step',
  target: 'chat',
  match: matchAssistantLifecycle,
  start: (_context, match) => {
    if (match.event.type !== 'step/start') throw new Error('assistant-step start requires step/start')
    return initialAssistantState(match.event.data.turn, match.event.data.step)
  },
  update: (context, match) => updateAssistantState(context.state, match),
  publication: assistantPublication,
  buildLocationData: (context, scope) => {
    if (scope !== 'step') return null
    const projected = projectAssistant(context)
    if (projected === undefined) return null
    return {
      kind: 'step',
      turn: projected.data.turn,
      step: projected.data.step,
      key: 'assistant-step',
      value: projected.data,
    }
  },
  buildViewNode: (context) => {
    const projected = projectAssistant(context)
    if (projected === undefined) return null
    const state = context.state ?? fallbackAssistantState(context)
    if (state === undefined) return null
    if (!projected.visible
      && projected.settled === undefined
      && !retainHiddenAssistantNode(context, state.hidden, projected)) {
      return null
    }
    return chatNode(context, 'assistant-step', projected.anchorSeq, projected.data, {
      visibility: projected.visible ? 'visible' : 'hidden',
    })
  },
}

/**
 * Register the Assistant reply business contribution.
 * @param ctx - owning UI Conversation context.
 */
export function registerAssistantConversationNode(ctx: Context): void {
  ctx.conversationEvents.register(assistantDefinition)
}

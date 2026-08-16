import type { Context } from '@deepseek-ai/cordis'
import type {
  ConversationNodeContext, ConversationNodeDefinition,
} from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-llm-retry/types'
import type { AssistantReasoningChatData } from '../contract/chat-nodes.ts'
import {
  assistantPublication, compactBlocks, fallbackAssistantState, finalAssistantNode,
  hasReasoningContent, initialAssistantState, matchAssistantLifecycle, reasoningBlocks,
  retainHiddenAssistantNode, updateAssistantState, type AssistantState,
} from './assistant-fold.ts'
import { CHAT_SYNTHETIC_SEQ_OFFSETS, chatNode } from './common.ts'

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ChatNodeDataMap {
    /** Per-step Think row extracted from the Assistant lifecycle. */
    'assistant-reasoning': AssistantReasoningChatData
  }
}

interface ReasoningProjection {
  readonly data: AssistantReasoningChatData
  readonly anchorSeq: number
  readonly visible: boolean
}

function projectReasoning(
  context: ConversationNodeContext<AssistantState>,
): ReasoningProjection | undefined {
  const state = context.state ?? fallbackAssistantState(context)
  if (state === undefined) return undefined
  const settled = finalAssistantNode(state, context)
  const blocks = reasoningBlocks(settled?.blocks ?? compactBlocks(state.blocks))
  const visible = hasReasoningContent(blocks)
  const interrupted = settled?.interrupted === true
  const replyStarted = state.firstReplySeq !== undefined
  const status = interrupted
    ? 'interrupted' as const
    : settled !== undefined || replyStarted ? 'settled' as const : 'running' as const
  const startTime = state.firstReasoningTime
    ?? context.start?.event.time
    ?? context.matches[0]?.event.time
    ?? 0
  const endTime = state.lastReasoningTime ?? startTime
  const anchorSeq = state.firstReasoningSeq
    ?? (settled === undefined ? context.matches[0]?.event.seq ?? 0 : settled.seq + CHAT_SYNTHETIC_SEQ_OFFSETS.reasoningBeforeReply)
  return {
    anchorSeq,
    visible,
    data: {
      status,
      turn: state.turn,
      step: state.step,
      blocks,
      time: startTime,
      startTime,
      endTime,
    },
  }
}

/** Per-step Think Definition. Shares the Assistant fold; publishes only reasoning rows. */
export const assistantReasoningDefinition: ConversationNodeDefinition<AssistantState> = {
  kind: 'assistant-reasoning',
  target: 'chat',
  match: matchAssistantLifecycle,
  start: (_context, match) => {
    if (match.event.type !== 'step/start') {
      throw new Error('assistant-reasoning start requires step/start')
    }
    return initialAssistantState(match.event.data.turn, match.event.data.step)
  },
  update: (context, match) => updateAssistantState(context.state, match),
  publication: assistantPublication,
  buildViewNode: (context) => {
    const projected = projectReasoning(context)
    if (projected === undefined) return null
    const state = context.state ?? fallbackAssistantState(context)
    if (state === undefined) return null
    if (!retainHiddenAssistantNode(context, state.reasoningHidden, {
      visible: projected.visible,
      settled: undefined,
    }) && !projected.visible) {
      return null
    }
    return chatNode(context, 'assistant-reasoning', projected.anchorSeq, projected.data, {
      visibility: projected.visible ? 'visible' : 'hidden',
    })
  },
}

/**
 * Register the Assistant Think-row business contribution.
 * @param ctx - owning UI Conversation context.
 */
export function registerAssistantReasoningConversationNode(ctx: Context): void {
  ctx.conversationEvents.register(assistantReasoningDefinition)
}

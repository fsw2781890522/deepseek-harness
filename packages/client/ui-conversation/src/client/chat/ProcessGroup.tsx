import { DisclosureRow, IconCheckOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import { memo, useCallback, useState } from 'react'
import type { ChatConversationViewNode } from '@deepseek-ai/dsh-client-runtime/client'
import type { AssistantReasoningChatData, ToolChatData } from '../contract/chat-nodes.ts'
import type { ChatNodeOwnerProps, ChatViewSlotProps } from '../contract/slots.ts'
import { ChatNodeSeat } from './ChatNodeSeat.tsx'
import { formatProcessDuration } from './message-chrome.ts'
import css from './ProcessGroup.module.css'

interface ProcessGroupProps extends ChatNodeOwnerProps {
  readonly keys: readonly string[]
  readonly useSession: ChatViewSlotProps['useSession']
  readonly renderSlot: ChatViewSlotProps['renderSlot']
  readonly t: ChatViewSlotProps['t']
}

function processSpan(node: ChatConversationViewNode | undefined): { start: number; end: number } | undefined {
  if (node === undefined) return undefined
  if (node.kind === 'assistant-reasoning') {
    const data = node.data as AssistantReasoningChatData
    return { start: data.startTime, end: data.endTime }
  }
  if (node.kind === 'tool-call') {
    const root = (node.data as ToolChatData).root
    if ('kind' in root) {
      return { start: root.callTime ?? root.time, end: root.time }
    }
    return { start: root.time, end: root.time }
  }
  return undefined
}

/** Collapsible Chat process run: Think, Tool, and workflow rows. */
export const ProcessGroup = memo(function ProcessGroup({
  keys, useSession, selectedCallId, cwd, openFile, inspectCall, forkAt,
  loadImage, fileMentions, renderSlot, t,
}: ProcessGroupProps) {
  const [open, setOpen] = useState(false)
  const toggle = useCallback(() => {
    setOpen(current => !current)
  }, [])
  const duration = useSession((snapshot) => {
    let start = Number.POSITIVE_INFINITY
    let end = 0
    for (const key of keys) {
      const span = processSpan(snapshot.chat.nodes.get(key))
      if (span === undefined) continue
      start = Math.min(start, span.start)
      end = Math.max(end, span.end)
    }
    return Number.isFinite(start) ? Math.max(0, end - start) : 0
  })
  const title = t('process.processed', { duration: formatProcessDuration(duration) })
  // Collapsed groups unmount child seats; the wrapper is the paging row.
  const collapsedAnchor = !open ? keys[0] : undefined
  return (
    <div className={css.root} data-chat-anchor-key={collapsedAnchor} data-chat-process-group="">
      <DisclosureRow
        icon={<IconCheckOutline14 />}
        title={title}
        open={open}
        expandable
        expandOnRowClick
        onToggle={toggle}
      />
      {open && (
        <div className={css.body}>
          {keys.map(key => (
            <ChatNodeSeat
              key={key}
              nodeKey={key}
              selectedCallId={selectedCallId}
              cwd={cwd}
              openFile={openFile}
              inspectCall={inspectCall}
              forkAt={forkAt}
              loadImage={loadImage}
              fileMentions={fileMentions}
              useSession={useSession}
              renderSlot={renderSlot}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  )
})

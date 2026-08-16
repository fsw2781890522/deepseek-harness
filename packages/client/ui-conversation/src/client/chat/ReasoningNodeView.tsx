import { memo } from 'react'
import type { ChatNodeViewProps } from '../contract/slots.ts'
import { ReasoningRow } from './ReasoningRow.tsx'
import css from './ReasoningRow.module.css'

/** Per-step Think rows extracted from the Assistant lifecycle. */
export const ReasoningNodeView = memo(function ReasoningNodeView({
  node, t,
}: ChatNodeViewProps<'assistant-reasoning'>) {
  const data = node.data
  const last = data.blocks.length - 1
  return (
    <div className={css.stack}>
      {data.blocks.map((block, index) => (
        <ReasoningRow
          key={index}
          text={block.text}
          running={data.status === 'running' && index === last}
          t={t}
        />
      ))}
      {data.status === 'interrupted' && (
        <span className={css.stopped}>{t('message.stopped')}</span>
      )}
    </div>
  )
})

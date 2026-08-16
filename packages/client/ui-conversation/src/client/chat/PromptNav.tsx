// Floating prompt minimap: round dots for loaded user messages, a Codex-style
// hover card, and click-to-jump. ChatView owns scroll targeting.

import { useCallback, useRef, useState } from 'react'
import type { ChatViewSlotProps } from '../contract/slots.ts'
import type { PromptNavItem } from './prompt-nav.ts'
import css from './PromptNav.module.css'

interface PromptNavProps {
  readonly items: readonly PromptNavItem[]
  readonly activeKey: string | null
  readonly onJump: (key: string) => void
  readonly t: ChatViewSlotProps['t']
}

interface PreviewPos {
  readonly key: string
  readonly x: number
  readonly y: number
}

/** Floating prompt dots; hidden until the session has at least two user rows. */
export function PromptNav({ items, activeKey, onJump, t }: PromptNavProps) {
  const [preview, setPreview] = useState<PreviewPos | null>(null)
  const triggers = useRef({ hover: false, focus: false })

  const show = useCallback((el: HTMLElement, key: string) => {
    const rect = el.getBoundingClientRect()
    const shell = el.closest<HTMLElement>('[data-chat-prompt-nav-shell]')
    const shellRect = shell?.getBoundingClientRect()
    if (shellRect === undefined) return
    setPreview({
      key,
      x: rect.right - shellRect.left + 10,
      y: rect.top - shellRect.top + rect.height / 2,
    })
  }, [])

  const hide = useCallback(() => {
    if (!triggers.current.hover && !triggers.current.focus) setPreview(null)
  }, [])

  if (items.length < 2) return null
  const previewItem = preview === null
    ? undefined
    : items.find(item => item.key === preview.key)

  return (
    <div className={css.slot} data-chat-prompt-nav-shell="">
      <nav className={css.nav} data-chat-prompt-nav="" aria-label={t('chat.promptNav')}>
        <div className={css.list}>
          {items.map(item => (
            <button
              key={item.key}
              type="button"
              className={css.tick}
              data-chat-prompt-key={item.key}
              data-active={item.key === activeKey ? '' : undefined}
              aria-current={item.key === activeKey ? 'location' : undefined}
              aria-label={item.ariaLabel}
              onMouseEnter={(event) => {
                triggers.current.hover = true
                show(event.currentTarget, item.key)
              }}
              onMouseLeave={() => {
                triggers.current.hover = false
                hide()
              }}
              onFocus={(event) => {
                triggers.current.focus = true
                show(event.currentTarget, item.key)
              }}
              onBlur={() => {
                triggers.current.focus = false
                hide()
              }}
              onClick={(event) => {
                onJump(item.key)
                // A pointer click may focus the button. Clear that focus after
                // jumping so the preview remains governed by pointer hover:
                // it stays visible over the dot and disappears on mouse leave.
                event.currentTarget.blur()
              }}
            />
          ))}
        </div>
      </nav>
      {preview !== null && previewItem !== undefined && (
        <div
          className={css.preview}
          role="tooltip"
          style={{ left: preview.x, top: preview.y }}
        >
          <div className={css.title}>{previewItem.title}</div>
          {previewItem.body !== '' && <div className={css.body}>{previewItem.body}</div>}
          {previewItem.attachment !== null && (
            <div className={css.attachment}>{previewItem.attachment}</div>
          )}
        </div>
      )}
    </div>
  )
}

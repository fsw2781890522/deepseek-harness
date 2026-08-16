// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { PromptNav } from '../src/client/chat/PromptNav.tsx'
import type { PromptNavItem } from '../src/client/chat/prompt-nav.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh)

const items: readonly PromptNavItem[] = [
  { key: 'u1', title: 'first prompt', body: 'details here', attachment: 'photo.png', ariaLabel: 'first prompt' },
  { key: 'u2', title: 'second', body: '', attachment: null, ariaLabel: 'second' },
]

describe('PromptNav', () => {
  it('renders one tick per prompt and jumps on click', () => {
    const onJump = vi.fn()
    const view = render(
      <PromptNav items={items} activeKey="u2" onJump={onJump} t={t} />,
    )
    const nav = view.getByRole('navigation', { name: '对话导航' })
    const ticks = nav.querySelectorAll('[data-chat-prompt-key]')
    expect(ticks).toHaveLength(2)
    expect(ticks[1]?.getAttribute('aria-current')).toBe('location')
    fireEvent.click(view.getByRole('button', { name: 'first prompt' }))
    expect(onJump).toHaveBeenCalledWith('u1')
  })

  it('shows a truncated preview card on hover', () => {
    const view = render(
      <PromptNav items={items} activeKey={null} onJump={() => {}} t={t} />,
    )
    fireEvent.mouseEnter(view.getByRole('button', { name: 'first prompt' }))
    const card = view.getByRole('tooltip')
    expect(card.textContent).toContain('first prompt')
    expect(card.textContent).toContain('details here')
    expect(card.textContent).toContain('photo.png')
    fireEvent.mouseLeave(view.getByRole('button', { name: 'first prompt' }))
    expect(view.queryByRole('tooltip')).toBeNull()
  })

  it('shows the preview card on keyboard focus', () => {
    const view = render(
      <PromptNav items={items} activeKey={null} onJump={() => {}} t={t} />,
    )
    fireEvent.focus(view.getByRole('button', { name: 'second' }))
    expect(view.getByRole('tooltip').textContent).toContain('second')
    fireEvent.blur(view.getByRole('button', { name: 'second' }))
    expect(view.queryByRole('tooltip')).toBeNull()
  })

  it('hides itself when there are no user prompts', () => {
    const view = render(
      <PromptNav items={[]} activeKey={null} onJump={() => {}} t={t} />,
    )
    expect(view.queryByRole('navigation')).toBeNull()
  })
})

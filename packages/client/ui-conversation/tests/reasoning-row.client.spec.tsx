// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { ReasoningNodeView } from '../src/client/chat/ReasoningNodeView.tsx'
import { ReasoningRow } from '../src/client/chat/ReasoningRow.tsx'
import { zh } from '../src/client/locales.ts'
import type { ChatNodeViewProps } from '../src/client/contract/slots.ts'

let nextAnimationFrameId = 1
let animationFrames = new Map<number, FrameRequestCallback>()

function flushAnimationFrames(count: number): void {
  for (let index = 0; index < count; index += 1) {
    const callbacks = [...animationFrames.values()]
    animationFrames.clear()
    for (const callback of callbacks) callback(index)
  }
}

beforeEach(() => {
  nextAnimationFrameId = 1
  animationFrames = new Map()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextAnimationFrameId
    nextAnimationFrameId += 1
    animationFrames.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    animationFrames.delete(id)
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const t = makeTranslate(zh, commonZh)

function reasoningNode(
  over: Partial<ChatNodeViewProps<'assistant-reasoning'>['node']['data']> = {},
): ChatNodeViewProps<'assistant-reasoning'> {
  return {
    node: {
      key: 'reasoning',
      kind: 'assistant-reasoning',
      id: '1:1',
      target: 'chat',
      anchorSeq: 1,
      location: { kind: 'session' },
      visibility: 'visible',
      data: {
        status: 'settled',
        turn: 1,
        step: 1,
        blocks: [{ kind: 'reasoning', text: 'Inspect the session\nCheck persistence' }],
        time: 1,
        startTime: 1,
        endTime: 2,
        ...over,
      },
    },
    t,
  } as ChatNodeViewProps<'assistant-reasoning'>
}

describe('ReasoningRow', () => {
  it('follows the latest streaming line, scrolls to its end, then restores the settled first line', () => {
    const view = render(
      <ReasoningRow t={t} text={'Inspect the session\nNewest reasoning tokens'} running />,
    )
    expect(view.getByText('运行中')).toBeTruthy()
    const summary = view.getByText('Newest reasoning tokens')
    Object.defineProperties(summary, {
      scrollWidth: { configurable: true, value: 300 },
      clientWidth: { configurable: true, value: 100 },
    })

    view.rerender(
      <ReasoningRow t={t} text={'Inspect the session\nNewest reasoning tokens keep arriving'} running />,
    )
    expect(summary.scrollLeft).toBe(0)
    flushAnimationFrames(2)
    expect(summary.scrollLeft).toBe(0)
    flushAnimationFrames(1)
    expect(summary.scrollLeft).toBe(200)
    expect(summary.getAttribute('data-follow-end')).toBe('true')

    view.rerender(
      <ReasoningRow t={t} text={'Inspect the session\nNewest reasoning tokens keep arriving\n'} running={false} />,
    )
    flushAnimationFrames(3)
    expect(view.getByText('Inspect the session')).toBeTruthy()
    expect(view.queryByText('运行中')).toBeNull()
    expect(summary.scrollLeft).toBe(0)
    expect(summary.hasAttribute('data-follow-end')).toBe(false)
  })

  it('expands from either Think or the reasoning summary', () => {
    const view = render(
      <ReasoningRow t={t} text={'Inspect the session\nCheck persistence'} running={false} />,
    )
    const row = view.getByRole('button')

    fireEvent.click(view.getByText('Inspect the session'))
    expect(row.getAttribute('aria-expanded')).toBe('true')
    expect(view.getByText(/Check persistence/)).toBeTruthy()

    fireEvent.click(view.getByText('Think'))
    expect(row.getAttribute('aria-expanded')).toBe('false')
  })

  it('expanded Think drops the inline summary and renders plain prose, no IN card', () => {
    const view = render(
      <ReasoningRow t={t} text={'Inspect the session\nCheck persistence'} running={false} />,
    )
    fireEvent.click(view.getByText('Think'))
    expect(view.getAllByText(/Inspect the session/)).toHaveLength(1)
    expect(view.queryByText('IN')).toBeNull()
    expect(view.container.querySelector('[class*="ioCard"]')).toBeNull()
    expect(view.container.querySelector('[class*="thinkBody"]')).not.toBeNull()
  })

  it('single-line reasoning summary skips the newline cut', () => {
    const view = render(<ReasoningRow t={t} text="one-liner" running={false} />)
    expect(view.getByText('one-liner')).toBeTruthy()
  })
})

describe('ReasoningNodeView', () => {
  it('renders each reasoning block and marks interruption', () => {
    const view = render(
      <ReasoningNodeView
        {...reasoningNode({
          status: 'interrupted',
          blocks: [
            { kind: 'reasoning', text: 'first block' },
            { kind: 'reasoning', text: 'second block' },
          ],
        })}
      />,
    )
    expect(view.getAllByText('Think')).toHaveLength(2)
    expect(view.getByText('first block')).toBeTruthy()
    expect(view.getByText('second block')).toBeTruthy()
    expect(view.getByText('已停止')).toBeTruthy()
  })

  it('marks only the last block as running', () => {
    const view = render(
      <ReasoningNodeView
        {...reasoningNode({
          status: 'running',
          blocks: [
            { kind: 'reasoning', text: 'done thinking' },
            { kind: 'reasoning', text: 'still thinking' },
          ],
        })}
      />,
    )
    expect(view.container.querySelector('[data-state="ok"]')).not.toBeNull()
    expect(view.container.querySelector('[data-state="running"]')).not.toBeNull()
  })
})

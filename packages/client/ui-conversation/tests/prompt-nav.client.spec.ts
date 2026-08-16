import { describe, expect, it } from 'vitest'
import {
  clipPromptAriaLabel,
  promptNavItems,
  resolveActivePromptKey,
  splitPromptPreview,
} from '../src/client/chat/prompt-nav.ts'

const copy = {
  empty: '（无文本）',
  image: '图片',
  images: (count: number) => `${count} 张图片`,
}

describe('splitPromptPreview', () => {
  it('uses the first line as the title and the rest as the body', () => {
    expect(splitPromptPreview('  title\n\nbody line\nmore  ')).toEqual({
      title: 'title',
      body: 'body line\nmore',
    })
  })

  it('leaves the body empty for a single line', () => {
    expect(splitPromptPreview('just one line')).toEqual({
      title: 'just one line',
      body: '',
    })
  })

  it('returns empty strings for whitespace', () => {
    expect(splitPromptPreview('  \n  ')).toEqual({ title: '', body: '' })
  })
})

describe('clipPromptAriaLabel', () => {
  it('keeps short titles intact', () => {
    expect(clipPromptAriaLabel('hello')).toBe('hello')
  })

  it('clips long titles to one accessible-name line', () => {
    const title = '字'.repeat(80)
    const clipped = clipPromptAriaLabel(title)
    expect(clipped.endsWith('…')).toBe(true)
    expect(clipped.length).toBe(65)
  })
})

describe('promptNavItems', () => {
  const nodeOf = (nodes: Record<string, { kind: string; data: unknown }>) =>
    (key: string) => nodes[key]

  it('lists only user Nodes in order', () => {
    const items = promptNavItems(
      ['u1', 'a', 'steer', 'u2'],
      nodeOf({
        u1: { kind: 'user', data: { content: [{ type: 'text', text: 'first' }] } },
        a: { kind: 'assistant-step', data: {} },
        steer: { kind: 'steering', data: { content: [{ type: 'text', text: 'steer' }] } },
        u2: { kind: 'user', data: { content: [{ type: 'text', text: 'second\nmore' }] } },
      }),
      copy,
    )
    expect(items).toEqual([
      { key: 'u1', title: 'first', body: '', attachment: null, ariaLabel: 'first' },
      { key: 'u2', title: 'second', body: 'more', attachment: null, ariaLabel: 'second' },
    ])
  })

  it('uses the image name as the title when the prompt has no text', () => {
    const items = promptNavItems(
      ['u'],
      nodeOf({
        u: {
          kind: 'user',
          data: {
            content: [{
              type: 'image',
              attachment: { name: 'photo.png' },
            }],
          },
        },
      }),
      copy,
    )
    expect(items).toEqual([
      { key: 'u', title: 'photo.png', body: '', attachment: null, ariaLabel: 'photo.png' },
    ])
  })

  it('appends an image attachment line when the prompt has text', () => {
    const items = promptNavItems(
      ['u'],
      nodeOf({
        u: {
          kind: 'user',
          data: {
            content: [
              { type: 'text', text: 'look' },
              { type: 'image', attachment: { name: 'a.png' } },
              { type: 'image', attachment: {} },
            ],
          },
        },
      }),
      copy,
    )
    expect(items[0]?.attachment).toBe('2 张图片')
    expect(items[0]?.title).toBe('look')
  })

  it('falls back to empty copy when the user row has no text or images', () => {
    const items = promptNavItems(
      ['missing', 'u'],
      nodeOf({
        u: { kind: 'user', data: { content: [] } },
      }),
      copy,
    )
    expect(items).toEqual([
      { key: 'u', title: '（无文本）', body: '', attachment: null, ariaLabel: '（无文本）' },
    ])
  })
})

describe('resolveActivePromptKey', () => {
  it('returns null for an empty list', () => {
    expect(resolveActivePromptKey([], () => 0, 10)).toBeNull()
  })

  it('picks the last prompt at or above the probe, skipping unmounted rows', () => {
    const tops: Record<string, number | null> = { a: 0, b: null, c: 40, d: 80 }
    expect(resolveActivePromptKey(['a', 'b', 'c', 'd'], key => tops[key] ?? null, 45)).toBe('c')
  })

  it('falls back to the first listed key when every row sits below the probe', () => {
    expect(resolveActivePromptKey(['a', 'b'], () => 100, 10)).toBe('a')
  })
})

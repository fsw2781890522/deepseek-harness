/** PromptNav layout contract: the minimap stays visibly outside the chat column. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  fileURLToPath(new URL('../src/client/chat/PromptNav.module.css', import.meta.url)),
  'utf8',
)
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ')

function declarations(selector: string): Map<string, string> {
  for (const [, selectorList = '', body = ''] of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectorList.split(',').map(value => value.trim()).includes(selector)) continue
    const found = new Map<string, string>()
    for (const part of body.split(';')) {
      const colon = part.indexOf(':')
      if (colon === -1) continue
      const value = part.slice(colon + 1).trim().replace(/\s+/g, ' ')
        .replace(/\(\s+/g, '(')
        .replace(/\s+\)/g, ')')
      found.set(part.slice(0, colon).trim(), value)
    }
    return found
  }
  throw new Error(`PromptNav.module.css has no \`${selector}\` rule`)
}

describe('PromptNav.module.css layout', () => {
  it('keeps the minimap in the left gutter with a bounded transcript gap', () => {
    expect(declarations('.slot').get('--dsh-prompt-nav-offset')).toBe(
      'clamp(20px, calc((100% - var(--dsh-chat-content-width)) / 2), 64px)',
    )
    expect(declarations('.nav').get('margin-left')).toBe(
      'calc(-1 * var(--dsh-prompt-nav-offset))',
    )
  })
})

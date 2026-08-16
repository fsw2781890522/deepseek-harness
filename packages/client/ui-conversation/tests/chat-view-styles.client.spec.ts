import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/client/chat/ChatView.module.css', import.meta.url)), 'utf8')

function declarations(selector: string): Map<string, string> | undefined {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
  for (const [, selectorList = '', body = ''] of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectorList.split(',').map(value => value.trim()).includes(selector)) continue
    const found = new Map<string, string>()
    for (const part of body.split(';')) {
      const colon = part.indexOf(':')
      if (colon === -1) continue
      found.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim().replace(/\s+/g, ' '))
    }
    return found
  }
  return undefined
}

describe('ChatView history loading styles', () => {
  it('centers the history status and gives it readable emphasis', () => {
    const loading = declarations('.historyLoading')
    expect(loading?.get('position')).toBe('absolute')
    expect(loading?.get('top')).toBe('50%')
    expect(loading?.get('left')).toBe('50%')
    expect(loading?.get('font-size')).toBe('16px')
    expect(loading?.get('line-height')).toBe('24px')
  })
})

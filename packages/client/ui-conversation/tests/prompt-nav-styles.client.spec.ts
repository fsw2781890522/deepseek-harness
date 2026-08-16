/** PromptNav layout contract: the minimap is an independent, theme-aware rail. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  fileURLToPath(new URL('../src/client/chat/PromptNav.module.css', import.meta.url)),
  'utf8',
)
const rootCss = readFileSync(
  fileURLToPath(new URL('../src/client/skeleton/ConversationRoot.module.css', import.meta.url)),
  'utf8',
)

function declarations(source: string, selector: string): Map<string, string> {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, ' ')
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
  it('uses an independent fixed capsule aligned to the conversation tab row', () => {
    const slot = declarations(css, '.slot')
    expect(slot.get('position')).toBe('fixed')
    expect(slot.get('top')).toBe('50%')
    expect(slot.get('left')).toBe(
      'calc(var(--dsh-sidebar-width, 280px) + var(--dsh-session-tab-center-x, 41px) - 14px)',
    )
    expect(slot.get('transform')).toBe('translateY(-50%)')
    expect(slot.get('border-radius')).toBe('999px')
    expect(slot.get('background')).toBe(
      'color-mix(in srgb, var(--dsw-alias-interactive-bg-hover-solid) 78%, transparent)',
    )
    expect(slot.get('border')).toContain('color-mix(')
    expect(slot.get('backdrop-filter')).toBe('blur(12px)')
    expect(slot.has('height')).toBe(false)
  })

  it('uses round dots with a larger active state and auto-sized list', () => {
    const list = declarations(css, '.list')
    const tick = declarations(css, '.tick::after')
    const active = declarations(css, '.tick[data-active]::after')
    expect(list.get('overflow-y')).toBe('auto')
    expect(list.get('max-height')).toBe('inherit')
    expect(tick.get('width')).toBe('6px')
    expect(tick.get('height')).toBe('6px')
    expect(tick.get('border-radius')).toBe('50%')
    expect(tick.get('background')).toBe('var(--dsw-alias-label-tertiary)')
    expect(active.get('width')).toBe('10px')
    expect(active.get('height')).toBe('10px')
  })

  it('keeps the preview in the shell coordinate system', () => {
    expect(declarations(css, '.preview').get('position')).toBe('absolute')
  })

  it('shares the tab horizontal center geometry from the conversation root', () => {
    expect(declarations(rootCss, '.root').get('--dsh-session-tab-center-x')).toBe(
      'calc(20px + 8px + 13px)',
    )
  })
})

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/Tooltip.module.css', import.meta.url)), 'utf8')

describe('Tooltip surface styles', () => {
  it('uses theme aliases so floating previews follow light and dark themes', () => {
    const bubble = css.match(/\.bubble\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
    expect(bubble).toContain('background: var(--dsw-alias-bg-layer-2)')
    expect(bubble).toContain('border: 1px solid var(--dsw-alias-border-l2)')
    expect(bubble).toContain('color: var(--dsw-alias-label-primary)')
    expect(bubble).not.toContain('--dsw-alias-tooltip-bg')
    expect(bubble).not.toContain('--dsw-static-neutral-bluish-00')
  })
})

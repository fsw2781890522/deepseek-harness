/** AppFrame layering contracts for cross-column overlays. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/client/AppFrame.module.css', import.meta.url)), 'utf8')

describe('AppFrame.module.css', () => {
  it('owns the readable light/dark glass surface on the sidebar column', () => {
    const glass = new RegExp([
      String.raw`\.sidebarCol\s*\{`,
      String.raw`[\s\S]*?background: color-mix\(in srgb, var\(--dsw-specific-sidebar-fill\) 60%, transparent\);`,
      String.raw`[\s\S]*?-webkit-backdrop-filter: blur\(22px\) saturate\(120%\);`,
      String.raw`[\s\S]*?backdrop-filter: blur\(22px\) saturate\(120%\);`,
    ].join(''))
    expect(css).toMatch(
      glass,
    )
  })

  it('raises the sidebar stacking context while the settings dialog is open', () => {
    const elevated = new RegExp([
      String.raw`\.sidebarCol:has\(\[role=['"]dialog['"]\]\)\s*\{`,
      String.raw`[\s\S]*?position: relative;\s*z-index: 1001;`,
      String.raw`[\s\S]*?background: transparent;`,
      String.raw`[\s\S]*?-webkit-backdrop-filter: none;`,
      String.raw`[\s\S]*?backdrop-filter: none;`,
    ].join(''))
    expect(css).toMatch(
      elevated,
    )
  })
})

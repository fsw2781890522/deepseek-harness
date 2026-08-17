import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/client/SettingsRoot.module.css', import.meta.url)), 'utf8')

describe('SettingsRoot.module.css modal mask', () => {
  it('uses one tinted mask without a second backdrop-filter layer', () => {
    const maskRule = css.match(/\.mask\s*\{([^{}]*)\}/s)?.[1] ?? ''

    expect(maskRule).toContain('background: color-mix(in srgb, var(--dsw-alias-bg-base) 86%, transparent);')
    expect(maskRule).not.toContain('backdrop-filter:')
  })
})

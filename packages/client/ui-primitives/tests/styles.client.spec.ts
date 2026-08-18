/** Overlay stacking contracts for body-portaled primitives. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const modalCss = readFileSync(fileURLToPath(new URL('../src/Modal.module.css', import.meta.url)), 'utf8')
const menuCss = readFileSync(fileURLToPath(new URL('../src/Menu.module.css', import.meta.url)), 'utf8')

describe('Modal.module.css', () => {
  it('sits above the Settings sidebar stacking context and below Menu', () => {
    expect(modalCss).toMatch(/\.root\s*\{[\s\S]*?z-index:\s*1050;/)
    expect(menuCss).toMatch(/\.portal\s*\{[\s\S]*?z-index:\s*1100;/)
  })
})

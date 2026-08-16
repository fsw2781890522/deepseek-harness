import { describe, expect, it } from 'vitest'
import { configuredPresetRoots } from '../src/profile-boot.ts'

describe('desktop preset roots', () => {
  it('keeps the factory custom preset out of the shipped system root', () => {
    const roots = configuredPresetRoots()

    expect(roots).toHaveLength(2)
    expect(roots[0]).toMatchObject({ trust: 'system' })
    expect(roots[1]).toMatchObject({ trust: 'user' })
    expect(roots[1]?.path).toMatch(/agent-presets-custom[\\/]?$/)
  })
})

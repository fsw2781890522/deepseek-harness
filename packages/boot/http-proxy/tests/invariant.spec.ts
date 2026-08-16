import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import * as HttpProxyInvariant from '../src/invariant.ts'

describe('http-proxy invariant', () => {
  it('registers an empty companion and disposes with the fiber', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    const fiber = ctx.plugin(HttpProxyInvariant)
    await fiber.await()
    expect(HttpProxyInvariant.name).toBe('http-proxy-invariant')
    expect(HttpProxyInvariant.inject).toEqual(['invariants'])
    await fiber.dispose()
  })
})

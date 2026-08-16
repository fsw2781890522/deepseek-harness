import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SettingsProvider, settingsNamespace, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { apply, HTTP_PROXY_SETTINGS_NAMESPACE, name } from '../src/index.ts'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

class MemorySettings extends SettingsProvider {
  readonly writable = true
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve({}) }
  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
}

describe('http-proxy apply', () => {
  it('exports the loader name and wraps fetch without a settings provider', async () => {
    expect(name).toBe('http-proxy')
    const ctx = new Context()
    const fiber = ctx.plugin({ name, apply })
    await fiber.await()
    expect(globalThis.fetch).not.toBe(originalFetch)
    expect(ctx.get('tools')).toBeUndefined()
    await fiber.dispose()
    expect(globalThis.fetch).toBe(originalFetch)
  })

  it('rejects invalid composition config before wrapping fetch', () => {
    const ctx = new Context()
    expect(() => { apply(ctx, { port: 0 }) }).toThrow(/port must be an integer/)
    expect(() => { apply(ctx, { port: 'nope' as unknown as number }) }).toThrow(/port must be an integer/)
    expect(() => { apply(ctx, { directTimeoutMs: 0 }) }).toThrow(/directTimeoutMs must be a positive integer/)
    expect(() => { apply(ctx, { directTimeoutMs: 1.5 }) }).toThrow(/directTimeoutMs must be a positive integer/)
    expect(globalThis.fetch).toBe(originalFetch)
  })

  it('accepts an explicit composition port and timeout', async () => {
    const ctx = new Context()
    apply(ctx, { port: 8118, directTimeoutMs: 1_000 })
    expect(globalThis.fetch).not.toBe(originalFetch)
  })

  it('registers the settings namespace and reinstalls the wrapper on a live port change', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ name, apply })
    await fiber.await()
    const ns = settingsNamespace(HTTP_PROXY_SETTINGS_NAMESPACE)
    expect(ctx.settings.describe().map(row => row.ns)).toContain(ns)
    expect(ctx.settings.get(ns)).toEqual({ port: 7897 })
    const wrapped = globalThis.fetch
    await ctx.settings.update(ns, { port: 8118 })
    expect(ctx.settings.get(ns)).toEqual({ port: 8118 })
    expect(globalThis.fetch).not.toBe(wrapped)
    await ctx.settings.update(ns, { port: 8118 })
    await fiber.dispose()
    expect(ctx.settings.describe().map(row => row.ns)).not.toContain(ns)
    expect(globalThis.fetch).toBe(originalFetch)
  })
})

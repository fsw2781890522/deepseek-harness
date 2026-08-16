/** Desktop-shell bridge: absent in `dsh web`, present when Tauri injected it. */
import { describe, expect, it } from 'vitest'
import { desktopBridge, notesForDocument } from '../src/client/desktop-bridge.ts'

describe('desktopBridge', () => {
  it('returns null when the shell did not inject the object', () => {
    delete (globalThis as { __DSH_DESKTOP__?: unknown }).__DSH_DESKTOP__
    expect(desktopBridge()).toBeNull()
  })

  it('returns null when checkUpdate is not a function', () => {
    ;(globalThis as { __DSH_DESKTOP__?: unknown }).__DSH_DESKTOP__ = { version: '0.2.0' }
    expect(desktopBridge()).toBeNull()
    delete (globalThis as { __DSH_DESKTOP__?: unknown }).__DSH_DESKTOP__
  })

  it('returns the injected object when checkUpdate is callable', () => {
    const injected = {
      version: '0.2.0',
      checkUpdate: async () => ({ status: 'current' as const, current: '0.2.0' }),
      installUpdate: async () => {},
    }
    ;(globalThis as { __DSH_DESKTOP__?: unknown }).__DSH_DESKTOP__ = injected
    expect(desktopBridge()).toBe(injected)
    delete (globalThis as { __DSH_DESKTOP__?: unknown }).__DSH_DESKTOP__
  })
})

describe('notesForDocument', () => {
  it('uses Chinese when document is absent', () => {
    expect(notesForDocument({ zh: '中文说明', en: 'English notes' })).toBe('中文说明')
  })

  it('falls back to English when the Chinese notes are blank', () => {
    expect(notesForDocument({ zh: '  ', en: 'English notes' })).toBe('English notes')
  })
})

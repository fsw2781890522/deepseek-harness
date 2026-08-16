// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { DesktopUpdateRow } from '../src/client/DesktopUpdateRow.tsx'
import type { DesktopUpdateRowProps } from '../src/client/DesktopUpdateRow.tsx'
import { notesForDocument } from '../src/client/desktop-bridge.ts'
import type { DshDesktopBridge } from '../src/client/desktop-bridge.ts'
import { zh } from '../src/client/locales.ts'

afterEach(() => {
  cleanup()
  delete (globalThis as { __DSH_DESKTOP__?: unknown }).__DSH_DESKTOP__
})

const unusedHook = (() => { throw new Error('unused by the desktop update row') }) as never
const kit = { useSessions: unusedHook, useWorkspaces: unusedHook }
const t = makeTranslate(zh)

function mount() {
  const props: DesktopUpdateRowProps = { ...kit, t }
  return render(<DesktopUpdateRow {...props} />)
}

function installBridge(partial: Partial<DshDesktopBridge> & Pick<DshDesktopBridge, 'checkUpdate'>): DshDesktopBridge {
  const bridge: DshDesktopBridge = {
    version: '0.2.0',
    installUpdate: async () => {},
    ...partial,
  }
  ;(globalThis as { __DSH_DESKTOP__?: DshDesktopBridge }).__DSH_DESKTOP__ = bridge
  return bridge
}

describe('DesktopUpdateRow', () => {
  beforeEach(() => {
    document.documentElement.lang = 'zh-CN'
  })

  it('renders nothing without the desktop bridge', () => {
    const view = mount()
    expect(view.container.textContent).toBe('')
  })

  it('shows the current version and checks until the channel says current', async () => {
    const checkUpdate = vi.fn(async () => ({ status: 'current' as const, current: '0.2.0' }))
    installBridge({ checkUpdate })
    mount()
    expect(screen.getByText(/当前版本 0\.2\.0/)).toBeTruthy()
    expect(screen.getByText(/可检查是否有新的安装包/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '检查更新' }))
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '正在检查…' }).disabled).toBe(true)
    await waitFor(() => {
      expect(screen.getByText(/已是最新版本/)).toBeTruthy()
    })
    expect(checkUpdate).toHaveBeenCalledOnce()
  })

  it('shows notes and installs when a newer package is available', async () => {
    const checkUpdate = vi.fn(async () => ({
      status: 'available' as const,
      current: '0.2.0',
      latest: '0.2.1',
      notes: { zh: '修复启动闪屏', en: 'Fix the splash flash' },
      size: 12,
      kind: 'nsis' as const,
    }))
    const installUpdate = vi.fn(() => new Promise<void>(() => { /* the shell exits */ }))
    installBridge({ checkUpdate, installUpdate })
    mount()
    fireEvent.click(screen.getByRole('button', { name: '检查更新' }))
    await waitFor(() => {
      expect(screen.getByText(/发现新版本 0\.2\.1/)).toBeTruthy()
    })
    expect(screen.getByText('修复启动闪屏')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '立即更新' }))
    await waitFor(() => {
      expect(screen.getByRole<HTMLButtonElement>('button', { name: '正在安装…' }).disabled).toBe(true)
    })
    expect(installUpdate).toHaveBeenCalledOnce()
  })

  it('surfaces a channel failure from checkUpdate', async () => {
    installBridge({
      checkUpdate: async () => ({
        status: 'unavailable',
        current: '0.2.0',
        reason: 'manifest missing',
      }),
    })
    mount()
    fireEvent.click(screen.getByRole('button', { name: '检查更新' }))
    await waitFor(() => {
      expect(screen.getByText(/无法检查更新：manifest missing/)).toBeTruthy()
    })
  })

  it('turns a thrown Error into an unavailable result', async () => {
    installBridge({
      checkUpdate: async () => { throw new Error('network down') },
    })
    mount()
    fireEvent.click(screen.getByRole('button', { name: '检查更新' }))
    await waitFor(() => {
      expect(screen.getByText(/无法检查更新：network down/)).toBeTruthy()
    })
  })

  it('stringifies a non-Error check rejection', async () => {
    installBridge({
      checkUpdate: async () => { throw 'nope' },
    })
    mount()
    fireEvent.click(screen.getByRole('button', { name: '检查更新' }))
    await waitFor(() => {
      expect(screen.getByText(/无法检查更新：nope/)).toBeTruthy()
    })
  })

  it('turns a thrown Error from installUpdate into an unavailable result', async () => {
    installBridge({
      checkUpdate: async () => ({
        status: 'available' as const,
        current: '0.2.0',
        latest: '0.2.1',
        notes: { zh: '说明', en: 'notes' },
        size: 1,
        kind: 'nsis' as const,
      }),
      installUpdate: async () => { throw new Error('hash mismatch') },
    })
    mount()
    fireEvent.click(screen.getByRole('button', { name: '检查更新' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '立即更新' })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: '立即更新' }))
    await waitFor(() => {
      expect(screen.getByText(/无法检查更新：hash mismatch/)).toBeTruthy()
    })
  })

  it('stringifies a non-Error install rejection', async () => {
    installBridge({
      checkUpdate: async () => ({
        status: 'available' as const,
        current: '0.2.0',
        latest: '0.2.1',
        notes: { zh: '说明', en: 'notes' },
        size: 1,
        kind: 'nsis' as const,
      }),
      installUpdate: async () => { throw 7 },
    })
    mount()
    fireEvent.click(screen.getByRole('button', { name: '检查更新' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '立即更新' })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: '立即更新' }))
    await waitFor(() => {
      expect(screen.getByText(/无法检查更新：7/)).toBeTruthy()
    })
  })

  it('keeps the installing state when installUpdate resolves', async () => {
    let finish: (() => void) | undefined
    installBridge({
      checkUpdate: async () => ({
        status: 'available' as const,
        current: '0.2.0',
        latest: '0.2.1',
        notes: { zh: '说明', en: 'notes' },
        size: 1,
        kind: 'nsis' as const,
      }),
      installUpdate: () => new Promise<void>((resolve) => { finish = resolve }),
    })
    mount()
    fireEvent.click(screen.getByRole('button', { name: '检查更新' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '立即更新' })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: '立即更新' }))
    await waitFor(() => {
      expect(screen.getByRole<HTMLButtonElement>('button', { name: '正在安装…' }).disabled).toBe(true)
    })
    finish?.()
    await waitFor(() => {
      expect(screen.getByRole<HTMLButtonElement>('button', { name: '正在安装…' }).disabled).toBe(true)
    })
  })
})

describe('notesForDocument in a document', () => {
  it('picks Chinese when the document language is Chinese', () => {
    document.documentElement.lang = 'zh-CN'
    expect(notesForDocument({ zh: '中文', en: 'English' })).toBe('中文')
  })

  it('picks English when the document language is not Chinese', () => {
    document.documentElement.lang = 'en-US'
    expect(notesForDocument({ zh: '中文', en: 'English' })).toBe('English')
  })

  it('falls back to Chinese when the English notes are blank', () => {
    document.documentElement.lang = 'en'
    expect(notesForDocument({ zh: '中文', en: '  ' })).toBe('中文')
  })
})

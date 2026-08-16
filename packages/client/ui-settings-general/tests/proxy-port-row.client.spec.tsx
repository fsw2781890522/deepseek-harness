// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSnapshotStore, type SessionListState, type WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { ProxyPortRow } from '../src/client/ProxyPortRow.tsx'
import type { ProxyPortRowComponentProps } from '../src/client/ProxyPortRow.tsx'
import { createProxyPortStore } from '../src/client/proxy-port-store.ts'
import { parsePortDraft } from '../src/client/proxy-port.ts'
import { zh } from '../src/client/locales.ts'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'

afterEach(cleanup)

const t = makeTranslate(zh)

function emptySessions() {
  const store = createSnapshotStore<SessionListState>(
    { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined })
  return bindSnapshotSelector(store)
}
function emptyWorkspaces() {
  const store = createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  })
  return bindSnapshotSelector(store)
}

function mount(port = 7897, writable = true) {
  const store = createProxyPortStore().create()
  store.actions.sync(port, writable, 0)
  const setPort = vi.fn()
  const props: ProxyPortRowComponentProps = {
    useSessions: emptySessions(),
    useWorkspaces: emptyWorkspaces(),
    useStore: bindSnapshotSelector(store),
    actions: store.actions,
    t,
    setPort,
  }
  render(<ProxyPortRow {...props} />)
  return { store, setPort }
}

describe('parsePortDraft', () => {
  it('accepts 1–65535 and rejects the rest', () => {
    expect(parsePortDraft('7897')).toBe(7897)
    expect(parsePortDraft(' 1 ')).toBe(1)
    expect(parsePortDraft('65535')).toBe(65535)
    expect(parsePortDraft('0')).toBeUndefined()
    expect(parsePortDraft('65536')).toBeUndefined()
    expect(parsePortDraft('12.5')).toBeUndefined()
    expect(parsePortDraft('')).toBeUndefined()
    expect(parsePortDraft('abc')).toBeUndefined()
  })
})

describe('ProxyPortRow', () => {
  it('renders the title and current port', () => {
    mount(7897)
    expect(screen.getByText('代理端口')).toBeDefined()
    expect(screen.getByRole('textbox', { name: '代理端口' })).toHaveProperty('value', '7897')
  })

  it('commits a valid port on blur and Enter', () => {
    const { setPort } = mount(7897)
    const input = screen.getByRole('textbox', { name: '代理端口' })
    fireEvent.change(input, { target: { value: '8118' } })
    fireEvent.blur(input)
    expect(setPort).toHaveBeenCalledWith(8118)
    setPort.mockClear()
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(setPort).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '9050' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(setPort).toHaveBeenCalledWith(9050)
  })

  it('does not write an invalid or unchanged draft', () => {
    const { setPort } = mount(7897)
    const input = screen.getByRole('textbox', { name: '代理端口' })
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.blur(input)
    expect(screen.getByText('请输入 1 到 65535 之间的端口')).toBeDefined()
    expect(setPort).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '7897' } })
    fireEvent.blur(input)
    expect(setPort).not.toHaveBeenCalled()
  })

  it('disables the field when the Host document is not writable', () => {
    mount(7897, false)
    expect(screen.getByRole('textbox', { name: '代理端口' })).toHaveProperty('disabled', true)
  })

  it('resets the draft when the stored port changes', () => {
    const { store } = mount(7897)
    const input = screen.getByRole('textbox', { name: '代理端口' })
    fireEvent.change(input, { target: { value: '1' } })
    act(() => { store.actions.sync(8118, true, 1) })
    expect(input).toHaveProperty('value', '8118')
  })

  it('ignores a stale store sync', () => {
    const store = createProxyPortStore().create()
    store.actions.sync(8118, true, 2)
    store.actions.sync(9050, false, 1)
    expect(store.store.getSnapshot()).toMatchObject({ port: 8118, writable: true, revision: 2 })
  })
})

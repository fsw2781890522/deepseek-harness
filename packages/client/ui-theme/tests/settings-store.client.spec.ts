/** Appearance row store: snapshot-mirror action and the revision guard. */
import { describe, expect, it } from 'vitest'
import { createAppearanceRowStore } from '../src/client/settings-store.ts'

describe('createAppearanceRowStore', () => {
  it('init shape: system preference with revision at -1', () => {
    const store = createAppearanceRowStore().create()
    expect(store.getSnapshot()).toEqual({ preference: 'system', transparency: 40, revision: -1 })
  })

  it('sync mirrors the preference and advances the revision', () => {
    const store = createAppearanceRowStore().create()
    store.actions.sync('dark', 55, 0)
    expect(store.getSnapshot()).toEqual({ preference: 'dark', transparency: 55, revision: 0 })
    store.actions.sync('light', 35, 2)
    expect(store.getSnapshot().preference).toBe('light')
    expect(store.getSnapshot().transparency).toBe(35)
    expect(store.getSnapshot().revision).toBe(2)
  })

  it('revision guard drops stale and duplicate writes', () => {
    const store = createAppearanceRowStore().create()
    store.actions.sync('dark', 55, 3)
    store.actions.sync('system', 20, 2)
    store.actions.sync('system', 20, 3)
    expect(store.getSnapshot().preference).toBe('dark')
    expect(store.getSnapshot().transparency).toBe(55)
    expect(store.getSnapshot().revision).toBe(3)
  })
})

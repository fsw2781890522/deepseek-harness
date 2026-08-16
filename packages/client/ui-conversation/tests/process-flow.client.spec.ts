import { describe, expect, it } from 'vitest'
import { groupChatFlow } from '../src/client/chat/process-flow.ts'

describe('groupChatFlow', () => {
  const kinds: Record<string, string> = {
    u: 'user',
    r: 'assistant-reasoning',
    t: 'tool-call',
    w: 'workflow-run',
    a: 'assistant-step',
    tail: 'turn-tail',
  }
  const kindOf = (key: string): string | undefined => kinds[key]

  it('leaves a live trailing process run expanded', () => {
    expect(groupChatFlow(['r', 't'], kindOf, false)).toEqual([
      { type: 'node', key: 'r' },
      { type: 'node', key: 't' },
    ])
  })

  it('seals a trailing process run when the Session is not running', () => {
    expect(groupChatFlow(['r', 't', 'w'], kindOf, true)).toEqual([
      { type: 'group', keys: ['r', 't', 'w'] },
    ])
  })

  it('seals a process run when a later reply arrives, then starts a new run', () => {
    expect(groupChatFlow(['u', 'r', 't', 'a', 't', 'tail'], kindOf, true)).toEqual([
      { type: 'node', key: 'u' },
      { type: 'group', keys: ['r', 't'] },
      { type: 'node', key: 'a' },
      { type: 'group', keys: ['t'] },
      { type: 'node', key: 'tail' },
    ])
  })

  it('drops a leading process run before the first user prompt but keeps later groups', () => {
    expect(groupChatFlow(['r', 't', 'u', 'w', 'a'], kindOf, true)).toEqual([
      { type: 'node', key: 'u' },
      { type: 'group', keys: ['w'] },
      { type: 'node', key: 'a' },
    ])
  })

  it('suppresses the personal reasoning-collapse marker but keeps core process groups', () => {
    expect(groupChatFlow(['u', 'rc', 'r', 't', 'a'], key => ({
      ...kinds,
      rc: 'reasoning-collapse',
    }[key]), true)).toEqual([
      { type: 'node', key: 'u' },
      { type: 'group', keys: ['r', 't'] },
      { type: 'node', key: 'a' },
    ])
  })

  it('treats unknown keys as ordinary rows', () => {
    expect(groupChatFlow(['missing', 'r'], kindOf, true)).toEqual([
      { type: 'node', key: 'missing' },
      { type: 'group', keys: ['r'] },
    ])
  })

  it('returns an empty flow for an empty order', () => {
    expect(groupChatFlow([], kindOf, true)).toEqual([])
  })
})

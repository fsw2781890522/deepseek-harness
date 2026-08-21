// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type {
  ChatConversationViewNode, ConversationSnapshot,
} from '@deepseek-ai/dsh-client-runtime/client'
import { EMPTY_CHAT_SNAPSHOT, EMPTY_CONVERSATION_VIEWS } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ChatViewSlotProps } from '../src/client/contract/slots.ts'
import { ProcessGroup } from '../src/client/chat/ProcessGroup.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh)
const SID = 's1' as SessionId

function viewNode(
  key: string,
  kind: string,
  data: unknown,
): ChatConversationViewNode {
  return {
    key,
    kind,
    id: key,
    target: 'chat',
    anchorSeq: 1,
    location: { kind: 'session' },
    visibility: 'visible',
    data,
  } as ChatConversationViewNode
}

function renderGroup(
  nodes: ReadonlyMap<string, ChatConversationViewNode>,
  keys: readonly string[],
) {
  const snapshot: ConversationSnapshot = {
    sessionId: SID,
    views: EMPTY_CONVERSATION_VIEWS,
    chat: {
      ...EMPTY_CHAT_SNAPSHOT,
      nodes: {
        get: (key: string) => nodes.get(key),
        values: () => [...nodes.values()],
        replace: () => {},
        upsert: () => {},
      },
    } as ConversationSnapshot['chat'],
    nodes: [],
    turnTimings: new Map(),
    turnEnds: new Map(),
    partial: null,
    runningCalls: [],
    pending: [],
    queue: [],
    running: false,
    composerPhase: 'active',
    removed: false,
    openState: 'open',
    openError: null,
    hasMore: false,
    loadingOlder: false,
    promptError: null,
    blank: false,
    subagent: null,
    lastAgentError: null,
  }
  const source = { getSnapshot: () => snapshot, subscribe: () => () => {} }
  const renderMessageImages = vi.fn(() => null)
  const owners: object[] = []
  const view = render(
    <ProcessGroup
      keys={keys}
      useSession={bindSnapshotSelector(source)}
      openFile={vi.fn()}
      inspectCall={vi.fn()}
      forkAt={vi.fn()}
      renderMessageImages={renderMessageImages}
      fileMentions={() => undefined}
      renderSlot={((_key: string, owner: object) => {
        owners.push(owner)
        const node = (owner as { readonly node?: { readonly key?: string } }).node
        return node?.key === undefined ? null : <div data-testid={`seat-${node.key}`} />
      }) as ChatViewSlotProps['renderSlot']}
      t={t}
    />,
  )
  return Object.assign(view, { renderMessageImages, owners })
}

describe('ProcessGroup duration', () => {
  it('spans Think and Tool times and skips workflow or missing rows', () => {
    const view = renderGroup(new Map([
      ['r', viewNode('r', 'assistant-reasoning', {
        startTime: 1_000, endTime: 1_500, blocks: [], status: 'settled', turn: 1, step: 1, time: 1_000,
      })],
      ['running', viewNode('running', 'tool-call', {
        root: { callId: 'r1', name: 'bash', argsRaw: '{}', turn: 1, step: 1, time: 2_000, callView: null, subCalls: [] },
      })],
      ['settled', viewNode('settled', 'tool-call', {
        root: {
          kind: 'tool-result', callId: 's1', seq: 3, time: 3_000, callTime: null,
          call: { name: 'bash', argsRaw: '{}' }, content: [], isError: false,
          callView: null, resultView: null, subCalls: [],
        },
      })],
      ['w', viewNode('w', 'workflow-run', {})],
    ]), ['r', 'running', 'settled', 'w', 'ghost'])
    expect(view.getByText('已处理 2 s')).toBeTruthy()
  })

  it('keeps the first child as the collapsed paging anchor and unmounts seats until expanded', () => {
    const view = renderGroup(new Map([
      ['r', viewNode('r', 'assistant-reasoning', {
        startTime: 1_000, endTime: 2_000, blocks: [], status: 'settled', turn: 1, step: 1, time: 1_000,
      })],
    ]), ['r'])
    const group = view.container.querySelector('[data-chat-process-group]')
    expect(group?.getAttribute('data-chat-anchor-key')).toBe('r')
    expect(view.queryByTestId('seat-r')).toBeNull()
    fireEvent.click(view.getByRole('button', { name: /已处理/ }))
    expect(group?.getAttribute('data-chat-anchor-key')).toBeNull()
    expect(view.getByTestId('seat-r')).toBeTruthy()
  })

  it('passes the native message-image renderer through every expanded seat', () => {
    const view = renderGroup(new Map([
      ['r', viewNode('r', 'assistant-reasoning', {
        startTime: 1_000, endTime: 2_000, blocks: [], status: 'settled', turn: 1, step: 1, time: 1_000,
      })],
    ]), ['r'])
    fireEvent.click(view.getByRole('button', { name: /已处理/ }))
    expect(view.owners).toHaveLength(1)
    expect((view.owners[0] as { readonly renderMessageImages?: unknown }).renderMessageImages)
      .toBe(view.renderMessageImages)
  })
})

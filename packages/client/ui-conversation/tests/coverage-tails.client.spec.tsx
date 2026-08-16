// @vitest-environment jsdom
// Branch tails the acceptance specs do not reach: the node-half apply
// without a settings service and AssistantMarkdown unknown-block arms.

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { cleanup, render } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { apply as nodeApply } from '../src/index.ts'
import { AssistantMarkdown, type AssistantMarkdownProps } from '../src/client/chat/AssistantMarkdown.tsx'
import { zh } from '../src/client/locales.ts'

// Mirrors the real lookup chain (conversation namespace, then common).
const t: AssistantMarkdownProps['t'] = makeTranslate(zh, commonZh)

afterEach(cleanup)

describe('tails', () => {
  it('node-half apply tolerates a Host without settings', () => {
    expect(() => { nodeApply(new Context()) }).not.toThrow()
  })

  it('AssistantMarkdown skips Think and tool heads, and renders unknown blocks as JSON fallback', () => {
    const view = render(
      <AssistantMarkdown
        t={t}
        blocks={[
          { kind: 'reasoning', text: 'thinking hard\nsecond line' },
          { kind: 'tool-call', callId: 'c', name: 'bash', argsRaw: '{}' },
          { kind: 'other', block: { type: 'mystery' } },
        ]}
        streaming
      />,
    )
    expect(view.queryByText('Think')).toBeNull()
    expect(view.getByText(/未知内容块/)).toBeTruthy()
    const stopped = render(
      <AssistantMarkdown t={t} blocks={[{ kind: 'text', text: 'partial words' }]} streaming={false} interrupted />,
    )
    expect(stopped.getByText('已停止')).toBeTruthy()
  })

  it('AssistantMarkdown skips the root shell when only Think or tool-call heads remain', () => {
    // Think and Tool heads are sibling Chat Nodes; an empty reply root is layout noise.
    const empty = render(
      <AssistantMarkdown
        t={t}
        blocks={[{ kind: 'tool-call', callId: 'c', name: 'todo_write', argsRaw: '{}' }]}
        streaming={false}
      />,
    )
    expect(empty.container.firstChild).toBeNull()
    const thinkOnly = render(
      <AssistantMarkdown
        t={t}
        blocks={[{ kind: 'reasoning', text: 'hidden from the reply' }]}
        streaming={false}
      />,
    )
    expect(thinkOnly.container.firstChild).toBeNull()
    const blank = render(<AssistantMarkdown t={t} blocks={[]} streaming={false} />)
    expect(blank.container.firstChild).toBeNull()
  })

})

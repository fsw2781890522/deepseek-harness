/** Consecutive Chat process rows that collapse once a later reply or closed tail seals them. */

const PROCESS_KINDS = new Set(['assistant-reasoning', 'tool-call', 'workflow-run'])

/** One Chat flow row: a standalone Node, or a sealed process group. */
export type ChatFlowItem =
  | { readonly type: 'node'; readonly key: string }
  | { readonly type: 'group'; readonly keys: readonly string[] }

/**
 * Group consecutive Think, Tool, and workflow rows once a later non-process
 * row (or a finished Session) seals the run.
 * @param order - visible Chat Node keys in render order.
 * @param kindOf - current kind for one key; unknown keys stay ungrouped.
 * @param sealTrailing - whether a trailing process run should collapse (Session not running).
 * @returns flow items for ChatView to render.
 */
export function groupChatFlow(
  order: readonly string[],
  kindOf: (key: string) => string | undefined,
  sealTrailing: boolean,
): readonly ChatFlowItem[] {
  const items: ChatFlowItem[] = []
  let run: string[] = []

  const flush = (seal: boolean): void => {
    if (run.length === 0) return
    if (seal) items.push({ type: 'group', keys: run })
    else {
      for (const key of run) items.push({ type: 'node', key })
    }
    run = []
  }

  for (const key of order) {
    const kind = kindOf(key)
    if (kind !== undefined && PROCESS_KINDS.has(kind)) {
      run.push(key)
      continue
    }
    flush(run.length > 0)
    items.push({ type: 'node', key })
  }
  flush(sealTrailing && run.length > 0)
  return items
}

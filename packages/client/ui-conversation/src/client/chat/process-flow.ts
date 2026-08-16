/** Consecutive Chat process rows that collapse once a later reply or closed tail seals them. */

const PROCESS_KINDS = new Set(['assistant-reasoning', 'tool-call', 'workflow-run'])
// The personal dsh-reasoning-collapse plugin publishes a second synthetic
// header for the same process rows. Core ProcessGroup owns that disclosure;
// suppress only the plugin marker so the normal Think/tool/bash collapse rows
// remain available and interactive.
const SUPPRESSED_KINDS = new Set(['reasoning-collapse'])

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
  let sawUser = false
  const visibleOrder = order.filter(key => !SUPPRESSED_KINDS.has(kindOf(key) ?? ''))
  const containsUser = visibleOrder.some(key => kindOf(key) === 'user')

  const flush = (seal: boolean): void => {
    if (run.length === 0) return
    // A replay window can begin in the middle of an old process run. It has
    // no owning user prompt in this window, so rendering its synthetic
    // disclosure creates an orphan "Processed" row above the first prompt.
    // Keep live rows available while a session is running; only discard the
    // sealed orphan control that would otherwise be shown.
    if (containsUser && !sawUser && seal) {
      run = []
      return
    }
    if (seal) items.push({ type: 'group', keys: run })
    else {
      for (const key of run) items.push({ type: 'node', key })
    }
    run = []
  }

  for (const key of visibleOrder) {
    const kind = kindOf(key)
    if (kind !== undefined && PROCESS_KINDS.has(kind)) {
      run.push(key)
      continue
    }
    flush(run.length > 0)
    items.push({ type: 'node', key })
    if (kind === 'user') sawUser = true
  }
  flush(sealTrailing && run.length > 0)
  return items
}

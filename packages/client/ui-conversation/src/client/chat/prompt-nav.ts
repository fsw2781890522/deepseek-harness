/** Prompt minimap: one tick per loaded user message, derived from Chat order. */

/** Accessible tick name cap so announcements stay one line. */
const ARIA_TITLE_MAX = 64

/** One user prompt listed in the Chat-flow minimap. */
export interface PromptNavItem {
  readonly key: string
  readonly title: string
  readonly body: string
  readonly attachment: string | null
  /** Truncated title used as the tick's accessible name. */
  readonly ariaLabel: string
}

interface PromptParts {
  readonly text: string
  readonly imageCount: number
  readonly imageNames: readonly string[]
}

interface PromptNavCopy {
  readonly empty: string
  readonly image: string
  readonly images: (count: number) => string
}

/**
 * Clip a prompt title to a single accessible-name line.
 * @param text - already-trimmed title.
 * @returns title, or a prefix plus an ellipsis when longer than {@link ARIA_TITLE_MAX}.
 */
export function clipPromptAriaLabel(text: string): string {
  if (text.length <= ARIA_TITLE_MAX) return text
  return `${text.slice(0, ARIA_TITLE_MAX).trimEnd()}…`
}

/**
 * Split prompt text into a first-line title and remaining body.
 * @param text - concatenated user text blocks.
 * @returns empty strings when the prompt has no text.
 */
export function splitPromptPreview(text: string): { title: string; body: string } {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (normalized.length === 0) return { title: '', body: '' }
  const newline = normalized.indexOf('\n')
  if (newline === -1) return { title: normalized, body: '' }
  return {
    title: normalized.slice(0, newline).trimEnd(),
    body: normalized.slice(newline + 1).trim(),
  }
}

function promptParts(content: unknown): PromptParts {
  const texts: string[] = []
  const imageNames: string[] = []
  if (!Array.isArray(content)) return { text: '', imageCount: 0, imageNames }
  for (const block of content) {
    if (block === null || typeof block !== 'object') continue
    const row = block as { type?: unknown; text?: unknown; attachment?: { name?: unknown } }
    if (row.type === 'text' && typeof row.text === 'string') texts.push(row.text)
    else if (row.type === 'image') {
      const name = row.attachment?.name
      imageNames.push(typeof name === 'string' && name.trim() !== '' ? name.trim() : '')
    }
  }
  return { text: texts.join(''), imageCount: imageNames.length, imageNames }
}

function attachmentLabel(parts: PromptParts, copy: PromptNavCopy): string | null {
  if (parts.imageCount === 0) return null
  if (parts.imageCount === 1) return parts.imageNames[0] || copy.image
  return copy.images(parts.imageCount)
}

/**
 * Collect minimap ticks from the loaded Chat order.
 * Steering, context, and assistant rows are omitted; only `user` Nodes appear.
 * @param order - visible Chat Node keys in render order.
 * @param nodeOf - current Node for one key; missing or non-user keys are skipped.
 * @param copy - localized empty/image fallbacks.
 * @returns ticks in transcript order.
 */
export function promptNavItems(
  order: readonly string[],
  nodeOf: (key: string) => { readonly kind: string; readonly data: unknown } | undefined,
  copy: PromptNavCopy,
): readonly PromptNavItem[] {
  const items: PromptNavItem[] = []
  for (const key of order) {
    const node = nodeOf(key)
    if (node?.kind !== 'user') continue
    const data = node.data as { content?: unknown }
    const parts = promptParts(data.content)
    const preview = splitPromptPreview(parts.text)
    const namedImage = parts.imageNames.find(name => name !== '')
    const title = preview.title !== ''
      ? preview.title
      : namedImage ?? (parts.imageCount > 0 ? copy.image : copy.empty)
    const attachment = preview.title === '' && parts.imageCount > 0
      ? null
      : attachmentLabel(parts, copy)
    items.push({
      key,
      title,
      body: preview.body,
      attachment,
      ariaLabel: clipPromptAriaLabel(title),
    })
  }
  return items
}

/**
 * Pick the last prompt whose row top is at or above the reading probe.
 * @param keys - minimap keys in transcript order.
 * @param topOf - row top in viewport coordinates; `null` skips an unmounted row.
 * @param probeY - reading line in the same coordinates (typically near the scrollport top).
 * @returns that key, the first listed key when every row sits below the probe, or null when empty.
 */
export function resolveActivePromptKey(
  keys: readonly string[],
  topOf: (key: string) => number | null,
  probeY: number,
): string | null {
  let current: string | null = null
  for (const key of keys) {
    const top = topOf(key)
    if (top === null) continue
    if (top <= probeY) current = key
    else if (current !== null) break
  }
  return current ?? keys[0] ?? null
}

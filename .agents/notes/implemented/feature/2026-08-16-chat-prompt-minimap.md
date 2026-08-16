# Agent Note: Chat prompt minimap on the waterfall

Status: implemented

English | [中文](2026-08-16-chat-prompt-minimap.zh.md)

## Problem

A long Chat transcript has no in-column way to see how many user prompts it contains or to jump back to an earlier one. The workspace sidebar lists Sessions, not prompts, and scrolling the waterfall is the only path to a prior user row.

## Decision

`ui-conversation` owns a sticky prompt minimap inside ChatView. It is not a plugin package, Session event, store field, or model-visible contract.

Each loaded `user` Chat Node becomes one short tick in a zero-height sticky slot on the left of the conversation scrollport, placed in the leftover left gutter 24px from the scrollport's left edge (the offset is that gutter minus 24px, floored at 20px so a narrow gutter does not clip). Steering, context, and assistant rows are omitted. The slot uses `position: sticky` on the Chat scroll host so the ticks stay in the visible gutter while the transcript scrolls; under `[data-conversation-scroll]` that host is the conversation column, and in unit tests it is ChatView's own `.scroll`. Hover or focus opens a truncated preview card (first line, remaining text, image names) with `position: fixed` so the conversation column's `overflow-x: hidden` does not clip it. The card uses theme layer and label aliases (`--dsw-alias-bg-layer-2`, `--dsw-alias-label-primary` / `--dsw-alias-label-secondary`) rather than the always-dark tooltip plate, so light and dark both keep readable contrast. A click calls `scrollIntoView({ block: 'start' })` on the matching `[data-chat-anchor-key]` row. The highlighted tick is the last user row whose top is at or above a reading probe near the scrollport top. Pinning to the bottom — open jump, live follow, or the back-to-bottom control — selects the last loaded user prompt inside `toBottom`, because a programmatic floor write is not reader input and the scroll listener would otherwise skip the viewport spy.

## Alternatives considered

**A new plugin package wrapping ChatView.** Rejected: the ticks need `chat.order`, user Node payloads, and the same scrollport ChatView already resolves. A wrapper cannot pin into that gutter without replacing ChatView.

**Reuse the ui-primitives `Tooltip` pill.** Rejected: the product card is a multi-line title/body/attachment plate. Tooltip accepts only a string label.

**`position: fixed` against the window for the ticks themselves.** Rejected: that would pin to the browser viewport and collide with the workspace sidebar. The ticks belong to the conversation column.

**Include admitted steering bubbles.** Rejected: the request is one tick per user prompt that opens a turn, not mid-turn interjections.

## Consequences

Readers can scan and jump among loaded user prompts without leaving the waterfall. Unpaged history has no tick until `load older` brings those Nodes into the window. Local hover state is not persisted. The minimap is an accessible `navigation` named `对话导航` / `Conversation prompts`, so assembled Web aria snapshots include one button per loaded user prompt.

## Testing

Package tests pin item derivation (user-only, first-line split, image fallbacks, aria clip), active-key selection, hover preview, click jump, jump-to-bottom selecting the last user tick, and ChatView omitting the nav when the window has no user rows. Assembled Web replay goldens include the navigation landmark; refresh those fixtures when the visible transcript changes.

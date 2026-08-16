# Agent Note: Collapse Chat process rows when the reply starts

Status: implemented

English | [中文](2026-08-16-chat-process-run-collapse.zh.md)

## Problem

The Chat waterfall rendered every Think, Tool, and bash row as a full-height sibling for the rest of the Session. After the model finished reasoning and started its visible reply, that process history still occupied the same vertical space as live work, so a finished step pushed the answer far below the fold.

## Decision

`ui-conversation` owns the behavior. Chat business stays on Conversation Nodes; ChatView groups consecutive process rows in the render list. There is no extra plugin package, Session event, store field, or model-visible contract.

Think is a sibling Chat Node, not a block inside the reply renderer. `assistant-step` publishes only reply material (text, images, other blocks, and an interrupted tool-head-only shell). `assistant-reasoning` shares the same Assistant fold and publishes only non-empty reasoning blocks. Tool and workflow rows keep their existing Definitions. `AssistantMarkdown` skips `reasoning` and `tool-call` blocks so Think is not drawn twice.

`groupChatFlow` walks `chat.order` and wraps consecutive `assistant-reasoning`, `tool-call`, and `workflow-run` keys into one process group once a later non-process row (the reply, turn-tail, user message, and similar) seals the run, or once the Session is no longer running and the trailing run has no later sealer. A live trailing run stays expanded. The group mounts collapsed, shows `已处理 {duration}` / `Processed {duration}` with `formatProcessDuration` (`x h x m x s`, omitting leading zero units, always keeping seconds), and toggles through `DisclosureRow` with `expandOnRowClick`. Expansion is component-local React state: collapsed groups unmount child seats; a remount starts collapsed again. The group wrapper carries `data-chat-anchor-key` of the first child so paging still has a settled row.

Duration is min(start) through max(end) across members that expose timestamps. Reasoning uses first and last reasoning times from the shared fold, not later reply deltas. Settled tools use `callTime ?? time` through `time`; running tools use `time`. Workflow rows do not contribute a span.

## Alternatives considered

**A new Chat-view plugin package that wraps the existing flow.** Rejected: the grouping needs the assembled `order` and kinds, which already live in `ui-conversation`. A wrapper plugin cannot put Think and Tool into one DOM container without changing those Nodes or replacing ChatView.

**Collapse each Think and Tool row independently, without a shared container.** Rejected: the request is one summary for the finished process run. Independent rows still stack their headers.

**Subscribe ChatView to every Node's blocks to detect the first reply token.** Rejected: each `ChatNodeSeat` already isolates streaming updates. Sealing from `order` (a new reply key) plus `running` is enough.

**Persist expansion in the chat store or Session log.** Rejected: the default is to reclaim space; review is a local, disposable choice. Persistence would add a second owner and stale-choice semantics the product does not need.

## Consequences

Finished process history occupies one header until the reader expands it, and a still-running tail stays live. The same Assistant events now materialize two Chat Nodes, so render order is reasoning, tools, then reply when those keys exist. Trajectory and other views that still read Assistant blocks from `assistant-step` keep reasoning in that payload; only Chat presentation splits it. Local expansion resets on remount and when the group's first or last key changes.

## Testing

Package tests pin the shared fold, the reasoning Node, `groupChatFlow` sealing rules, `formatProcessDuration`, ChatView collapse/expand, and AssistantMarkdown no longer drawing Think. Assembled Web replay of settled conversations shows the process header instead of the expanded Think and Tool stack; refresh those fixtures when the visible transcript changes. Browser tests that inspect a Think or Tool row after settlement call `expandProcessedGroups` first.

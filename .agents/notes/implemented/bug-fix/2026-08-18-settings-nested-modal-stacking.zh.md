# Agent Note: Settings nested modal stacking

Status: implemented

[English](2026-08-18-settings-nested-modal-stacking.md) | 中文

## 问题

设置面板挂在侧栏 slot 上，并绘制铺满视口的遮罩。AppFrame 在设置打开时把 `.sidebarCol:has([role='dialog'])` 抬到 `z-index: 1001`，让这一列压过 PromptNav、composer 和其他中间列浮层。

`Modal` 被 portal 到 `document.body`，原先的 `z-index` 更低。因此从设置里打开的确认框——模型页删除提供方、删除 agent 预设——会画在设置的层叠上下文后面。行上的按钮会更新 React 状态，但用户看不到对话框，删除看起来没有反应。

两层都在 `document` 上监听 Escape。设置先挂载，所以即使确认框已经可见，Escape 也会先关掉整个设置面板。

## 决策

`Modal` 使用 `z-index: 1050`，高于设置列，低于 Menu、Toast 和 OnboardingSurface 的 `1100`，这样 portal 出来的菜单仍会画在确认框之上。

当文档里存在不止一个 `[role="dialog"][aria-modal="true"]` 时，设置忽略 Escape。确认框继续用自己的 Escape 和遮罩点击关闭。确认框遮罩盖住视口时，点击不会落到设置遮罩上。

## 测试

`packages/client/ui-primitives/tests/styles.client.spec.ts` 固定 Modal 为 `1050`、Menu 为 `1100`。`packages/client/ui-settings-general/tests/settings-root.client.spec.tsx` 在第二个 `aria-modal` 对话框存在时保持设置打开，并在该对话框消失后关闭设置。模型与 agent-preset 套件已经通过 `Modal` 驱动删除确认。

## 备选方案

**把设置 portal 到 `document.body` 并使用 `z-index: 1000`。** 被否决，因为侧栏毛玻璃的 `backdrop-filter` 会成为 `position: fixed` 子孙的包含块。AppFrame 已经在打开设置时去掉该滤镜并抬高网格项，好让遮罩铺满视口而不被困在列内；把设置移出 slot 会重新让 PromptNav 和 composer 压住设置。

**把设置列降到 `1000` 以下。** 被否决，因为 PromptNav 和其他中间列浮层会再次画在设置遮罩之上，而这正是 `1001` 层叠上下文要防止的缺陷。

**只抬高模型页的删除对话框。** 被否决，因为设置里每一个 `Modal`（拉取模型目录、删除 agent 预设、目录创建）都有同样的层叠缺失。

**让 `Modal` 在捕获阶段对 Escape 调用 `stopImmediatePropagation`。** 被否决，因为嵌套的目录选择 `Modal` 先注册父级；捕获阶段会在子级之前关闭或吞掉父级的 Escape。

## 影响

设置打开期间必须可见的、portal 到 body 的浮层，其 `z-index` 必须大于 `1001`。Menu 仍为 `1100`，对话框内的菜单仍然压在确认框之上。图片灯箱和拖放遮罩保持 `1000`，仍会落在设置后面；这些流程不会从设置面板打开。

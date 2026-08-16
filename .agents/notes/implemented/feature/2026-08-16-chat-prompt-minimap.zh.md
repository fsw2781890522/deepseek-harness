# Agent Note: Chat 瀑布流上的 prompt 小地图

Status: implemented

[English](2026-08-16-chat-prompt-minimap.md) | 中文

## 问题

长 Chat transcript 没有列内方式查看其中有多少条用户 prompt，也无法跳回更早的一条。工作区侧边栏列出的是 Session 而不是 prompt，回到先前的用户行只能靠滚动瀑布流。

## 决策

`ui-conversation` 在 ChatView 内拥有一条 sticky prompt 小地图。它不是新的插件包、Session 事件、store 字段，也不是模型可见约定。

当前已加载的每条 `user` Chat Node 在对话滚动容器左侧变成一根短横线，放在零高度的 sticky 槽里，落在剩余左侧空隙中、距滚动容器左缘 24px（偏移为该空隙减 24px，下限 20px，以免窄空隙裁切）。steering、上下文和 assistant 行不进入该列表。该槽对 Chat 滚动宿主使用 `position: sticky`，因此短横线留在可见空隙里而 transcript 继续滚；在 `[data-conversation-scroll]` 下该宿主是对话列，单元测试里则是 ChatView 自己的 `.scroll`。悬停或聚焦打开截断预览卡（首行、其余正文、图片名），并用 `position: fixed`，以免对话列的 `overflow-x: hidden` 裁切它。预览卡使用主题 layer／label 别名（`--dsw-alias-bg-layer-2`、`--dsw-alias-label-primary` / `--dsw-alias-label-secondary`），而不是始终深色的 tooltip 底板，因此浅色和深色都能保持可读对比。点击对匹配的 `[data-chat-anchor-key]` 行调用 `scrollIntoView({ block: 'start' })`。高亮的短横线是行顶不高于阅读探测线（靠近滚动容器顶部）的最后一条用户行。钉在底部——打开时跳到底、实时跟随、或回到底部控件——由 `toBottom` 选中最后一条已加载用户 prompt，因为程序化写到底边不算读者输入，滚动监听否则会跳过视口探测。

## 考虑过的替代方案

**用新的插件包包裹 ChatView。** 否决：短横线需要 `chat.order`、用户 Node 载荷，以及 ChatView 已经解析出的同一个滚动容器。包裹层无法在不替换 ChatView 的情况下钉进那条空隙。

**复用 ui-primitives 的 `Tooltip` 胶囊。** 否决：产品卡片是多行的标题／正文／附件面板。Tooltip 只接受字符串标签。

**短横线本身对窗口使用 `position: fixed`。** 否决：那会钉在浏览器视口上，并与工作区侧边栏重叠。短横线属于对话列。

**把已接纳的 steering 气泡算进去。** 否决：需求是每个开启一轮的用户 prompt 一根短横线，不是轮次中途的插话。

## 后果

读者可以在不离开瀑布流的情况下扫过并跳转到已加载的用户 prompt。尚未翻页的历史没有对应短横线，直到「加载更早」把那些 Node 带进窗口。本地悬停状态不持久化。小地图是名为 `对话导航` / `Conversation prompts` 的可访问 `navigation`，因此组装后的 Web aria 快照会为每条已加载用户 prompt 包含一个按钮。

## 测试

包测试钉住条目推导（仅 user、首行拆分、图片回退、aria 截断）、活跃 key 选择、悬停预览、点击跳转、回到底部选中最后一根用户短横线，以及窗口没有用户行时 ChatView 省略该导航。组装后的 Web replay golden 包含该 navigation landmark；可见 transcript 变化时刷新这些夹具。

# Agent Note: 回复开始后折叠 Chat 过程行

Status: implemented

[English](2026-08-16-chat-process-run-collapse.md) | 中文

## 问题

Chat 瀑布流会把每一条 Think、Tool 和 bash 行都作为全高度兄弟节点一直留在 Session 里。模型结束推理并开始可见回复之后，这段过程历史仍占用与实时工作相同的纵向空间，已完成步骤会把回答推到折线以下。

## 决策

行为由 `ui-conversation` 拥有。Chat 业务仍落在 Conversation Node 上；ChatView 在渲染列表里把连续的过程行分组。不增加额外 plugin 包、Session 事件、store 字段或模型可见契约。

Think 是兄弟 Chat Node，而不是回复 renderer 里的内容块。`assistant-step` 只发布回复材料（文本、图片、其他块，以及仅含 tool head 的中断壳）。`assistant-reasoning` 共享同一套 Assistant fold，只发布非空 reasoning 块。Tool 与 workflow 行保留原有 Definition。`AssistantMarkdown` 跳过 `reasoning` 和 `tool-call` 块，避免 Think 画两次。

`groupChatFlow` 遍历 `chat.order`，把连续的 `assistant-reasoning`、`tool-call`、`workflow-run` key 收成一个过程组：后续非过程行（回复、turn-tail、用户消息等）封口该 run，或 Session 已不在运行且尾部 run 没有更晚的封口者。仍在进行的尾部 run 保持展开。分组默认折叠，标题为 `已处理 {duration}` / `Processed {duration}`，时长由 `formatProcessDuration` 格式化为 `x h x m x s`（省略前导零单位，秒始终保留），并通过带 `expandOnRowClick` 的 `DisclosureRow` 切换。展开状态是组件本地 React state：折叠时卸载子 Seat；重新挂载后再次从折叠开始。分组容器带上第一个子节点的 `data-chat-anchor-key`，分页仍能找到稳定行。

时长取成员中暴露时间戳的 min(start) 到 max(end)。reasoning 使用共享 fold 里首次与末次 reasoning 时间，不用更晚的回复 delta。已结算工具使用 `callTime ?? time` 到 `time`；运行中工具使用 `time`。workflow 行不贡献时间跨度。

## 考虑过的替代方案

**新建一个包装现有流的 Chat 视图 plugin 包。** 否决：分组需要已组装的 `order` 与 kind，而这些已经在 `ui-conversation` 里。包装插件无法在不改这些 Node 或替换 ChatView 的情况下，把 Think 和 Tool 放进同一个 DOM 容器。

**各自独立折叠 Think 和 Tool 行，不共用容器。** 否决：需求是给已完成的过程 run 一条摘要。独立行仍然会叠各自的标题。

**让 ChatView 订阅每个 Node 的 blocks 以检测首个回复 token。** 否决：每个 `ChatNodeSeat` 已经隔离流式更新。用 `order`（新的回复 key）加上 `running` 封口已经足够。

**把展开状态持久化到 chat store 或 Session 日志。** 否决：默认是收回空间；复盘是本地、一次性选择。持久化会引入第二个所有者以及产品并不需要的过期选择语义。

## 后果

已完成的过程历史在读者展开前只占一条标题，仍在运行的尾部保持直播。同一批 Assistant 事件现在会物化两个 Chat Node，因此在这些 key 都存在时，渲染顺序是 reasoning、工具、然后回复。仍从 `assistant-step` 读取 Assistant 块的 Trajectory 等视图会把 reasoning 留在该 payload 里；只有 Chat 展示把它拆开。本地展开在重新挂载、以及分组的首个或末个 key 变化时复位。

## 测试

包测试钉住共享 fold、reasoning Node、`groupChatFlow` 封口规则、`formatProcessDuration`、ChatView 折叠/展开，以及 AssistantMarkdown 不再绘制 Think。已结算对话的组装 Web 回放会显示过程标题，而不是展开的 Think 与 Tool 堆栈；可见 transcript 变化时刷新这些夹具。结算后要检查 Think 或 Tool 行的浏览器测试会先调用 `expandProcessedGroups`。

# Agent Note: 进程 HTTP 代理回退，放在智能体工具平面之外

Status: implemented

[English](2026-08-16-http-proxy-fallback.md) | 中文

## 问题

Harness 自有 HTTP（LLM 适配器、Host `fetch`、桌面更新器）必须在只能经本地 mixed 端口代理（例如 Clash `127.0.0.1:7897`）出网的主机上到达公网。若把这条路径接到 `tool-web` / `web_search` / `web_fetch`，产品 HTTP 就会绑上 agent preset 调度器：这些工具在部分 session 阶段被禁用，且该禁用是正确的。「检查更新」是应用行为，web 工具关闭时仍须可用。Tauri 更新器走 Rust `ureq`，因此只包装 Node `fetch` 无法修复设置里的「检查更新」。

## 决策

`@deepseek-ai/dsh-http-proxy`（`packages/boot/http-proxy`）在 Node 进程里包装 `globalThis.fetch`：先直连，再经 undici `ProxyAgent` 走 `http://127.0.0.1:{port}`。它注册 settings namespace `http-proxy`，字段 `port`（默认 `7897`，即时生效）。它不注册、启用或禁用任何工具。智能体工具是否可用仍由当前 agent preset 决定，包括禁用 `web_search` / `web_fetch` / `tool-web` 的阶段。

`dsh-base` 在 settings 行之后插入该插件，因此 CLI、Web 和无头共享该包装。`ui-settings-general` 在存在 `settingsScope` 时注册无主通用项 `proxy-port`（order 80）。该行写入 `http-proxy.port`，并说明它不改变智能体工具是否可用。

`dsh-desktop` 的 `update.rs` 在 `ureq` 上应用同一套直连再代理规则（5s 连接 / 直连总共 8s，然后走代理）。端口解析顺序为 `DSH_PROXY_PORT`，然后 `DSH_PROXY_URL`，然后 `$DSH_HOME/settings.yaml` 或 `~/.dsh/settings.yaml` 中的 `http-proxy.port`，最后是 `7897`。回环 URL 和 `file:` 路径不走代理。「检查更新」不调用 `tool-web`，也不按 session 阶段或 tool-bootstrap 门控。

回环主机以及 `NO_PROXY` / `no_proxy` 跳过 Node 代理路径。插件不向 bash/pwsh 子进程导出 `HTTP_PROXY`。

## 考虑过的替代方案

**只要更新器或 LLM 需要网络就启用 `tool-web`。** 否决：工具启停归 anchored-standard preset 调度器所有。部分阶段有意禁用 web 工具。产品 HTTP 不是智能体工具。

**只靠 profile 里的 `proxy-fallback.mjs` 包装。** 否决为产品路径：家目录插入不会进入每个 profile，也不能驱动设置行，更不能包装 Tauri `ureq`。官方插件遵守该插入文档中的约束（不得碰工具），并在 `dsh-base` 中取代它。残留的 profile 插入会双重包装 `fetch`；加载本包后应去掉该行。

**为代理端口行新建客户端插件包。** 否决：该行是无主产品 chrome，与「检查更新」一样，留在 `ui-settings-general`。

**给每个子进程设置 `HTTP_PROXY`。** 否决为默认：shell 工具保留自己的环境。进程 `fetch` 和桌面更新器才是产品 HTTP 路径。

**用浏览器 `fetch` 做检查更新。** 否决：WebView 无法把 NSIS 安装包写进安装目录；发现与下载留在 Rust。

## 后果

设置里只需改一次 mixed 端口。Harness 自有 Node HTTP 和桌面更新检查共用该端口。Web 工具仍按阶段门控。若 `~/.dsh/profiles/web/proxy-fallback.mjs` 仍被插入，应去掉该行，以免请求被代理两次。

## 测试

包测试覆盖 skip/NO_PROXY、直连再代理包装（传输失败、超时、调用方中止、HTTP 状态、组合错误）、undici HTTP 正向代理、无 settings 的 apply、settings 端口热更新、非法 config，以及空 invariant companion。`ui-settings-general` 测试覆盖代理端口行，以及存在 `settingsScope` 时的 `proxy-port` 注册。桌面 `update` 单元测试覆盖端口解析（环境变量、URL、YAML、默认值）和回环跳过。不要为证明这条路径去加 web-tool e2e 或改 anchored-standard tool-bootstrap。

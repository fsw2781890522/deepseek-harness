# `@deepseek-ai/dsh-http-proxy`

[English](README.md) | 中文

Harness 与桌面更新器的进程 HTTP：先直连目标，失败后再经 `127.0.0.1` 上的本地 HTTP 代理重试。默认端口为 `7897`，可在设置里以**代理端口**编辑。本插件包装 Node 进程的 `globalThis.fetch`。它不注册、启用或禁用任何智能体工具。`web_search`、`web_fetch` 和 `tool-web` 仍由当前 agent preset 调度器决定，包括这些工具被禁用的 session 阶段。

「检查更新」是产品 HTTP。即使 web 工具被禁用，它也仍然可用。Tauri 更新器通过 Rust `ureq` 联网，不走本包装；它从 `$DSH_HOME/settings.yaml`（默认 `~/.dsh/settings.yaml`）读取同一 `http-proxy.port` 字段，并使用同一套直连再代理规则。决策记录：[HTTP 代理回退 Agent Note](../../../.agents/notes/implemented/feature/2026-08-16-http-proxy-fallback.md)。

## 配置

```yaml
- id: http-proxy
  name: '@deepseek-ai/dsh-http-proxy'
  config:
    port: 7897           # optional composition default; Settings overrides it
    directTimeoutMs: 5000
```

`port` 必须是 1–65535 的整数。`directTimeoutMs` 必须是正整数。二者在出现且非法时使插件加载失败。`dsh-base` patch 省略 `config`，因此使用 schema 默认值。

## 设置

Namespace `http-proxy`，字段 `port`，即时生效。通用设置里的**代理端口**行写入该字段。没有 settings 提供方时，仍按组合默认值包装 `fetch`。

`DSH_PROXY_PORT` 或 `DSH_PROXY_URL` 只覆盖桌面更新器的端口。Node 包装跟随设置文档（以及本插件的 config），因此在设置里改端口不必重启壳。

## 语义

包装捕获当前 `globalThis.fetch`，并在插件 fiber 存活期间替换它。每个非回环请求：

1. 用 `directTimeoutMs` 的中止预算调用该捕获的 `fetch`。
2. 传输失败或该超时后，经 `http://127.0.0.1:{port}` 用 undici `ProxyAgent` 重试（HTTP origin-form 与 HTTPS CONNECT）。
3. 直连路径上的 HTTP 状态（含 4xx/5xx）原样返回——那不是传输失败。

回环主机（`localhost`、`127.0.0.1`、`::1`、IPv4 映射回环）以及 `NO_PROXY` / `no_proxy` 中的名字从不走代理路径。调用方 `AbortSignal` 中止不重试。卸载插件时，若当前 `fetch` 仍是本包装，则恢复捕获的 `fetch`。

本插件从不给子进程设置 `HTTP_PROXY` / `HTTPS_PROXY`。Shell 工具保留自己的环境。

仍插入 `proxy-fallback.mjs` 的 profile 会再次包装 `fetch`。本包进入组合后应去掉该 profile 行，以免每个请求被代理两次。

## 模型体验

无。该插件只包装进程 HTTP 并存储本地代理端口；它不注册工具、提示词或 session 事件。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **不包装子进程 HTTP** — bash 和 pwsh 保留自己的环境。本插件只包装 harness 自有 HTTP 使用的 Node 进程 `fetch`（LLM 适配器、在该工具启用时的 web-fetch-http、调用 `fetch` 的 Host RPC）。
- **残留的 profile `proxy-fallback` 插入会双重包装 `fetch`** — 一旦 `@deepseek-ai/dsh-http-proxy` 出现在 base patch 上，卸掉该行。官方插件不注册也不开关工具，与该插入文档中的约束一致。
- **桌面更新器不共享本包装** — Tauri `ureq` 无法调用 Node `fetch`。它独立读取 `http-proxy.port`，并应用同一套直连再代理规则。

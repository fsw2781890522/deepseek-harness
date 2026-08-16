# `@deepseek-ai/dsh-http-proxy`

English | [中文](README.zh.md)

Process HTTP for the harness and the desktop updater: try the destination directly, then retry through a local HTTP proxy on `127.0.0.1`. The default port is `7897` and is editable in Settings as **代理端口**. This plugin wraps `globalThis.fetch` in the Node process. It does not register, enable, or disable any agent tool. `web_search`, `web_fetch`, and `tool-web` stay under the active agent preset scheduler, including phases that disable those tools.

Check for updates is product HTTP. It remains available when web tools are disabled. The Tauri updater talks to the network through Rust `ureq`, not this wrapper; it reads the same `http-proxy.port` field from `$DSH_HOME/settings.yaml` (default `~/.dsh/settings.yaml`) and applies the same direct-then-proxy rule. Decision record: [the HTTP proxy fallback Agent Note](../../../.agents/notes/implemented/feature/2026-08-16-http-proxy-fallback.md).

## Config

```yaml
- id: http-proxy
  name: '@deepseek-ai/dsh-http-proxy'
  config:
    port: 7897           # optional composition default; Settings overrides it
    directTimeoutMs: 5000
```

`port` must be an integer 1–65535. `directTimeoutMs` must be a positive integer. Both fail plugin load when present and invalid. The `dsh-base` patch omits `config` so the schema defaults apply.

## Settings

Namespace `http-proxy`, field `port`, live. The General **代理端口** row writes it. A missing settings provider still wraps `fetch` at the composition default.

`DSH_PROXY_PORT` or `DSH_PROXY_URL` override the port for the desktop updater only. The Node wrapper follows the settings document (and this plugin's config) so a Settings edit takes effect without restarting the shell.

## Semantics

The wrapper captures the current `globalThis.fetch` and replaces it for the plugin fiber. Each non-loopback request:

1. Calls that captured `fetch` with an abort budget of `directTimeoutMs`.
2. On a transport failure or that timeout, retries through `http://127.0.0.1:{port}` using undici `ProxyAgent` (HTTP origin-form and HTTPS CONNECT).
3. Leaves HTTP status responses (including 4xx/5xx) on the direct path — those are not transport failures.

Loopback hosts (`localhost`, `127.0.0.1`, `::1`, IPv4-mapped loopback) and names listed in `NO_PROXY` / `no_proxy` never take the proxy path. Caller `AbortSignal` abort does not retry. Disposing the plugin restores the captured `fetch` when it is still this wrapper.

The plugin never sets `HTTP_PROXY` / `HTTPS_PROXY` on child processes. Shell tools keep their own environment.

A profile that still inserts `proxy-fallback.mjs` wraps `fetch` a second time. Remove that profile row after this package is composed so each request is not proxied twice.

## Model Experience

None, as the plugin only wraps process HTTP and stores a local proxy port; it registers no tools, prompts, or session events.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Child-process HTTP is not wrapped** — bash and pwsh keep their own environment. This plugin only wraps the Node process `fetch` used by harness-owned HTTP (LLM adapters, web-fetch-http when that tool is enabled, Host RPCs that call `fetch`).
- **A leftover profile `proxy-fallback` insert double-wraps `fetch`** — uninstall that row once `@deepseek-ai/dsh-http-proxy` is on the base patch. The official plugin does not register or toggle tools, matching that insert's documented constraint.
- **The desktop updater does not share this wrapper** — Tauri `ureq` cannot call Node `fetch`. It independently reads `http-proxy.port` and applies the same direct-then-proxy rule.

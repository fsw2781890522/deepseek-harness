# Agent Note: Process HTTP proxy fallback outside the agent tool plane

Status: implemented

English | [中文](2026-08-16-http-proxy-fallback.zh.md)

## Problem

Harness-owned HTTP (LLM adapters, Host `fetch`, and the desktop updater) must reach the public internet on hosts that only have a local mixed-port proxy such as Clash on `127.0.0.1:7897`. Wrapping that path through `tool-web` / `web_search` / `web_fetch` would couple product HTTP to the agent preset scheduler: those tools are disabled in some session phases, and that disablement is correct. Check for updates is app behavior and must keep working when web tools are off. The Tauri updater uses Rust `ureq`, so a Node `fetch` wrapper alone cannot fix Settings "检查更新".

## Decision

`@deepseek-ai/dsh-http-proxy` (`packages/boot/http-proxy`) wraps `globalThis.fetch` in the Node process: direct first, then `http://127.0.0.1:{port}` through undici `ProxyAgent`. It registers settings namespace `http-proxy` with field `port` (default `7897`, live). It does not register, enable, or disable any tool. Agent tool availability stays with the active agent preset, including phases that disable `web_search` / `web_fetch` / `tool-web`.

`dsh-base` inserts the plugin after the settings row so CLI, Web, and headless share the wrapper. `ui-settings-general` registers ownerless General item `proxy-port` (order 80) once `settingsScope` exists. The row writes `http-proxy.port` and states that it does not change which agent tools are available.

The desktop updater in `dsh-desktop` `update.rs` applies the same direct-then-proxy rule in `ureq` (5s connect / 8s direct overall, then proxy). Port resolution is `DSH_PROXY_PORT`, then `DSH_PROXY_URL`, then `http-proxy.port` in `$DSH_HOME/settings.yaml` or `~/.dsh/settings.yaml`, then `7897`. Loopback URLs and `file:` paths do not use the proxy. Check for updates does not call `tool-web` and is not gated on session phase or tool-bootstrap.

Loopback hosts and `NO_PROXY` / `no_proxy` skip the Node proxy path. The plugin does not export `HTTP_PROXY` into bash/pwsh children.

## Alternatives considered

**Enable `tool-web` whenever the updater or LLM needs the network.** Rejected: tool enablement is owned by the anchored-standard preset scheduler. Some phases disable web tools on purpose. Product HTTP is not an agent tool.

**Register the wrapper from a profile `proxy-fallback.mjs` only.** Rejected as the product path: a home-directory insert is not composed for every profile, does not drive the Settings row, and cannot wrap Tauri `ureq`. The official plugin matches that insert's documented constraint (it must not touch tools) and replaces it in `dsh-base`. A leftover profile insert double-wraps `fetch`; remove it after this package is loaded.

**A new client plugin package for the Proxy port row.** Rejected: the row is ownerless product chrome, like Check for updates, so it stays in `ui-settings-general`.

**Set `HTTP_PROXY` on every child process.** Rejected as the default: shell tools keep their own environment. Process `fetch` and the desktop updater are the product HTTP paths.

**Browser `fetch` for Check for updates.** Rejected: the WebView cannot write the NSIS installer into the install directory; discovery and download stay in Rust.

## Consequences

Settings can set the mixed-port once. Harness-owned Node HTTP and desktop update checks share that port. Web tools remain phase-gated. A user who still has `~/.dsh/profiles/web/proxy-fallback.mjs` inserted should remove that row so requests are not proxied twice.

## Testing

Package tests cover skip/NO_PROXY, direct-then-proxy wrap (transport failure, timeout, caller abort, HTTP status, combined errors), undici HTTP forward-proxy, apply without settings, live settings port change, invalid config, and the empty invariant companion. `ui-settings-general` tests cover the Proxy port row and `proxy-port` registration when `settingsScope` is present. Desktop `update` unit tests cover port resolution (env, URL, YAML, default) and loopback skip. Do not add web-tool e2e or change anchored-standard tool-bootstrap to prove this path.

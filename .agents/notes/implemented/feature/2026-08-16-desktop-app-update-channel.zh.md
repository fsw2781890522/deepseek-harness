# Agent Note: 桌面端更新通道

Status: implemented

[English](2026-08-16-desktop-app-update-channel.md) | 中文

## 问题

桌面包装把官方 Web UI 放进 Tauri 窗口。换产品版本必须重打 NSIS 安装包，并覆盖上一个 setup.exe。已安装的应用无法在产品内得知有更新的安装包，构造仓库也不保存带版本的产物，或应用可以拉取的发现文档。

## 决策

桌面构造仓库（`dsh-desktop`）拥有更新通道。每次构建把 NSIS 安装包拷进 `releases/<version>/`，不再覆盖单一无版本文件。`releases/latest.json` 是运行中应用拉取的通道索引。schema 为 `schemaVersion: 1`，含 `channel`、`latest` 和 `releases` 日志。每个 release 带双语 `notes` 和 `windows-x64` 产物（当前 `kind` 为 `nsis`；`runtime-zip` 预留）。产物 URL 可以是 `https:`、`http:` 或 `file:`。`DSH_DESKTOP_UPDATE_MANIFEST` 覆盖已配置的清单 URL；该 URL 为空时，应用还会在可执行文件旁查找 `latest.json`。

Tauri 壳向每个 WebView 文档（闪屏和 `http://127.0.0.1`）注入 `window.__DSH_DESKTOP__`。该对象暴露 `version`、`checkUpdate()` 和 `installUpdate()`，对应 `dsh_check_update` 与 `dsh_install_update`。检查用壳的 semver 对比 `latest`。安装下载用户看到的那份产物、校验 SHA-256、静默启动 NSIS（`/S`，最后一项 `/D=` 为当前安装目录），然后退出以便安装器替换 exe。用户数据仍在 `~/.dsh`。

`ui-settings-general` 仅在该桥存在时注册通用设置项 `desktop-update`（order 90），因此普通 `dsh web` 不显示该行。该行是「检查更新」，随后是已最新 / 有更新及说明 / 错误，然后是「立即更新」。清单和安装包 HTTP 使用与 [`@deepseek-ai/dsh-http-proxy`](2026-08-16-http-proxy-fallback.md) 相同的直连再代理回退：`ureq` 先直连，再走 `DSH_PROXY_PORT` / `DSH_PROXY_URL` / `http-proxy.port`（默认 7897）上的 `http://127.0.0.1:{port}`。那是产品 HTTP，不是 `tool-web`，也不按 session 阶段门控。

## 考虑过的替代方案

**用 Tauri updater 插件作为发现协议。** 第一条通道否决：它要求自己的签名 JSON，并且仍然安装完整 NSIS。构造仓库已经按版本管理 zip+exe 树；一份自有 schema 能记录设置行要展示的更新日志，以后也可以增加 `runtime-zip` 产物而不改设置 IPC。

**为设置行新建客户端插件包。** 否决：该行是无主产品 chrome，且不得出现在桌面 WebView 之外，这与 `ui-settings-general` 的职责一致。独立包仍会打进每份 web 组合。

**只做 zip 增量替换、不要安装器。** 暂缓：只换 `bundle-runtime.zip` 可以跳过 NSIS，但 Tauri 壳变更仍需要安装器，且第一条产品入口是「新发布的安装包」。schema 保留 `kind: "runtime-zip"`，那条路径以后可以在不改设置 IPC 的情况下交付。

## 后果

浏览器 `dsh web` 不变。桌面用户可在设置中检查并安装；清单 URL 缺失或为空是明确失败，而不是静默跳过。安装包二进制不进 git；`latest.json`、说明和 SHA-256 校验和纳入跟踪。第一个具备更新器的壳是 0.2.0，因此用户能在应用内接受的第一次升级是同一通道上发布的更高版本。

## 测试

包测试覆盖带假桥的设置行（无桥则隐藏；检查和安装调用该桥；有更新时渲染说明）。桌面 `update` 单元测试覆盖 semver 比较、清单解析，以及「已最新 vs 有更新」。端到端安装是手动把 `latest.json` 和更高版本 NSIS 放到 0.2.0 应用旁。

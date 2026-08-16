/**
 * Process-wide HTTP: wrap `globalThis.fetch` so a failed direct attempt retries
 * through `http://127.0.0.1:{port}`. Registers the `http-proxy` settings
 * namespace when `ctx.settings` exists. Does not register, enable, or disable
 * any agent tool — tool availability stays with the active agent preset.
 *
 * @module @deepseek-ai/dsh-http-proxy
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  DEFAULT_DIRECT_TIMEOUT_MS,
  DEFAULT_PROXY_PORT,
  HTTP_PROXY_PORT_FIELD,
  HTTP_PROXY_SETTINGS_NAMESPACE,
  parsePort,
  proxyUrlForPort,
} from './constants.ts'
import { wrapGlobalFetch } from './fetch-fallback.ts'

export {
  DEFAULT_DIRECT_TIMEOUT_MS,
  DEFAULT_PROXY_PORT,
  HTTP_PROXY_PORT_FIELD,
  HTTP_PROXY_SETTINGS_NAMESPACE,
  parsePort,
  proxyUrlForPort,
} from './constants.ts'

/** Durable `http-proxy` section shared by Host settings and the desktop updater. */
export interface HttpProxySettings {
  /** Local HTTP proxy TCP port (Clash mixed port by default). */
  port: number
}

/** Cordis plugin name used by loader diagnostics. */
export const name = 'http-proxy'

/** Plugin config. Invalid values fail plugin load. */
export interface Config {
  /** Composition default for {@link HttpProxySettings.port} when settings has no user layer. */
  port?: number
  /** Direct-attempt abort budget in milliseconds before the proxy retry. */
  directTimeoutMs?: number
}

/** Schemastery validation for {@link Config}. */
export const Config: z<Config> = z.object({
  port: z.number().min(1).max(65535).default(DEFAULT_PROXY_PORT),
  directTimeoutMs: z.number().min(1).default(DEFAULT_DIRECT_TIMEOUT_MS),
})

const HttpProxySettingsSchema: z<HttpProxySettings> = z.object({
  [HTTP_PROXY_PORT_FIELD]: z.number().min(1).max(65535).default(DEFAULT_PROXY_PORT),
})

const NAMESPACE = settingsNamespace(HTTP_PROXY_SETTINGS_NAMESPACE)

function requirePort(label: string, value: unknown): number {
  const port = parsePort(value)
  if (port === undefined) {
    throw new TypeError(`http-proxy: ${label} must be an integer 1–65535, got ${String(value)}`)
  }
  return port
}

function requireTimeout(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new TypeError(
      `http-proxy: directTimeoutMs must be a positive integer, got ${String(value)}`,
    )
  }
  return value
}

/**
 * Wrap process `fetch` for this fiber and register the `http-proxy` section
 * when a settings provider is composed. Never touches `ctx.tools`.
 * @param ctx - plugin context; the wrapper is disposed with it.
 * @param config - composition default port and direct timeout. Omitted fields use schema defaults.
 * @throws when `port` or `directTimeoutMs` is present and invalid.
 */
export function apply(ctx: Context, config: Config = {}): void {
  const timeoutMs = config.directTimeoutMs === undefined
    ? DEFAULT_DIRECT_TIMEOUT_MS
    : requireTimeout(config.directTimeoutMs)
  let port = config.port === undefined ? DEFAULT_PROXY_PORT : requirePort('port', config.port)
  let restore: (() => void) | undefined

  const install = (): void => {
    restore?.()
    restore = wrapGlobalFetch({
      proxyUrl: proxyUrlForPort(port),
      directTimeoutMs: timeoutMs,
    })
  }

  ctx.effect(() => {
    install()
    return () => {
      restore?.()
      restore = undefined
    }
  }, 'http-proxy: wrap process fetch')

  ctx.inject(['settings'], (settingsCtx) => {
    const scope = settingsCtx.settings.register(NAMESPACE, HttpProxySettingsSchema, {
      base: { port },
    })
    const applySection = (section: HttpProxySettings): void => {
      if (section.port === port && restore !== undefined) return
      port = section.port
      install()
    }
    applySection(scope.get())
    settingsCtx.effect(
      () => scope.watch((next) => { applySection(next) }),
      'http-proxy: settings port',
    )
  })
}

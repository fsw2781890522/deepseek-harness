/**
 * Replace `globalThis.fetch` with direct-first, then local HTTP proxy.
 * Loopback and `NO_PROXY` hosts never take the proxy path. The wrapper does
 * not register, enable, or disable agent tools.
 */

import { closeProxyAgents, fetchThroughHttpProxy } from './proxy-fetch.ts'
import { shouldSkipProxy } from './skip-proxy.ts'

/** Options for {@link wrapGlobalFetch}. */
export interface FetchFallbackOptions {
  /** `http://127.0.0.1:{port}` used after a failed direct attempt. */
  proxyUrl: string
  /**
   * Budget for the direct attempt to return headers.
   * Cleared once `fetch` resolves so a long SSE body is not aborted.
   */
  directTimeoutMs: number
  /**
   * Override the loopback/`NO_PROXY` skip. Tests pass `() => false` so a
   * loopback origin can exercise the proxy path.
   */
  skipProxy?: (url: URL) => boolean
  /** Override the proxied fetch; production uses undici through {@link fetchThroughHttpProxy}. */
  proxyFetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

/**
 * Resolve the request URL for skip/fallback decisions.
 * @param input - `fetch` input.
 * @returns an absolute URL, or undefined when `fetch` must run unchanged.
 */
export function requestUrl(input: RequestInfo | URL): URL | undefined {
  try {
    if (typeof input === 'string') return new URL(input)
    if (input instanceof URL) return input
    return new URL(input.url)
  } catch {
    return undefined
  }
}

/**
 * Whether a thrown direct-attempt failure should retry through the proxy.
 * @param error - rejection from the original `fetch`.
 * @returns whether the failure is a transport error rather than a caller abort.
 */
export function isRetryableNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true
  if (error instanceof DOMException && error.name === 'TimeoutError') return true
  const code = errorCode(error)
  return code === 'ETIMEDOUT'
    || code === 'ECONNREFUSED'
    || code === 'ECONNRESET'
    || code === 'ENOTFOUND'
    || code === 'EAI_AGAIN'
    || code === 'ENETUNREACH'
    || code === 'EHOSTUNREACH'
    || code === 'EPIPE'
    || code === 'UND_ERR_CONNECT_TIMEOUT'
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  if ('code' in error && typeof error.code === 'string') return error.code
  if ('cause' in error) return errorCode(error.cause)
  return undefined
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Install the direct-then-proxy `fetch` wrapper. The disposer restores the
 * captured `fetch` only when it is still this wrapper.
 * @param options - proxy URL, direct timeout, and test overrides.
 * @returns disposer that unwraps `fetch` and closes cached proxy agents.
 */
export function wrapGlobalFetch(options: FetchFallbackOptions): () => void {
  const original = globalThis.fetch
  const skip = options.skipProxy ?? ((url: URL) => shouldSkipProxy(url))
  const proxyFetch = options.proxyFetch
    ?? ((input, init) => fetchThroughHttpProxy(input, init, options.proxyUrl))

  const wrapped: typeof fetch = async (input, init) => {
    const url = requestUrl(input)
    if (url === undefined || skip(url)) return await original(input, init)

    const connect = new AbortController()
    const timer = setTimeout(() => {
      connect.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
    }, options.directTimeoutMs)
    const userSignal = init?.signal
    const signal = userSignal === undefined || userSignal === null
      ? connect.signal
      : AbortSignal.any([userSignal, connect.signal])
    try {
      return await original(input, { ...init, signal })
    } catch (error: unknown) {
      if (userSignal?.aborted === true) throw error
      const timedOut = connect.signal.aborted
      if (!timedOut && !isRetryableNetworkError(error)) throw error
      try {
        return await proxyFetch(input, init)
      } catch (proxyError: unknown) {
        throw new TypeError(
          `${errorText(error)}; proxy ${options.proxyUrl} also failed: ${errorText(proxyError)}`,
          { cause: proxyError },
        )
      }
    } finally {
      clearTimeout(timer)
    }
  }

  globalThis.fetch = wrapped
  return () => {
    if (globalThis.fetch === wrapped) globalThis.fetch = original
    void closeProxyAgents()
  }
}

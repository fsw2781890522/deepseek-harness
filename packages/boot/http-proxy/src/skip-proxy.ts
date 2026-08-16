/**
 * Hosts that must not use the local HTTP proxy even after a direct failure.
 * Loopback traffic is the Host itself; `NO_PROXY` / `no_proxy` is the usual
 * process exception list.
 */

/**
 * Whether a hostname is the current process's loopback identity.
 * @param hostname - `URL.hostname` (no brackets on IPv6).
 * @returns whether the host is loopback.
 */
export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  return host === 'localhost'
    || host === '127.0.0.1'
    || host === '::1'
    || host === '0.0.0.0'
    || host === '::ffff:127.0.0.1'
}

/**
 * Whether `NO_PROXY` lists this hostname (`*` or an exact/suffix match).
 * @param hostname - `URL.hostname`.
 * @param noProxy - comma/space-separated exception list.
 * @returns whether the host is excluded from proxying.
 */
export function hostnameMatchesNoProxy(hostname: string, noProxy: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  for (const item of noProxy.split(/[\s,]+/)) {
    const rule = item.trim().toLowerCase()
    if (rule === '') continue
    if (rule === '*') return true
    const suffix = rule.replace(/^\./, '')
    if (host === suffix || host.endsWith(`.${suffix}`)) return true
  }
  return false
}

/**
 * Whether a request must skip the proxy fallback and use the original fetch only.
 * @param url - absolute request URL.
 * @param noProxy - exception list; defaults to `NO_PROXY` then `no_proxy`.
 * @returns whether the wrapper must not retry through the local proxy.
 */
export function shouldSkipProxy(url: URL, noProxy?: string): boolean {
  const list = noProxy ?? process.env.NO_PROXY ?? process.env.no_proxy ?? ''
  return isLoopbackHostname(url.hostname) || hostnameMatchesNoProxy(url.hostname, list)
}

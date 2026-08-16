/**
 * One HTTP(S) request through a local HTTP forward proxy. Uses undici's
 * ProxyAgent so CONNECT (HTTPS) and origin-form (HTTP) stay in maintained
 * code. Agents are reused per proxy URL and closed when the fetch wrapper
 * uninstalls.
 */

import { fetch as undiciFetch, ProxyAgent } from 'undici'

const agents = new Map<string, ProxyAgent>()

function dispatcherFor(proxyUrl: string): ProxyAgent {
  const existing = agents.get(proxyUrl)
  if (existing !== undefined) return existing
  const created = new ProxyAgent(proxyUrl)
  agents.set(proxyUrl, created)
  return created
}

/**
 * Fetch `input` using `proxyUrl` as an HTTP proxy, bypassing `globalThis.fetch`.
 * @param input - same first argument as `fetch`.
 * @param init - same init as `fetch`.
 * @param proxyUrl - `http://127.0.0.1:{port}`.
 * @returns the proxied response.
 */
export async function fetchThroughHttpProxy(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  proxyUrl: string,
): Promise<Response> {
  const dispatcher = dispatcherFor(proxyUrl)
  return await undiciFetch(input as Parameters<typeof undiciFetch>[0], {
    ...(init as object),
    dispatcher,
  }) as unknown as Response
}

/**
 * Close cached proxy dispatchers. In-flight bodies after this call may abort.
 * @returns settlement after every cached agent closes.
 */
export async function closeProxyAgents(): Promise<void> {
  const pending = [...agents.values()].map(agent => agent.close())
  agents.clear()
  await Promise.all(pending)
}

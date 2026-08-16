/** Settings namespace written by the General Proxy port row and read by process HTTP plus the desktop updater. */
export const HTTP_PROXY_SETTINGS_NAMESPACE = 'http-proxy'

/** Field carrying the local HTTP proxy TCP port. */
export const HTTP_PROXY_PORT_FIELD = 'port'

/** Default Clash/V2Ray mixed port when the user-settings document has no override. */
export const DEFAULT_PROXY_PORT = 7897

/** Direct-attempt budget before the wrapper retries through the local proxy. */
export const DEFAULT_DIRECT_TIMEOUT_MS = 5000

/**
 * Whether a value is a TCP port the wrapper and Settings row both accept.
 * @param value - candidate from config, settings, or user input.
 * @returns whether the value is an integer in 1–65535.
 */
export function isValidPort(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535
}

/**
 * Narrow a config, settings, or environment value to a TCP port.
 * @param value - number or decimal digit string.
 * @returns the port, or undefined when the value is not a valid port.
 */
export function parsePort(value: unknown): number | undefined {
  if (isValidPort(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const port = Number(value.trim())
    if (isValidPort(port)) return port
  }
  return undefined
}

/**
 * Loopback HTTP proxy URL for one TCP port.
 * @param port - already-validated TCP port.
 * @returns `http://127.0.0.1:{port}`.
 */
export function proxyUrlForPort(port: number): string {
  return `http://127.0.0.1:${String(port)}`
}

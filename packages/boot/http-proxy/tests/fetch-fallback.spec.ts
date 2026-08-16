import { afterEach, describe, expect, it, vi } from 'vitest'
import { wrapGlobalFetch } from '../src/fetch-fallback.ts'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('wrapGlobalFetch', () => {
  it('uses the original fetch for loopback and restores on dispose', async () => {
    const direct = vi.fn(async () => new Response('local'))
    globalThis.fetch = direct
    const restore = wrapGlobalFetch({
      proxyUrl: 'http://127.0.0.1:9',
      directTimeoutMs: 50,
      proxyFetch: async () => new Response('proxied'),
    })
    const response = await fetch('http://127.0.0.1:9/health')
    expect(await response.text()).toBe('local')
    expect(direct).toHaveBeenCalledOnce()
    restore()
    expect(globalThis.fetch).toBe(direct)
  })

  it('retries through the proxy after a direct transport failure', async () => {
    const proxyFetch = vi.fn(async () => new Response('proxied'))
    globalThis.fetch = async () => {
      throw new TypeError('fetch failed')
    }
    wrapGlobalFetch({
      proxyUrl: 'http://127.0.0.1:7897',
      directTimeoutMs: 50,
      skipProxy: () => false,
      proxyFetch,
    })
    const response = await fetch('https://example.com/latest.json')
    expect(await response.text()).toBe('proxied')
    expect(proxyFetch).toHaveBeenCalledOnce()
  })

  it('retries through the proxy after the direct timeout', async () => {
    const proxyFetch = vi.fn(async () => new Response('late'))
    globalThis.fetch = async (_input, init) => {
      await new Promise<void>((resolve, reject) => {
        const signal = init?.signal
        if (signal == null) {
          resolve()
          return
        }
        signal.addEventListener('abort', () => {
          reject(signal.reason instanceof Error
            ? signal.reason
            : new DOMException('Aborted', 'AbortError'))
        })
      })
      return new Response('too late')
    }
    wrapGlobalFetch({
      proxyUrl: 'http://127.0.0.1:7897',
      directTimeoutMs: 20,
      skipProxy: () => false,
      proxyFetch,
    })
    const response = await fetch('https://example.com/slow')
    expect(await response.text()).toBe('late')
    expect(proxyFetch).toHaveBeenCalledOnce()
  })

  it('does not proxy a caller abort', async () => {
    const proxyFetch = vi.fn(async () => new Response('proxied'))
    globalThis.fetch = async (_input, init) => {
      await new Promise<void>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
      return new Response('no')
    }
    wrapGlobalFetch({
      proxyUrl: 'http://127.0.0.1:7897',
      directTimeoutMs: 5_000,
      skipProxy: () => false,
      proxyFetch,
    })
    const controller = new AbortController()
    const pending = fetch('https://example.com/x', { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toThrow()
    expect(proxyFetch).not.toHaveBeenCalled()
  })

  it('returns a direct HTTP error without retrying', async () => {
    const proxyFetch = vi.fn(async () => new Response('proxied'))
    globalThis.fetch = async () => new Response('nope', { status: 500 })
    wrapGlobalFetch({
      proxyUrl: 'http://127.0.0.1:7897',
      directTimeoutMs: 50,
      skipProxy: () => false,
      proxyFetch,
    })
    const response = await fetch('https://example.com/fail')
    expect(response.status).toBe(500)
    expect(proxyFetch).not.toHaveBeenCalled()
  })

  it('does not retry a non-transport error before timeout', async () => {
    const proxyFetch = vi.fn(async () => new Response('proxied'))
    globalThis.fetch = async () => {
      throw new Error('HTTP 401')
    }
    wrapGlobalFetch({
      proxyUrl: 'http://127.0.0.1:7897',
      directTimeoutMs: 50,
      skipProxy: () => false,
      proxyFetch,
    })
    await expect(fetch('https://example.com/auth')).rejects.toThrow('HTTP 401')
    expect(proxyFetch).not.toHaveBeenCalled()
  })

  it('combines direct and proxy failures', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('direct boom')
    }
    wrapGlobalFetch({
      proxyUrl: 'http://127.0.0.1:7897',
      directTimeoutMs: 50,
      skipProxy: () => false,
      proxyFetch: async () => {
        throw new TypeError('proxy boom')
      },
    })
    await expect(fetch('https://example.com/x')).rejects.toThrow(
      /direct boom; proxy http:\/\/127.0.0.1:7897 also failed: proxy boom/,
    )
  })

  it('stringifies a non-Error proxy failure', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('direct boom')
    }
    wrapGlobalFetch({
      proxyUrl: 'http://127.0.0.1:7897',
      directTimeoutMs: 50,
      skipProxy: () => false,
      proxyFetch: async () => {
        throw { toString: () => 'proxy boom' }
      },
    })
    await expect(fetch('https://example.com/x')).rejects.toThrow(
      /direct boom; proxy http:\/\/127.0.0.1:7897 also failed: proxy boom/,
    )
  })

  it('uses the default proxy fetch after a direct failure', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('direct boom')
    }
    wrapGlobalFetch({
      proxyUrl: 'not-a-proxy',
      directTimeoutMs: 50,
      skipProxy: () => false,
    })
    await expect(fetch('https://example.com/x')).rejects.toThrow(/proxy not-a-proxy also failed/)
  })

  it('treats a null caller signal as absent', async () => {
    globalThis.fetch = async () => new Response('ok')
    wrapGlobalFetch({
      proxyUrl: 'http://127.0.0.1:7897',
      directTimeoutMs: 50,
      skipProxy: () => false,
      proxyFetch: async () => new Response('proxied'),
    })
    const response = await fetch('https://example.com/x', { signal: null })
    expect(await response.text()).toBe('ok')
  })

  it('passes relative URLs through unchanged', async () => {
    const direct = vi.fn(async () => new Response('relative'))
    globalThis.fetch = direct
    wrapGlobalFetch({
      proxyUrl: 'http://127.0.0.1:7897',
      directTimeoutMs: 50,
      proxyFetch: async () => new Response('proxied'),
    })
    const response = await fetch('/local')
    expect(await response.text()).toBe('relative')
  })

  it('leaves fetch alone when dispose runs after a later wrap', () => {
    const first = vi.fn(async () => new Response('a'))
    globalThis.fetch = first
    const restore = wrapGlobalFetch({
      proxyUrl: 'http://127.0.0.1:1',
      directTimeoutMs: 50,
    })
    const second = vi.fn(async () => new Response('b'))
    globalThis.fetch = second
    restore()
    expect(globalThis.fetch).toBe(second)
  })
})

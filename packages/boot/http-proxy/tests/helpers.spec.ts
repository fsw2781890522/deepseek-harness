import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROXY_PORT,
  isValidPort,
  parsePort,
  proxyUrlForPort,
} from '../src/constants.ts'
import {
  hostnameMatchesNoProxy,
  isLoopbackHostname,
  shouldSkipProxy,
} from '../src/skip-proxy.ts'
import { isRetryableNetworkError, requestUrl } from '../src/fetch-fallback.ts'

describe('http-proxy constants', () => {
  it('accepts TCP ports and rejects the rest', () => {
    expect(isValidPort(DEFAULT_PROXY_PORT)).toBe(true)
    expect(isValidPort(1)).toBe(true)
    expect(isValidPort(65535)).toBe(true)
    expect(isValidPort(0)).toBe(false)
    expect(isValidPort(65536)).toBe(false)
    expect(isValidPort(1.5)).toBe(false)
    expect(parsePort('8118')).toBe(8118)
    expect(parsePort(' 9050 ')).toBe(9050)
    expect(parsePort('0')).toBeUndefined()
    expect(parsePort('65536')).toBeUndefined()
    expect(parsePort(8.2)).toBeUndefined()
    expect(proxyUrlForPort(7897)).toBe('http://127.0.0.1:7897')
  })
})

describe('http-proxy skip list', () => {
  it('treats loopback identities as local', () => {
    expect(isLoopbackHostname('localhost')).toBe(true)
    expect(isLoopbackHostname('127.0.0.1')).toBe(true)
    expect(isLoopbackHostname('[::1]')).toBe(true)
    expect(isLoopbackHostname('::1')).toBe(true)
    expect(isLoopbackHostname('::ffff:127.0.0.1')).toBe(true)
    expect(isLoopbackHostname('0.0.0.0')).toBe(true)
    expect(isLoopbackHostname('example.com')).toBe(false)
  })

  it('matches NO_PROXY exact names, suffixes, and *', () => {
    expect(hostnameMatchesNoProxy('api.github.com', 'github.com')).toBe(true)
    expect(hostnameMatchesNoProxy('github.com', '.github.com')).toBe(true)
    expect(hostnameMatchesNoProxy('raw.githubusercontent.com', 'example.com, githubusercontent.com')).toBe(true)
    expect(hostnameMatchesNoProxy('example.com', '*')).toBe(true)
    expect(hostnameMatchesNoProxy('example.com', ' , ')).toBe(false)
    expect(hostnameMatchesNoProxy('example.com', '')).toBe(false)
    expect(hostnameMatchesNoProxy('evil.com', 'github.com')).toBe(false)
  })

  it('skips loopback and NO_PROXY hosts', () => {
    expect(shouldSkipProxy(new URL('http://127.0.0.1:9/x'), '')).toBe(true)
    expect(shouldSkipProxy(new URL('https://raw.githubusercontent.com/x'), 'githubusercontent.com')).toBe(true)
    expect(shouldSkipProxy(new URL('https://raw.githubusercontent.com/x'), '')).toBe(false)
    const previous = process.env.NO_PROXY
    process.env.NO_PROXY = 'example.com'
    try {
      expect(shouldSkipProxy(new URL('https://example.com/x'))).toBe(true)
    } finally {
      if (previous === undefined) delete process.env.NO_PROXY
      else process.env.NO_PROXY = previous
    }
    const previousNo = process.env.NO_PROXY
    const previousLow = process.env.no_proxy
    delete process.env.NO_PROXY
    process.env.no_proxy = 'example.com'
    try {
      expect(shouldSkipProxy(new URL('https://example.com/x'))).toBe(true)
    } finally {
      if (previousNo === undefined) delete process.env.NO_PROXY
      else process.env.NO_PROXY = previousNo
      if (previousLow === undefined) delete process.env.no_proxy
      else process.env.no_proxy = previousLow
    }
  })
})

describe('http-proxy fetch helpers', () => {
  it('parses fetch inputs and classifies transport errors', () => {
    expect(requestUrl('https://example.com/a')?.href).toBe('https://example.com/a')
    expect(requestUrl(new URL('https://example.com/b'))?.href).toBe('https://example.com/b')
    expect(requestUrl(new Request('https://example.com/c'))?.href).toBe('https://example.com/c')
    expect(requestUrl('/relative')).toBeUndefined()
    expect(isRetryableNetworkError(new TypeError('fetch failed'))).toBe(true)
    expect(isRetryableNetworkError(new DOMException('timed out', 'TimeoutError'))).toBe(true)
    expect(isRetryableNetworkError(Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }))).toBe(true)
    expect(isRetryableNetworkError(Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }))).toBe(true)
    expect(isRetryableNetworkError(Object.assign(new Error('wrap'), {
      cause: Object.assign(new Error('reset'), { code: 'ECONNRESET' }),
    }))).toBe(true)
    expect(isRetryableNetworkError(Object.assign(new Error('dns'), { code: 'ENOTFOUND' }))).toBe(true)
    expect(isRetryableNetworkError(Object.assign(new Error('again'), { code: 'EAI_AGAIN' }))).toBe(true)
    expect(isRetryableNetworkError(Object.assign(new Error('net'), { code: 'ENETUNREACH' }))).toBe(true)
    expect(isRetryableNetworkError(Object.assign(new Error('host'), { code: 'EHOSTUNREACH' }))).toBe(true)
    expect(isRetryableNetworkError(Object.assign(new Error('pipe'), { code: 'EPIPE' }))).toBe(true)
    expect(isRetryableNetworkError(Object.assign(new Error('undici'), { code: 'UND_ERR_CONNECT_TIMEOUT' }))).toBe(true)
    expect(isRetryableNetworkError(new Error('HTTP 500'))).toBe(false)
    expect(isRetryableNetworkError(Object.assign(new Error('numeric'), { code: 42 }))).toBe(false)
    expect(isRetryableNetworkError(Object.assign(new Error('cause'), { cause: 'x' }))).toBe(false)
    expect(isRetryableNetworkError('string')).toBe(false)
    expect(isRetryableNetworkError(null)).toBe(false)
  })
})

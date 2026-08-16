import http from 'node:http'
import net from 'node:net'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { closeProxyAgents, fetchThroughHttpProxy } from '../src/proxy-fetch.ts'

const servers: http.Server[] = []

afterEach(async () => {
  await closeProxyAgents()
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error)
      else resolve()
    })
  })))
})

function listen(server: http.Server): Promise<number> {
  servers.push(server)
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      resolve((server.address() as AddressInfo).port)
    })
  })
}

describe('fetchThroughHttpProxy', () => {
  it('forwards HTTP through a local proxy and reuses the agent', async () => {
    const target = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end(`hit ${req.url}`)
    })
    const targetPort = await listen(target)
    let proxied = 0
    const proxy = http.createServer((req, res) => {
      proxied += 1
      const url = new URL(req.url ?? '', 'http://127.0.0.1')
      const upstream = http.request({
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: req.method,
        headers: { host: url.host },
      }, (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers)
        up.pipe(res)
      })
      upstream.on('error', (error) => {
        res.writeHead(502)
        res.end(String(error))
      })
      req.pipe(upstream)
    })
    proxy.on('connect', (req, clientSocket, head) => {
      proxied += 1
      const [hostname, portText] = (req.url ?? '').split(':')
      const upstream = net.connect(Number(portText), hostname, () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        if (head.length > 0) upstream.write(head)
        upstream.pipe(clientSocket)
        clientSocket.pipe(upstream)
      })
      upstream.on('error', () => { clientSocket.end() })
      clientSocket.on('error', () => { upstream.end() })
    })
    const proxyPort = await listen(proxy)
    const proxyUrl = `http://127.0.0.1:${String(proxyPort)}`
    const first = await fetchThroughHttpProxy(
      `http://127.0.0.1:${String(targetPort)}/one`,
      undefined,
      proxyUrl,
    )
    const second = await fetchThroughHttpProxy(
      `http://127.0.0.1:${String(targetPort)}/two`,
      { method: 'GET' },
      proxyUrl,
    )
    expect(await first.text()).toBe('hit /one')
    expect(await second.text()).toBe('hit /two')
    expect(proxied).toBe(2)
  }, 10_000)

  it('rejects an unusable proxy URL', async () => {
    await expect(fetchThroughHttpProxy('http://example.com/', undefined, 'not-a-proxy'))
      .rejects.toThrow()
  })
})

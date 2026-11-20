import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createAtlasReader } from './catalog.mjs'

const port = Number(process.argv[2] || 4395)
const origin = 'http://127.0.0.1:' + port
const readAtlas = createAtlasReader()
const assets = new Map([
  ['/client/atlas.js', 'text/javascript'],
  ['/client/scope.js', 'text/javascript'],
  ['/client/sphere.js', 'text/javascript'],
  ['/client/preview.js', 'text/javascript'],
  ['/client/atlas.css', 'text/css'],
  ['/dist/quartz-graph.js', 'text/javascript'],
])

createServer(async (req, res) => {
  const send = (status, type, payload) => {
    res.writeHead(status, {
      'Content-Type': type + '; charset=utf-8',
      'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'; base-uri 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    }).end(payload)
  }
  if (req.method !== 'GET' || req.headers.host !== '127.0.0.1:' + port ||
      (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))) {
    return send(403, 'text/plain', 'Forbidden')
  }
  const url = new URL(req.url, origin)
  if (url.pathname === '/atlas') {
    const input = {
      selected: url.searchParams.get('selected')?.slice(0, 48),
      query: url.searchParams.get('query')?.slice(0, 120),
      includeGraph: url.searchParams.get('includeGraph') === 'true',
    }
    return send(200, 'application/json', JSON.stringify(await readAtlas(input)))
  }
  if (url.pathname === '/') {
    return send(200, 'text/html', '<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>知识图谱</title><link rel="stylesheet" href="/client/atlas.css"><body class="atlas-preview"><div id="root"></div><script type="module" src="/client/preview.js"></script></body></html>')
  }
  const type = assets.get(url.pathname)
  if (type) {
    try {
      return send(200, type, await readFile(new URL('.' + url.pathname, import.meta.url)))
    } catch {}
  }
  return send(404, 'text/plain', 'Not found')
}).listen(port, '127.0.0.1', () => console.log(origin))

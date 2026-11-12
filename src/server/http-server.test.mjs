import assert from 'node:assert/strict'
import http from 'node:http'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { startServer } from './http-server.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
/** Well away from the plugin's and the demo's ports, so a running copy is not in the way. */
const FIRST_PORT = 48_650

/** Starts a server on a free port with a stand-in controller, and closes it after the test. */
async function setup(t, { lan = false } = {}) {
  const calls = []
  const controller = {
    getState: () => ({ rooms: [] }),
    refresh: async () => ({ rooms: [] }),
    setTheme: async (id) => calls.push(['theme', id]),
    setRoomTheme: async () => {},
    setRoomHidden: async () => {}
  }
  const server = await startServer({ root: ROOT, port: FIRST_PORT, lan, controller })
  t.after(() => server.close())
  return { server, calls }
}

/** A raw request, so the path and headers reach the server exactly as written. */
function request(server, target, { method = 'GET', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const outgoing = http.request({ host: '127.0.0.1', port: server.port, path: target, method, headers }, (incoming) => {
      let text = ''
      incoming.on('data', (chunk) => (text += chunk))
      incoming.on('end', () => resolve({ status: incoming.statusCode, headers: incoming.headers, text }))
    })
    outgoing.on('error', reject)
    outgoing.end(body)
  })
}

test('the page and its files are served, with a policy on the page', async (t) => {
  const { server } = await setup(t)
  const page = await request(server, '/')
  assert.equal(page.status, 200)
  assert.match(page.headers['content-security-policy'], /script-src 'self'/)
  assert.equal(page.headers['x-content-type-options'], 'nosniff')

  const style = await request(server, '/ui/stage.css')
  assert.equal(style.status, 200)
  assert.match(style.headers['content-security-policy'], /default-src 'none'.*sandbox/)
})

test('a path with an encoded NUL character is refused and the server keeps answering', async (t) => {
  const { server } = await setup(t)
  assert.equal((await request(server, '/ui/%00')).status, 400)
  assert.equal((await request(server, '/themes/%00/theme.json')).status, 400)
  assert.equal((await request(server, '/api/state')).status, 200)
})

test('closing does not wait for a request that never finishes', async (t) => {
  const { server } = await setup(t)
  const stuck = http.request({ host: '127.0.0.1', port: server.port, path: '/api/theme', method: 'POST',
    headers: { 'content-length': 100 } })
  stuck.on('error', () => {})
  stuck.write('{')
  await new Promise((resolve) => setTimeout(resolve, 50))
  const startedAt = Date.now()
  await server.close()
  assert.ok(Date.now() - startedAt < 2000)
})

test('a malformed path is refused', async (t) => {
  const { server } = await setup(t)
  assert.equal((await request(server, '/%E0%A4%A')).status, 400)
})

test('nothing outside ui/ and themes/ is served', async (t) => {
  const { server } = await setup(t)
  for (const target of ['/package.json', '/src/worker.mjs', '/ui/../package.json', '/ui/%2e%2e/package.json',
    '/ui/..%2fpackage.json', '/ui/..%5cpackage.json', '/themes/../../etc/hosts']) {
    const { status } = await request(server, target)
    assert.ok(status === 403 || status === 404, `${target} answered ${status}`)
  }
})

test('a request naming another host is refused', async (t) => {
  const { server } = await setup(t)
  const answer = await request(server, '/api/state', { headers: { host: 'rebind.example' } })
  assert.equal(answer.status, 403)
})

test('the API refuses another origin and accepts its own page', async (t) => {
  const { server, calls } = await setup(t)
  const own = `127.0.0.1:${server.port}`
  const post = (origin) =>
    request(server, '/api/theme', { method: 'POST', headers: { host: own, origin }, body: '{"id":"pixel-dark"}' })

  assert.equal((await post('https://other.example')).status, 403)
  assert.deepEqual(calls, [])
  assert.equal((await post(`http://${own}`)).status, 200)
  assert.deepEqual(calls, [['theme', 'pixel-dark']])
})

test('a body that is too large or not JSON is refused', async (t) => {
  const { server } = await setup(t)
  const post = (body) => request(server, '/api/theme', { method: 'POST', body })
  assert.equal((await post('not json')).status, 400)
  assert.equal((await post(JSON.stringify({ id: 'x'.repeat(5000) }))).status, 400)
})

test('an unknown route or method is refused', async (t) => {
  const { server } = await setup(t)
  assert.equal((await request(server, '/api/nothing')).status, 404)
  assert.equal((await request(server, '/', { method: 'DELETE' })).status, 405)
})

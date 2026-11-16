import assert from 'node:assert/strict'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { startServer } from './http-server.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
/** Well away from the plugin's and the demo's ports, so a running copy is not in the way. */
const FIRST_PORT = 48_650

/** Starts a server on a free port with a stand-in controller, and closes it after the test. */
async function setup(t, { lan = false, state = { rooms: [] } } = {}) {
  const calls = []
  const controller = {
    getState: () => state,
    refresh: async () => ({ rooms: [] }),
    setTheme: async (id) => calls.push(['theme', id]),
    setRoomTheme: async () => {},
    setRoomHidden: async () => {},
    gameAssignRoom: async (roomId, worldId) => {
      calls.push(['assign', roomId, worldId])
      return { changed: true }
    },
    gameSetAutoSpend: async (on) => {
      if (typeof on !== 'boolean') throw new Error('invalid auto-spend')
      return { changed: true }
    },
    gameSetTravel: async (on) => {
      calls.push(['travel', on])
      return { changed: true }
    },
    gameSetCharacterTrade: async (roomId, sessionId, trade) => {
      calls.push(['characterTrade', roomId, sessionId, trade])
      return { changed: true }
    },
    gameSetRoomTrade: async (roomId, trade) => {
      calls.push(['roomTrade', roomId, trade])
      return { changed: true }
    },
    gameImportSave: async (file) => {
      if (file?.format !== 'agent-center-game') throw new Error('this is not an Agent Center save file')
      calls.push(['import', JSON.stringify(file).length])
      return { changed: true }
    }
  }
  const server = await startServer({ root: ROOT, port: FIRST_PORT, lan, controller })
  t.after(() => server.close())
  return { server, calls }
}

/** A raw request, so the path and headers reach the server exactly as written. */
function request(server, target, { method = 'GET', headers = {}, body = null, address = '127.0.0.1' } = {}) {
  return new Promise((resolve, reject) => {
    const outgoing = http.request({ host: address, port: server.port, path: target, method, headers }, (incoming) => {
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

test('a game action reaches the controller and its answer comes back', async (t) => {
  const { server, calls } = await setup(t)
  const post = (target, body) => request(server, target, { method: 'POST', body })
  const assigned = await post('/api/game/assign-room', '{"roomId":"local:/work/rumble-banana","worldId":"side-projects"}')
  assert.equal(assigned.status, 200)
  assert.deepEqual(JSON.parse(assigned.text), { changed: true })
  assert.deepEqual(calls, [['assign', 'local:/work/rumble-banana', 'side-projects']])
  assert.equal((await post('/api/game/auto-spend', '{"on":"yes"}')).status, 400)
  assert.equal((await post('/api/game/auto-spend', 'null')).status, 400)
  assert.equal((await post('/api/game/travel', '{"on":true}')).status, 200)
  assert.deepEqual(calls.at(-1), ['travel', true])
})

test('the trade routes pass their fields on, a missing trade as null for Auto', async (t) => {
  const { server, calls } = await setup(t)
  const post = (target, body) => request(server, target, { method: 'POST', body })
  const room = 'local:/work/rumble-banana'
  assert.equal((await post('/api/game/character-trade', `{"roomId":"${room}","sessionId":"s1","trade":"fishing"}`)).status, 200)
  assert.equal((await post('/api/game/room-trade', `{"roomId":"${room}"}`)).status, 200)
  assert.deepEqual(calls, [['characterTrade', room, 's1', 'fishing'], ['roomTrade', room, null]])
})

test('a save file far larger than other bodies can be imported, and a refusal says why', async (t) => {
  const { server, calls } = await setup(t)
  const post = (body) => request(server, '/api/game/import-save', { method: 'POST', body: JSON.stringify(body) })
  const file = { format: 'agent-center-game', padding: 'x'.repeat(200_000) }
  assert.equal((await post({ file })).status, 200)
  assert.equal(calls.length, 1)
  const refused = await post({ file: { format: 'other' } })
  assert.equal(refused.status, 400)
  assert.deepEqual(JSON.parse(refused.text), { ok: false, error: 'this is not an Agent Center save file' })
  assert.equal((await post({ file: { format: 'agent-center-game', padding: 'x'.repeat(600_000) } })).status, 400)
  assert.equal(calls.length, 1)
})

/** An address of this machine on a network, so a request to it arrives as from another machine. */
const networkAddress = Object.values(os.networkInterfaces()).flat()
  .find((entry) => entry && !entry.internal && entry.family === 'IPv4')?.address

const GAME_ROUTES = ['prestige', 'upgrade-item', 'buy-upgrade', 'assign-room', 'reset-world', 'auto-spend',
  'travel', 'character-trade', 'room-trade', 'keep-titles', 'export-save', 'import-save', 'move-orphan-items']

const gameState = {
  rooms: [],
  game: {
    status: 'running',
    rooms: { 'local:/work/rumble-banana': { joined: true, chest: [{ id: 'blade', heldBy: 'estimated:pane-1' }],
      retirees: [{ nameId: 3, title: 'Fix checkout rounding' }] } },
    characters: { 'pane-1': { sessionId: 'estimated:pane-1', level: 4 } },
    recent: []
  }
}

test('with the local network open, a page on another machine cannot use any game route', {
  skip: networkAddress ? false : 'this machine has no network address'
}, async (t) => {
  const { server, calls } = await setup(t, { lan: true })
  const headers = { host: `${networkAddress}:${server.port}` }
  for (const route of GAME_ROUTES) {
    const answer = await request(server, `/api/game/${route}`, { method: 'POST', headers, address: networkAddress,
      body: '{"on":true,"roomId":"local:/work/rumble-banana","worldId":"main","file":{"format":"agent-center-game"}}' })
    assert.equal(answer.status, 403, route)
    assert.match(JSON.parse(answer.text).error, /only be played on the computer that runs Orca/, route)
  }
  assert.deepEqual(calls, [])
})

test('with the local network open, a page on another machine can still change a theme', {
  skip: networkAddress ? false : 'this machine has no network address'
}, async (t) => {
  const { server, calls } = await setup(t, { lan: true })
  const headers = { host: `${networkAddress}:${server.port}` }
  const answer = await request(server, '/api/theme', { method: 'POST', headers, address: networkAddress, body: '{"id":"guild-hall"}' })
  assert.equal(answer.status, 200)
  assert.deepEqual(calls, [['theme', 'guild-hall']])
})

test('with the local network open, a page on another machine gets the game without session ids or titles', {
  skip: networkAddress ? false : 'this machine has no network address'
}, async (t) => {
  const { server } = await setup(t, { lan: true, state: gameState })
  const headers = { host: `${networkAddress}:${server.port}` }
  const { game } = JSON.parse((await request(server, '/api/state', { headers, address: networkAddress })).text)
  assert.equal(game.viewOnly, true)
  const room = game.rooms['local:/work/rumble-banana']
  assert.equal(room.retirees[0].title, null)
  assert.doesNotMatch(JSON.stringify(game), /estimated:pane-1/)
  assert.equal(room.chest[0].heldBy, game.characters['pane-1'].sessionId)
})

test('with the local network open, this machine still plays the game and sees all of it', async (t) => {
  const { server, calls } = await setup(t, { lan: true, state: gameState })
  const assigned = await request(server, '/api/game/assign-room', { method: 'POST',
    body: '{"roomId":"local:/work/rumble-banana","worldId":"main"}' })
  assert.equal(assigned.status, 200)
  assert.deepEqual(calls, [['assign', 'local:/work/rumble-banana', 'main']])
  const { game } = JSON.parse((await request(server, '/api/state')).text)
  assert.equal(game.viewOnly, undefined)
  assert.equal(game.characters['pane-1'].sessionId, 'estimated:pane-1')
})

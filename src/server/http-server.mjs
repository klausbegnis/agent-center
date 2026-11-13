// Local server for the external view: the same UI as the panel, opened in a browser for a
// detached window, fullscreen on another monitor or tablet, and mini mode (picture-in-picture).
import http from 'node:http'
import os from 'node:os'
import { isAllowedHost, isSameOrigin, pathnameOf } from './request-guard.mjs'
import { sendJson, send, serveFile } from './static-files.mjs'

const LOOPBACK = '127.0.0.1'
const ALL_INTERFACES = '0.0.0.0'
/** How many ports after the configured one are tried when it is taken. */
const PORT_ATTEMPTS = 10
const MAX_BODY_BYTES = 1024
/**
 * Routes whose body is a whole saved game. The plugin keeps at most 240 KiB of it, and a file
 * larger than that is refused by the game with a reason; this leaves room for that answer.
 */
const LARGE_BODY_BYTES = 512 * 1024
const LARGE_BODY_ROUTES = new Set(['/api/game/import-save'])
/**
 * A page that stopped reading (a sleeping tablet) lets its updates pile up in memory. Past this
 * much unsent data its stream is closed; the page reconnects by itself when it wakes.
 */
const MAX_STREAM_BACKLOG_BYTES = 1024 * 1024
/** Pages kept up to date at once. A handful of windows and a tablet need far fewer. */
const MAX_STREAMS = 32
/** Sockets open at once, so nothing on the network can hold the worker's memory. */
const MAX_CONNECTIONS = 128
/** A request must arrive within this long; the default of minutes would stall unloading. */
const REQUEST_TIMEOUT_MS = 10_000
/** Keeps idle event streams from being closed by proxies and sleeping tabs. */
const HEARTBEAT_MS = 25_000

function readJsonBody(request, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let body = ''
    request.on('data', (chunk) => {
      body += chunk
      if (body.length > maxBytes) {
        // Stop keeping what arrives, but let it drain so the refusal can still be answered.
        request.removeAllListeners('data')
        request.resume()
        reject(new Error('body too large'))
      }
    })
    request.on('end', () => {
      try {
        resolve(JSON.parse(body))
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

function listen(server, port, host) {
  return new Promise((resolve) => {
    const onError = () => resolve(false)
    server.once('error', onError)
    server.listen(port, host, () => {
      server.off('error', onError)
      resolve(true)
    })
  })
}

/**
 * @param {{
 *   root: string,
 *   port: number,
 *   lan: boolean,
 *   controller: import('../controller.mjs').Controller,
 *   log?: (message: string) => void
 * }} options
 * @returns {Promise<null | { url: string, port: number, lan: boolean,
 *   broadcast: (state: object) => void, close: () => Promise<void> }>} null when no port is free
 */
export async function startServer({ root, port, lan, controller, log = () => {} }) {
  /** Open event streams, one per connected page. */
  const streams = new Set()

  function openEventStream(request, response) {
    if (streams.size >= MAX_STREAMS) return send(response, 503, 'too many open pages')
    response.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive'
    })
    response.write(`data: ${JSON.stringify(controller.getState())}\n\n`)
    streams.add(response)
    request.on('close', () => streams.delete(response))
    // A page that went away mid-write must not take the worker down.
    response.on('error', () => streams.delete(response))
  }

  /** Sends a frame to every page, dropping the ones that have stopped reading. */
  function sendToStreams(frame) {
    for (const stream of streams) {
      if (stream.writableLength > MAX_STREAM_BACKLOG_BYTES) {
        streams.delete(stream)
        stream.destroy()
      } else {
        stream.write(frame)
      }
    }
  }

  const postRoutes = {
    '/api/refresh': async () => controller.refresh(),
    '/api/theme': async (input) => {
      await controller.setTheme(String(input.id))
      return { ok: true }
    },
    // One route for both room settings: a `theme` key picks a theme, otherwise it hides or shows.
    '/api/room': async (input) => {
      if ('theme' in input) await controller.setRoomTheme(String(input.id), input.theme)
      else await controller.setRoomHidden(String(input.id), input.hidden !== false)
      return { ok: true }
    },
    // The game. The controller checks every value; these only pick the fields out.
    '/api/game/prestige': (input) => controller.gamePrestige(input.worldId, input.skillId),
    '/api/game/upgrade-item': (input) => controller.gameUpgradeItem(input.roomId, input.itemId),
    '/api/game/buy-upgrade': (input) => controller.gameBuyUpgrade(input.worldId, input.upgradeId),
    '/api/game/assign-room': (input) => controller.gameAssignRoom(input.roomId, input.worldId ?? null),
    '/api/game/reset-world': (input) => controller.gameResetWorld(input.worldId),
    '/api/game/auto-spend': (input) => controller.gameSetAutoSpend(input.on),
    '/api/game/keep-titles': (input) => controller.gameSetKeepTitles(input.on),
    '/api/game/export-save': () => controller.gameExportSave(),
    '/api/game/import-save': (input) => controller.gameImportSave(input.file),
    '/api/game/move-orphan-items': (input) => controller.gameMoveOrphanItems(input.fromRoomId, input.toRoomId)
  }

  async function handlePost(pathname, request, response) {
    const route = postRoutes[pathname]
    if (!route) return send(response, 404, 'not found')
    let input
    try {
      const maxBytes = LARGE_BODY_ROUTES.has(pathname) ? LARGE_BODY_BYTES : MAX_BODY_BYTES
      input = pathname === '/api/refresh' ? {} : await readJsonBody(request, maxBytes)
    } catch {
      return sendJson(response, 400, { ok: false })
    }
    try {
      sendJson(response, 200, await route(input))
    } catch (error) {
      // A game action says why it refused, so the page can tell the person; others only refuse.
      const reason = pathname.startsWith('/api/game/') ? String(error?.message ?? error).slice(0, 200) : undefined
      sendJson(response, 400, { ok: false, error: reason })
    }
  }

  function handleGet(pathname, request, response) {
    if (pathname === '/api/state') return sendJson(response, 200, controller.getState())
    if (pathname === '/api/events') return openEventStream(request, response)
    if (pathname === '/') return serveFile(response, root, 'ui/web.html')
    if (pathname.startsWith('/ui/') || pathname.startsWith('/themes/')) {
      return serveFile(response, root, pathname.slice(1))
    }
    send(response, 404, 'not found')
  }

  // The names this machine answers to on the local network, beside its addresses.
  const machineName = os.hostname()
  const machineNames = [machineName, `${machineName}.local`]

  function route(request, response) {
    const pathname = pathnameOf(request.url)
    if (pathname === null) return send(response, 400, 'bad request')
    if (!isAllowedHost(request.headers.host, { lan, machineNames })) return send(response, 403, 'forbidden')
    if (pathname.startsWith('/api/') && !isSameOrigin(request.headers)) return send(response, 403, 'forbidden')
    if (request.method === 'POST') return handlePost(pathname, request, response)
    if (request.method === 'GET') return handleGet(pathname, request, response)
    send(response, 405, 'method not allowed')
  }

  const server = http.createServer((request, response) => {
    // Anyone who can reach the port chooses what arrives here. Whatever it is, the answer is an
    // error page at worst, never an exception in the plugin's worker.
    try {
      route(request, response)
    } catch (error) {
      log(`external view: ${error?.message ?? error}`)
      if (!response.headersSent) send(response, 500, 'internal error')
      else response.destroy()
    }
  })

  server.maxConnections = MAX_CONNECTIONS
  server.requestTimeout = REQUEST_TIMEOUT_MS
  server.headersTimeout = REQUEST_TIMEOUT_MS

  const host = lan ? ALL_INTERFACES : LOOPBACK
  let boundPort = null
  for (let attempt = 0; attempt < PORT_ATTEMPTS && boundPort === null; attempt++) {
    if (await listen(server, port + attempt, host)) boundPort = port + attempt
  }
  if (boundPort === null) {
    log(`external view: no free port starting at ${port}`)
    return null
  }

  // After it is listening, an error on the server is reported and must not end the worker.
  server.on('error', (error) => log(`external view: ${error?.message ?? error}`))
  server.on('clientError', (error, socket) => socket.destroy())

  const heartbeat = setInterval(() => sendToStreams(': ping\n\n'), HEARTBEAT_MS)
  heartbeat.unref?.()

  return {
    url: `http://${LOOPBACK}:${boundPort}/`,
    port: boundPort,
    lan,
    broadcast(state) {
      sendToStreams(`data: ${JSON.stringify(state)}\n\n`)
    },
    close() {
      clearInterval(heartbeat)
      for (const stream of streams) stream.destroy()
      streams.clear()
      return new Promise((resolve) => {
        server.close(() => resolve())
        // A request still sending its body would keep the server open until it timed out.
        server.closeAllConnections()
      })
    }
  }
}

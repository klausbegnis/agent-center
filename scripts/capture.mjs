// Takes the README's pictures from the demo with headless Chrome over its DevTools protocol, once
// every image has loaded: a screenshot (`shot`), or frames for a GIF (`frames`), which ffmpeg then
// assembles (CONTRIBUTING.md, "Retaking the README screenshots"). Node alone, no dependency.
//
//   node scripts/capture.mjs shot <url> <file.png> <width> <height> [--motion] [--eval <script>] [--scale 1]
//   node scripts/capture.mjs frames <url> <folder> <width> <height> <seconds> <fps>
//
// Sizes are CSS pixels, drawn at scale 2 (or `--scale`). A shot uses reduced motion, so characters stand at their
// places at once; `--motion` and frames do not, so fights play. `--eval` runs a line of script in the
// page first (a click to open a detail), then waits a moment.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
/** How long the page gets to draw after its images have loaded, and the most it waits for them. */
const SETTLE_MS = 2500
const LOAD_LIMIT_MS = 20_000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Starts Chrome on a free port and answers a DevTools session on its page. */
async function openChrome() {
  const profile = mkdtempSync(path.join(tmpdir(), 'ac-capture-'))
  const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  const portFile = path.join(profile, 'DevToolsActivePort')
  for (let tries = 0; tries < 100 && !existsSync(portFile); tries++) await sleep(100)
  const port = readFileSync(portFile, 'utf8').split('\n')[0]
  const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
  const socket = new WebSocket(pages.find((page) => page.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve) => socket.addEventListener('open', resolve))
  let lastId = 0
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    const resolve = pending.get(message.id)
    pending.delete(message.id)
    if (typeof resolve === 'function') resolve(message.result)
  })
  const send = (method, params = {}) => new Promise((resolve) => {
    lastId += 1
    pending.set(lastId, resolve)
    socket.send(JSON.stringify({ id: lastId, method, params }))
  })
  const close = async () => {
    socket.close()
    const exited = new Promise((resolve) => chrome.once('exit', resolve))
    chrome.kill()
    await exited
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
  }
  return { send, close }
}

/** Opens a page at a size, waits until every image on it has loaded, then a moment more. */
async function load(send, url, width, height, { motion, scale = 2 }) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false })
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: motion ? 'no-preference' : 'reduce' }] })
  await send('Page.navigate', { url })
  const loaded = '[...document.images].every((image) => image.complete) && document.images.length > 0'
  for (let waited = 0; waited < LOAD_LIMIT_MS; waited += 250) {
    await sleep(250)
    const answer = await send('Runtime.evaluate', { expression: loaded, returnByValue: true })
    if (answer?.result?.value) break
  }
  await sleep(SETTLE_MS)
}

const picture = async (send) => Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64')

const [mode, url, out, width, height, ...rest] = process.argv.slice(2)
if (!['shot', 'frames'].includes(mode) || !url || !out) {
  console.error('usage: node scripts/capture.mjs shot|frames <url> <out> <width> <height> [...]')
  process.exit(1)
}
const { send, close } = await openChrome()
try {
  if (mode === 'shot') {
    await load(send, url, Number(width), Number(height), { motion: rest.includes('--motion'), scale: rest.includes('--scale') ? Number(rest[rest.indexOf('--scale') + 1]) : 2 })
    const script = rest.includes('--eval') ? rest[rest.indexOf('--eval') + 1] : null
    if (script) {
      await send('Runtime.evaluate', { expression: script })
      await sleep(SETTLE_MS)
    }
    writeFileSync(out, await picture(send))
  } else {
    const [seconds, fps] = rest.map(Number)
    await load(send, url, Number(width), Number(height), { motion: true })
    mkdirSync(out, { recursive: true })
    const started = Date.now()
    for (let frame = 0; frame < seconds * fps; frame++) {
      writeFileSync(path.join(out, `frame-${String(frame).padStart(4, '0')}.png`), await picture(send))
      await sleep(Math.max(0, started + ((frame + 1) * 1000) / fps - Date.now()))
    }
  }
} finally {
  await close()
}

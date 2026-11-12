// External view: the same scene served by the worker at http://127.0.0.1:<port>/. The detached
// window, fullscreen (another monitor or a tablet) and the always-on-top mini mode start here.
import { mountStage } from '../engine/stage.js'

const app = document.getElementById('app')
const listeners = new Set()

// Address options, handy for a wall display or a tablet:
//   ?view=gallery|list   start in that view
//   ?only=<text>         show only the rooms whose name or host contains the text
//   ?emotes=fast|off     characters emote every few seconds (to preview a theme's emotes), or never
const params = new URLSearchParams(location.search)
const only = (params.get('only') ?? '').toLowerCase()
const narrow = (state) =>
  only
    ? { ...state, rooms: state.rooms.filter((room) => `${room.name} ${room.host ?? ''}`.toLowerCase().includes(only)) }
    : state

const post = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

const transport = {
  base: '/',
  setRoomHidden: (id, hidden) => post('/api/room', { id, hidden }),
  setRoomTheme: (id, theme) => post('/api/room', { id, theme }),
  prefs: {
    get: (key) => params.get(key) ?? localStorage.getItem(`agent-center:${key}`),
    set: (key, value) => localStorage.setItem(`agent-center:${key}`, value)
  },
  getState: async () => narrow(await (await fetch('/api/state')).json()),
  refresh: async () => narrow(await (await fetch('/api/refresh', { method: 'POST' })).json()),
  onState: (listener) => listeners.add(listener),
  setTheme: (id) =>
    fetch('/api/theme', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) })
}

// EventSource reconnects on its own if Orca restarts the worker.
const events = new EventSource('/api/events')
events.onmessage = (message) => {
  const state = narrow(JSON.parse(message.data))
  for (const listener of listeners) listener(state)
}

const pipSupported = 'documentPictureInPicture' in window
let pipWindow = null

async function toggleMini() {
  if (pipWindow) {
    pipWindow.close()
    return
  }
  if (!pipSupported) {
    // No document picture-in-picture (Firefox, Safari): a plain small window, not always on top.
    window.open(location.href, 'agent-center-mini', 'popup,width=380,height=280')
    return
  }
  pipWindow = await window.documentPictureInPicture.requestWindow({ width: 380, height: 270 })
  for (const sheet of document.querySelectorAll('link[rel="stylesheet"]')) {
    pipWindow.document.head.append(sheet.cloneNode())
  }
  pipWindow.document.body.dataset.surface = 'mini'
  pipWindow.document.body.append(app)
  pipWindow.addEventListener('pagehide', () => {
    document.body.append(app)
    pipWindow = null
  })
}

const actions = [
  {
    label: 'Fullscreen',
    title: 'Fills this whole monitor',
    onClick: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())
  },
  {
    label: 'Mini',
    title: pipSupported ? 'Small always-on-top window you can drag around' : 'Separate small window (not always on top in this browser)',
    onClick: toggleMini
  },
  {
    label: 'Window',
    title: 'Opens in a detached window, without tabs',
    onClick: () => window.open(location.href, 'agent-center-window', 'popup,width=460,height=680')
  }
]

await mountStage(app, transport, { actions, emotes: params.get('emotes') ?? undefined })

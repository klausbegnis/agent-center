// External view: the same scene served by the worker at http://127.0.0.1:<port>/. The detached
// window, fullscreen (another monitor or a tablet) and the always-on-top mini mode start here.
import { GAME_ACTION_METHODS } from '../engine/game-actions.js'
import { mountStage } from '../engine/stage.js'

const app = document.getElementById('app')
const listeners = new Set()

// Address options, handy for a wall display or a tablet:
//   ?view=gallery|list   start in that view
//   ?only=<text>         show only the rooms whose name or host contains the text
//   ?emotes=fast|off     characters emote every few seconds (to preview a theme's emotes), or never
//   ?tab=rooms|party|chest|camp|skills|market   open that tab of game mode; the old
//                ?tab=arsenal&section=items|party|camp opens Chest, Party or Camp
//   ?room=<room id>      the room game mode's tabs show first
const params = new URLSearchParams(location.search)
const only = (params.get('only') ?? '').toLowerCase()
const narrow = (state) =>
  only
    ? { ...state, rooms: state.rooms.filter((room) => `${room.name} ${room.host ?? ''}`.toLowerCase().includes(only)) }
    : state

const post = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

/**
 * A game action: the worker answers { changed } (or what was asked for), or an error status with
 * the reason it refused, which becomes the error's message.
 */
async function postGame(route, body) {
  const response = await post(`/api/game/${route}`, body)
  if (!response.ok) {
    const answer = await response.json().catch(() => null)
    throw new Error(answer?.error ?? `${route}: HTTP ${response.status}`)
  }
  return response.json()
}

const transport = {
  base: '/',
  setRoomHidden: (id, hidden) => post('/api/room', { id, hidden }),
  setRoomTheme: (id, theme) => post('/api/room', { id, theme }),
  prestigeSkill: (worldId, skillId) => postGame('prestige', { worldId, skillId }),
  upgradeItem: (roomId, itemId) => postGame('upgrade-item', { roomId, itemId }),
  buyGroupUpgrade: (worldId, upgradeId) => postGame('buy-upgrade', { worldId, upgradeId }),
  moveRoomToWorld: (roomId, worldId) => postGame('assign-room', { roomId, worldId }),
  resetWorld: (worldId) => postGame('reset-world', { worldId }),
  rebalanceSkills: (worldId) => postGame('rebalance-skills', { worldId }),
  setActiveRelic: (roomId, relicId) => postGame('active-relic', { roomId, relicId }),
  setAutoSpend: (on) => postGame('auto-spend', { on }),
  setTravel: (on) => postGame('travel', { on }),
  setCharacterTrade: (roomId, sessionId, trade) => postGame('character-trade', { roomId, sessionId, trade }),
  setRoomTrade: (roomId, trade) => postGame('room-trade', { roomId, trade }),
  setEquipment: (roomId, sessionId, slot, itemId) => postGame('equip', { roomId, sessionId, slot, itemId }),
  bestGear: (roomId) => postGame('best-gear', { roomId }),
  setKeepTitles: (on) => postGame('keep-titles', { on }),
  exportSave: () => postGame('export-save', {}),
  importSave: (file) => postGame('import-save', { file }),
  moveOrphanItems: (fromRoomId, toRoomId) => postGame('move-orphan-items', { fromRoomId, toRoomId }),
  sendItem: (roomId, toRoomId, itemIds, confirmHeld) => postGame('send-item', { roomId, toRoomId, itemIds, confirmHeld }),
  sendRelic: (roomId, toRoomId, relicId) => postGame('send-relic', { roomId, toRoomId, relicId }),
  sellMaterial: (worldId, cityId, materialId, amount) => postGame('sell', { worldId, cityId, materialId, amount }),
  tradeMaterial: (worldId, cityId, fromId, toId, amount) => postGame('trade', { worldId, cityId, fromId, toId, amount }),
  buyStallOffer: (worldId, cityId, offerIndex, entryId, roomId) =>
    postGame('buy-offer', { worldId, cityId, offerIndex, entryId, roomId }),
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

// A page opened from another machine may watch the game but not play it: the worker refuses its
// game actions, so the controls are left out instead of failing when used.
const firstState = await fetch('/api/state').then((response) => response.json()).catch(() => null)
if (firstState?.game?.viewOnly === true) for (const name of GAME_ACTION_METHODS) delete transport[name]

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

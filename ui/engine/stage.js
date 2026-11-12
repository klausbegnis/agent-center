// Scene engine, shared by the Orca panel, the editor tab and the external view. It knows no
// theme: it reads themes/<id>/theme.json and draws what the file describes. Each room can use
// its own theme; rooms that have not picked one use the default, or get one each when the
// default is Random.
//
// This module only coordinates. Each part of the screen lives in its own module.
import { createDetail } from './detail.js'
import { el } from './dom.js'
import { paceFor } from './emotes.js'
import { createHeader, VIEWS } from './header.js'
import { themeLoadFailure } from './labels.js'
import { watchMiniMode } from './mini-mode.js'
import { createRoomList } from './room-list.js'
import { defaultThemeIds, themeIdsToLoad } from './room-themes.js'
import { createShelf } from './shelf.js'
import { createThemeLibrary } from './theme-library.js'

/** How often the selected agent's "4 min ago" is refreshed when nothing else changes. */
const DETAIL_REFRESH_MS = 30_000
const DEFAULT_VIEW = 'list'
/**
 * How often the one clock shared by every character looks for emotes to start or end. Short
 * enough that an emote ends on time, long enough to cost nothing.
 */
const EMOTE_TICK_MS = 250

/**
 * What a surface gives the engine to talk to the plugin.
 *
 * @typedef {object} Transport
 * @property {string} base address prefix the themes folder is reachable under
 * @property {() => Promise<object>} getState
 * @property {(listener: (state: object) => void) => void} onState
 * @property {(themeId: string) => Promise<unknown>} setTheme
 * @property {() => Promise<object>} [refresh]
 * @property {(roomId: string, hidden: boolean) => Promise<unknown>} [setRoomHidden]
 * @property {(roomId: string, themeId: string | null) => Promise<unknown>} [setRoomTheme]
 * @property {(workspaceId: string, agentId: string) => Promise<unknown>} [openWorkspace] opens the
 *   workspace on the agent's terminal
 * @property {{ get: (key: string) => unknown, set: (key: string, value: string) => unknown }} [prefs]
 *   per-surface choices such as the view; values are strings
 */

/**
 * @param {HTMLElement} root
 * @param {Transport} transport
 * @param {{
 *   actions?: { label: string, title?: string, onClick: (event: Event) => void }[],
 *   emotes?: string
 * }} [options] `emotes` is how often characters emote: `normal` (the default), `fast` or `off`
 */
export async function mountStage(root, transport, options = {}) {
  root.classList.add('ac-root')
  root.replaceChildren()

  let state = null
  let selectedAgentId = null
  let view = DEFAULT_VIEW
  let pinnedRoomId = null

  // One update at a time: loading themes is async and state arrives in bursts.
  let queue = Promise.resolve()
  function enqueue(next) {
    queue = queue.then(() => update(next)).catch((error) => console.error(error))
    return queue
  }

  const sprites = el('div', 'ac-sprites')
  sprites.setAttribute('aria-hidden', 'true')
  const library = createThemeLibrary(transport.base, sprites)

  const header = createHeader({
    transport,
    extraActions: options.actions,
    onViewChange: (next) => {
      view = next
      transport.prefs?.set('view', view)
      layout()
    },
    onRefreshed: enqueue
  })
  const roomsElement = el('main', 'ac-rooms')
  const detail = createDetail(transport)
  const shelf = createShelf(transport)
  root.append(header.element, sprites, roomsElement, shelf.element)

  const roomList = createRoomList({
    container: roomsElement,
    library,
    transport,
    emotePace: paceFor(options.emotes),
    onSelectAgent: (agentId) => {
      // The same agent again, or the scenery (null), clears the selection.
      const next = selectedAgentId === agentId ? null : agentId
      if (next === selectedAgentId) return
      selectedAgentId = next
      render()
    },
    onTogglePin: (roomId) => {
      pinnedRoomId = pinnedRoomId === roomId ? null : roomId
      transport.prefs?.set('pinned', pinnedRoomId ?? '')
      render()
    }
  })

  watchMiniMode(root)
  new ResizeObserver(() => layout()).observe(roomsElement)

  function layout() {
    header.setView(view)
    root.classList.toggle('ac-gallery', view === 'gallery')
    roomList.layout({ gallery: view === 'gallery', pinnedRoomId: roomList.has(pinnedRoomId) ? pinnedRoomId : null })
  }

  function showEmptyMessage(visibleCount, hiddenCount) {
    roomsElement.querySelector('.ac-empty')?.remove()
    if (visibleCount > 0) return
    const message = hiddenCount ? 'All rooms are hidden.' : 'No rooms yet. Open a project in Orca.'
    roomsElement.append(el('p', 'ac-empty', message))
  }

  function showSelectedAgent() {
    const agents = state.rooms.flatMap((room) => room.agents)
    const agent = agents.find((item) => item.id === selectedAgentId) ?? null
    if (!agent) selectedAgentId = null
    // The card sits over the bottom of the agent's own room, so selecting moves nothing.
    const room = agent && state.rooms.find((item) => item.agents.includes(agent))
    if (room) roomList.overlay(room.id, detail.element)
    detail.show(agent, agent?.parentId ? agents.find((item) => item.id === agent.parentId) : null)
  }

  /** Whether a theme loaded for the rooms that have not picked their own. */
  function hasDefaultTheme(current) {
    return defaultThemeIds(current).some((id) => library.has(id))
  }

  function render() {
    if (!state || !hasDefaultTheme(state)) return
    const hiddenIds = new Set(state.hidden ?? [])
    const visibleRooms = state.rooms.filter((room) => !hiddenIds.has(room.id))
    const hiddenRooms = state.rooms.filter((room) => hiddenIds.has(room.id))

    header.update(state)
    roomList.render(visibleRooms, state, { selectedAgentId, pinnedRoomId, now: Date.now() })
    showEmptyMessage(visibleRooms.length, hiddenRooms.length)
    shelf.update(hiddenRooms)
    showSelectedAgent()
    layout()
  }

  async function update(next) {
    state = next
    // Load every theme a room can end up with before drawing anything. One that fails to load
    // is left out; the rooms are drawn as long as there is a theme for the default.
    await Promise.all(themeIdsToLoad(next).map((id) => library.ensure(id)))
    if (!hasDefaultTheme(next)) {
      roomsElement.replaceChildren(el('p', 'ac-empty', themeLoadFailure(next)))
      return
    }
    render()
  }

  const savedView = await Promise.resolve(transport.prefs?.get('view')).catch(() => null)
  if (VIEWS.includes(savedView)) view = savedView
  const savedPin = await Promise.resolve(transport.prefs?.get('pinned')).catch(() => null)
  if (typeof savedPin === 'string' && savedPin) pinnedRoomId = savedPin

  transport.onState(enqueue)
  await enqueue(await transport.getState())
  setInterval(() => {
    if (state && selectedAgentId) showSelectedAgent()
  }, DETAIL_REFRESH_MS)

  // Emotes rest while nobody can see them and for people who asked for less motion. The page
  // is looked up each time because the mini view moves the root to another window.
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  setInterval(() => {
    if (root.ownerDocument.hidden || reducedMotion.matches) roomList.stopEmotes()
    else roomList.tickEmotes(Date.now())
  }, EMOTE_TICK_MS)

  return { root, refresh: async () => enqueue(await transport.getState()) }
}

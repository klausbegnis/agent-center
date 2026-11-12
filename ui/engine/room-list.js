// The set of rooms on screen: creates and removes room views as rooms come and go, and sizes
// them for the current view.
import { evenGrid, GALLERY_GAP, pinnedGrid } from './gallery.js'
import { assignThemes } from './room-themes.js'
import { createRoomView } from './room-view.js'
import { ROOM_ASPECT } from './stations.js'
import { assignVariants } from './variants.js'

/**
 * @param {{
 *   container: HTMLElement,
 *   library: { get: (id: string) => object | undefined, has: (id: string) => boolean },
 *   transport: object,
 *   emotePace: object | null,
 *   onSelectAgent: (agentId: string) => void,
 *   onTogglePin: (roomId: string) => void
 * }} options `emotePace` is a pace from emotes.js, or null for rooms without emotes
 */
export function createRoomList({ container, library, transport, emotePace, onSelectAgent, onTogglePin }) {
  /** @type {Map<string, ReturnType<typeof createRoomView>>} */
  const views = new Map()

  /** The theme of every room, hidden ones too, among the themes that loaded. */
  function themeIdsFor(state) {
    return assignThemes(state.rooms, {
      defaultTheme: state.theme,
      roomThemes: state.roomThemes,
      usableThemeIds: state.themes.map((theme) => theme.id).filter((id) => library.has(id))
    })
  }

  function viewFor(room, themeId, variants) {
    const existing = views.get(room.id)
    if (existing && existing.themeId === themeId) return existing
    // A room that switched themes is rebuilt.
    existing?.section.remove()
    const theme = library.get(themeId)
    const view = createRoomView({
      room,
      theme,
      variant: variants.get(room.id),
      transport,
      emotePace,
      onSelectAgent,
      onTogglePin
    })
    views.set(room.id, view)
    return view
  }

  /**
   * @param {object[]} rooms the visible rooms, in display order
   * @param {object} state the full view state
   * @param {{ selectedAgentId: string | null, pinnedRoomId: string | null, now: number }} options
   */
  function render(rooms, state, { selectedAgentId, pinnedRoomId, now }) {
    // Themes and variants are worked out over every room, hidden ones too, so hiding a room
    // does not change the others.
    const themeIds = themeIdsFor(state)
    const variants = assignVariants(state.rooms, (room) => library.get(themeIds.get(room.id)))

    const visibleIds = new Set(rooms.map((room) => room.id))
    for (const [id, view] of views) {
      if (!visibleIds.has(id)) {
        view.section.remove()
        views.delete(id)
      }
    }
    const sections = []
    for (const room of rooms) {
      const view = viewFor(room, themeIds.get(room.id), variants)
      view.update(room, state, { selectedAgentId, isPinned: room.id === pinnedRoomId, now })
      // The pinned room is shown first, whatever its place in the list.
      if (room.id === pinnedRoomId) sections.unshift(view.section)
      else sections.push(view.section)
    }
    arrange(sections)
  }

  /**
   * Puts the room sections in the given order. A section that is moved loses every walk in
   * progress inside it (the browser drops the transitions of a re-inserted element), so nothing
   * is touched while the order on the page is already right.
   */
  function arrange(sections) {
    const current = [...container.children].filter((child) => sections.includes(child))
    const isInOrder = current.length === sections.length && sections.every((section, at) => section === current[at])
    if (!isInOrder) container.append(...sections)
  }

  function clearSizes() {
    container.style.gridTemplateColumns = ''
    container.style.gridTemplateRows = ''
    for (const view of views.values()) {
      view.section.style.removeProperty('--ac-room-size')
      view.section.style.gridColumn = ''
    }
  }

  /** Sizes the rooms for Gallery view, or clears the sizes for List view. */
  function layout({ gallery, pinnedRoomId }) {
    clearSizes()
    if (!gallery || views.size === 0) return
    const { width, height } = container.getBoundingClientRect()
    const pinned = pinnedRoomId ? views.get(pinnedRoomId) : null

    if (!pinned) {
      const grid = evenGrid(views.size, width, height, ROOM_ASPECT)
      container.style.gridTemplateColumns = `repeat(${grid.columns}, minmax(0, 1fr))`
      container.style.gridTemplateRows = `repeat(${grid.rows}, minmax(0, 1fr))`
      for (const view of views.values()) view.section.style.setProperty('--ac-room-size', `${grid.size}px`)
      return
    }

    // One room large on top, the others in a strip below.
    const others = views.size - 1
    const grid = pinnedGrid(others, width, height, ROOM_ASPECT)
    container.style.gridTemplateColumns = `repeat(${grid.stripColumns}, minmax(0, 1fr))`
    container.style.gridTemplateRows = others
      ? `minmax(0, ${grid.pinnedShare}fr) minmax(0, ${1 - grid.pinnedShare}fr)`
      : 'minmax(0, 1fr)'
    for (const view of views.values()) {
      const isPinned = view === pinned
      view.section.style.setProperty('--ac-room-size', `${isPinned ? grid.pinnedSize : grid.stripSize}px`)
      if (isPinned) view.section.style.gridColumn = '1 / -1'
    }
    if (container.firstElementChild !== pinned.section) container.prepend(pinned.section)
  }

  /** Moves the emotes of every room on to `now`. */
  function tickEmotes(now) {
    for (const view of views.values()) view.tickEmotes(now)
  }

  function stopEmotes() {
    for (const view of views.values()) view.stopEmotes()
  }

  /** Puts an element over the bottom of a room's scene, so showing it moves nothing else. */
  function overlay(roomId, element) {
    const stage = views.get(roomId)?.stage
    if (stage && element.parentElement !== stage) stage.append(element)
  }

  return {
    render,
    layout,
    overlay,
    tickEmotes,
    stopEmotes,
    has: (roomId) => views.has(roomId),
    gap: GALLERY_GAP
  }
}

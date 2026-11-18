// The game's frame around the rooms: above the tabs, the room switcher and the world's coins and
// materials; the tabs (Rooms, Party, Chest, Camp, Skills, Market, Bestiary); their panels; and a line for
// short messages. While the game is off it shows nothing and the panel is as it always was.
import { button, el, svgIcon } from './dom.js'
import { createGameActions } from './game-actions.js'
import { ALL_ROOMS, createGameContext } from './game-context.js'
import { card } from './game-controls.js'
import {
  GAME_TABS,
  chosenRoomId,
  gameModeOf,
  isEstimated,
  joinedRooms,
  roomFilterOf,
  tabOrDefault,
  worldById
} from './game-model.js'
import { createGamePanels } from './game-panels.js'
import { createGameTabs, panelId, tabId } from './game-tabs.js'
import { ESTIMATED_MARKER, ESTIMATED_NOTE, gameUnavailable } from './labels.js'
import { pixelPath, SETTINGS_MARK } from './pixel-art.js'
import { isTypingKey, roomAfterShortcut, savedRoomOf } from './room-chips.js'
import { SETTINGS, VIEW_ONLY_MARKER, VIEW_ONLY_NOTE } from './settings-labels.js'
import { createSettingsView } from './settings-view.js'
import { createSummaryView } from './summary-view.js'

/** How long a short message stays, so it can be read but does not linger. */
const NOTICE_MS = 6000

/**
 * @param {{
 *   root: HTMLElement,
 *   roomsElement: HTMLElement,
 *   transport: object,
 *   onTabChange: () => void,
 *   onRoomsChange: () => void,
 *   library?: object,
 *   onShowAgent?: (agentId: string) => void
 * }} options `onTabChange` is called after the open tab changed, so the rooms can be laid out;
 *   `onRoomsChange` after the Rooms tab was narrowed to one room or opened to all again;
 *   `library` holds the loaded themes, for the Party tab's portraits, and `onShowAgent` is called
 *   when a portrait asks to show its agent in the room
 */
export function createGameShell({ root, roomsElement, transport, onTabChange, onRoomsChange, library, onShowAgent }) {
  let tab = 'rooms'
  let mode = 'off'
  let state = null
  let noticeUntil = 0
  let isSettingsOpen = false
  /** The room Party and Chest show, and whose world the other tabs show; null for the first. */
  let wantedRoomId = null
  /** The one room the Rooms tab shows, or null for all of them (the default). */
  let filterId = null

  const bar = el('div', 'ac-game-bar')
  const tabs = createGameTabs({ onSelect: (next) => select(next) })
  const estimated = el('span', 'ac-game-estimated', ESTIMATED_MARKER)
  estimated.title = ESTIMATED_NOTE
  estimated.setAttribute('aria-label', `${ESTIMATED_MARKER}: ${ESTIMATED_NOTE}`)
  // On a page opened from another machine the worker refuses the game's actions: say so.
  const viewOnly = el('span', 'ac-game-estimated ac-game-view-only', VIEW_ONLY_MARKER)
  viewOnly.title = VIEW_ONLY_NOTE
  viewOnly.setAttribute('aria-label', `${VIEW_ONLY_MARKER}: ${VIEW_ONLY_NOTE}`)
  bar.append(tabs.element, estimated, viewOnly)
  const context = createGameContext({
    onPick: (value) => pickRoom(value),
    onOpenSettlement: () => select('camp'),
    base: transport.base ?? '',
    // A chest slot dragged onto the chip of another room of its world is sent there.
    drop: {
      accepts: (roomId) => {
        const from = tab === 'chest' ? views.chestDrop.draggingFrom() : null
        const rooms = state?.game?.rooms ?? {}
        return Boolean(from) && from !== roomId && rooms[roomId]?.joined === true &&
          rooms[roomId]?.worldId === rooms[from]?.worldId
      },
      take: (roomId, payload) => views.chestDrop.dropOn(payload, roomId)
    }
  })
  // The picker and the strip sit above the tabs and keep their size on every tab.
  const top = el('div', 'ac-game-top')
  top.append(context.element, bar)

  const notice = el('p', 'ac-game-notice')
  notice.setAttribute('role', 'status')

  // Each panel holds what its view draws while the game runs, and a card for when it cannot.
  const panels = {}
  const contents = {}
  const unavailableCards = {}
  for (const name of GAME_TABS.filter((name) => name !== 'rooms')) {
    const panel = el('section', `ac-game-panel ac-game-panel-${name}`)
    panel.id = panelId(name)
    panel.setAttribute('role', 'tabpanel')
    panel.setAttribute('aria-labelledby', tabId(name))
    contents[name] = el('div', 'ac-game-panel-content')
    unavailableCards[name] = el('div', 'ac-game-panel-content')
    panel.append(contents[name], unavailableCards[name])
    panels[name] = panel
  }

  const actions = createGameActions(transport, showNotice)
  // The cog that opens the settings sits in the header; it shows only while the game runs.
  const settingsButton = button('', 'ac-button ac-game-settings-button', {
    onClick: () => setSettingsOpen(!isSettingsOpen)
  })
  settingsButton.append(svgIcon('ac-game-settings-icon', SETTINGS_MARK.length, pixelPath(SETTINGS_MARK, '#')))
  settingsButton.setAttribute('aria-label', SETTINGS.open)
  settingsButton.title = SETTINGS.open
  const settings = createSettingsView({ actions, onClose: () => setSettingsOpen(false, true) })
  // "While you worked" (summary-view.js): its button sits beside the cog, its card in the panels' place.
  const summary = createSummaryView({ actions, root, onOpen: () => isSettingsOpen && setSettingsOpen(false) })

  /** What draws each panel while the game runs. */
  const base = transport.base ?? ''
  const views = createGamePanels({
    contents,
    actions,
    base,
    onChosenItem: () => drawPanel(),
    prefs: transport.prefs,
    library,
    onShowAgent,
    onThemeLoaded: () => drawPanel()
  })

  /**
   * A room picked above the tabs. On Rooms it narrows the rooms shown (ALL_ROOMS opens them all
   * again), and a room picked there is also the one the other tabs show.
   */
  function pickRoom(value) {
    if (tab === 'rooms') {
      filterId = value === ALL_ROOMS ? null : value
      onRoomsChange()
    }
    if (value !== ALL_ROOMS) {
      wantedRoomId = value
      transport.prefs?.set('room', value)
    }
    show()
  }

  /**
   * `[` and `]` pick the room before or after, from anywhere in the page, unless the person is
   * typing (a field, a list) or holds a modifier. Heard on the page and on the root, which the
   * mini view moves to a window of its own; a key handled once is not handled again.
   */
  function onShortcut(event) {
    if (event.defaultPrevented || mode !== 'running' || !state || isTypingKey(event.target, event)) return
    const current = tab === 'rooms' ? roomFilterOf(state, filterId) : chosenRoomId(state, wantedRoomId)
    const next = roomAfterShortcut(joinedRooms(state).map((room) => room.id), current, event.key)
    if (next === null) return
    event.preventDefault()
    pickRoom(next)
  }
  root.addEventListener('keydown', onShortcut)
  root.ownerDocument.addEventListener('keydown', onShortcut)

  function showNotice(message, action) {
    notice.textContent = message
    noticeUntil = Date.now() + NOTICE_MS
    // The line above the panels may be scrolled away while the settings are read: say it there too.
    if (action) settings.showMessage(action, message)
  }

  function setSettingsOpen(isOpen, returnFocus = false) {
    if (isOpen) summary.close()
    isSettingsOpen = isOpen
    show()
    onTabChange()
    if (isOpen) settings.focus()
    else if (returnFocus) settingsButton.focus()
  }

  /**
   * How far the page scrolls before the strip above the tabs sticks to the top: where it starts,
   * right under the header, in the page's own coordinates.
   */
  function stickPoint() {
    const above = top.previousElementSibling
    if (!above) return 0
    // Measured from the header, which never sticks: the strip's own place moves while it is stuck.
    const spacing = (element, property) => parseFloat(getComputedStyle(element)[property]) || 0
    const gap = spacing(root, 'rowGap') + spacing(top, 'marginTop')
    return above.getBoundingClientRect().bottom - root.getBoundingClientRect().top + root.scrollTop + gap
  }

  function select(next) {
    isSettingsOpen = false
    summary.close()
    const wasRooms = tab === 'rooms'
    // Scrolled far enough that the tabs stick to the top: the next tab opens at its own top, with
    // the tabs where they are. Otherwise nothing above the tabs moves.
    const stuckAt = root.scrollTop >= stickPoint() ? stickPoint() : null
    tab = tabOrDefault(next)
    transport.prefs?.set('tab', tab)
    show()
    onTabChange()
    if (stuckAt !== null) root.scrollTop = stuckAt
    // Rooms narrowed to one room show it only on their own tab.
    if (filterId && wasRooms !== (tab === 'rooms')) onRoomsChange()
  }

  /** Draws the open panel, the hidden ones when they are opened, and the strip above the tabs. */
  function drawPanel() {
    if (!state) return
    const isRunning = mode === 'running'
    context.element.hidden = !isRunning
    if (!isRunning) {
      if (!panels[tab]) return
      contents[tab].hidden = true
      unavailableCards[tab].hidden = false
      const { title, lines } = gameUnavailable(state.game?.status)
      unavailableCards[tab].replaceChildren(card(title, lines))
      return
    }
    const roomId = chosenRoomId(state, wantedRoomId)
    const room = roomId ? state.game.rooms[roomId] : null
    const world = room ? worldById(state.game, room.worldId) : null
    if (panels[tab]) {
      contents[tab].hidden = false
      unavailableCards[tab].hidden = true
    }
    const short = panels[tab] ? views.draw({ state, tab, roomId, room, world }) : new Map()
    context.update({ state, tab, roomId, filterId: roomFilterOf(state, filterId), world, short })
  }

  function show() {
    const isShown = mode !== 'off'
    if (mode !== 'running') isSettingsOpen = false
    settingsButton.hidden = mode !== 'running'
    settingsButton.setAttribute('aria-expanded', String(isSettingsOpen))
    settings.element.hidden = !isSettingsOpen
    if (isSettingsOpen) {
      root.dataset.gameSettings = 'open'
      settings.update(state)
    } else {
      delete root.dataset.gameSettings
    }
    top.hidden = !isShown
    estimated.hidden = !(mode === 'running' && isEstimated(state?.game))
    viewOnly.hidden = !(isShown && state?.game?.viewOnly === true)
    if (isShown) root.dataset.gameTab = tab
    else delete root.dataset.gameTab
    tabs.setSelected(tab)
    // The rooms are the Rooms tab's panel only while there are tabs.
    if (isShown) {
      roomsElement.id = panelId('rooms')
      roomsElement.setAttribute('role', 'tabpanel')
      roomsElement.setAttribute('aria-labelledby', tabId('rooms'))
    } else {
      roomsElement.removeAttribute('role')
      roomsElement.removeAttribute('aria-labelledby')
    }
    for (const [name, panel] of Object.entries(panels)) panel.hidden = !isShown || name !== tab
    summary.update(state)
    drawPanel()
  }

  top.hidden = true
  settingsButton.hidden = true
  for (const panel of Object.values(panels)) panel.hidden = true

  return {
    /** The picker, the strip and the tab bar go above the rooms; the panels and messages below. */
    top,
    notice,
    panels: [...Object.values(panels), settings.element, summary.element],
    settingsButton,
    summaryButton: summary.button,
    showNotice,
    /** Opens the tab saved for this surface, or asked for in the address. */
    async restoreTab() {
      const read = (key) => Promise.resolve(transport.prefs?.get(key)).catch(() => null)
      const [saved, section, room, arsenalRoom] =
        await Promise.all([read('tab'), read('section'), read('room'), read('arsenalRoom')])
      // Saved before the Arsenal became Party, Chest and Camp: its section names the tab.
      tab = tabOrDefault(saved, section)
      const savedRoom = savedRoomOf(room, arsenalRoom)
      if (savedRoom && wantedRoomId === null) wantedRoomId = savedRoom
    },
    /**
     * Opens the Rooms tab so a room is on it: a tab narrowed to another room is narrowed to this
     * one instead.
     *
     * @param {string} roomId
     */
    openRoomsAt(roomId) {
      if (filterId && filterId !== roomId) filterId = roomId
      select('rooms')
      onRoomsChange()
    },
    /** The one room the Rooms tab is narrowed to, or null to show every room. */
    roomFilter() {
      return mode === 'running' && tab === 'rooms' && state ? roomFilterOf(state, filterId) : null
    },
    update(next) {
      state = next
      mode = gameModeOf(next.game)
      show()
    },
    /** Clears a message whose time is up. Called by the stage's one clock. */
    tick(now) {
      if (noticeUntil && now >= noticeUntil) {
        noticeUntil = 0
        notice.textContent = ''
      }
    },
    get mode() {
      return mode
    }
  }
}

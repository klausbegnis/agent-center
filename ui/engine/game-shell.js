// The game's frame around the rooms: the tabs, the Arsenal and Skills panels and a line for
// short messages. While the game is off it shows nothing and the panel is as it always was.
import { el } from './dom.js'
import { createGameActions } from './game-actions.js'
import { card } from './game-controls.js'
import { gameModeOf, isEstimated, tabOrDefault } from './game-model.js'
import { createGameTabs, panelId, tabId } from './game-tabs.js'
import { ESTIMATED_MARKER, ESTIMATED_NOTE, gameUnavailable } from './labels.js'

/** How long a short message stays, so it can be read but does not linger. */
const NOTICE_MS = 6000

/**
 * @param {{
 *   root: HTMLElement,
 *   roomsElement: HTMLElement,
 *   transport: object,
 *   onTabChange: () => void
 * }} options `onTabChange` is called after the open tab changed, so the rooms can be laid out
 */
export function createGameShell({ root, roomsElement, transport, onTabChange }) {
  let tab = 'rooms'
  let mode = 'off'
  let state = null
  let noticeUntil = 0

  const bar = el('div', 'ac-game-bar')
  const tabs = createGameTabs({ onSelect: (next) => select(next) })
  const estimated = el('span', 'ac-game-estimated', ESTIMATED_MARKER)
  estimated.title = ESTIMATED_NOTE
  estimated.setAttribute('aria-label', `${ESTIMATED_MARKER}: ${ESTIMATED_NOTE}`)
  bar.append(tabs.element, estimated)

  const notice = el('p', 'ac-game-notice')
  notice.setAttribute('role', 'status')

  const panels = {}
  for (const name of ['arsenal', 'skills']) {
    const panel = el('section', `ac-game-panel ac-game-panel-${name}`)
    panel.id = panelId(name)
    panel.setAttribute('role', 'tabpanel')
    panel.setAttribute('aria-labelledby', tabId(name))
    panels[name] = panel
  }

  const actions = createGameActions(transport, showNotice)
  /** What draws each panel while the game runs. Filled in by the parts that own them. */
  const views = {}

  function showNotice(message) {
    notice.textContent = message
    noticeUntil = Date.now() + NOTICE_MS
  }

  function select(next) {
    tab = tabOrDefault(next)
    transport.prefs?.set('tab', tab)
    show()
    onTabChange()
  }

  /** Draws the open panel; the hidden one is drawn when it is opened. */
  function drawPanel() {
    const panel = panels[tab]
    if (!panel || !state) return
    if (mode === 'unavailable') {
      const { title, lines } = gameUnavailable(state.game?.status)
      panel.replaceChildren(card(title, lines))
      return
    }
    views[tab]?.update(state)
  }

  function show() {
    const isShown = mode !== 'off'
    bar.hidden = !isShown
    estimated.hidden = !(mode === 'running' && isEstimated(state?.game))
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
    drawPanel()
  }

  bar.hidden = true
  for (const panel of Object.values(panels)) panel.hidden = true

  return {
    /** The tab bar goes above the rooms; the panels and the message line below it. */
    bar,
    notice,
    panels: Object.values(panels),
    actions,
    views,
    showNotice,
    /** Opens the tab saved for this surface, or asked for in the address. */
    async restoreTab() {
      const saved = await Promise.resolve(transport.prefs?.get('tab')).catch(() => null)
      tab = tabOrDefault(saved)
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

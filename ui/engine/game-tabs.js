// The game's tab list: Rooms, Party, Chest, Camp, Skills, Market. Real tabs, reachable with the
// arrow keys. Each has a pixel icon beside its name; when the bar is too narrow for the names
// (a container query in game.css), only the icons show and the name stays the accessible name
// and the tooltip.
import { el } from './dom.js'
import { GAME_TABS, tabAfterKey } from './game-model.js'
import { gameIcon } from './icon-view.js'
import { GAME_TAB_ICON, GAME_TAB_LABEL, GAME_TABS_NAME } from './labels.js'

/** The id of a tab and of the panel it controls, so each can name the other. */
export const tabId = (tab) => `ac-game-tab-${tab}`
export const panelId = (tab) => `ac-game-panel-${tab}`

/** @param {{ onSelect: (tab: string) => void }} options */
export function createGameTabs({ onSelect }) {
  const element = el('div', 'ac-game-tabs')
  element.setAttribute('role', 'tablist')
  element.setAttribute('aria-label', GAME_TABS_NAME)

  const buttons = new Map()
  for (const tab of GAME_TABS) {
    const node = el('button', 'ac-game-tab')
    node.type = 'button'
    const label = el('span', 'ac-game-tab-label', GAME_TAB_LABEL[tab])
    node.append(gameIcon(GAME_TAB_ICON[tab], 'ac-game-tab-icon'), label)
    node.setAttribute('aria-label', GAME_TAB_LABEL[tab])
    node.title = GAME_TAB_LABEL[tab]
    node.id = tabId(tab)
    node.setAttribute('role', 'tab')
    node.setAttribute('aria-controls', panelId(tab))
    node.addEventListener('click', () => onSelect(tab))
    buttons.set(tab, node)
    element.append(node)
  }

  // Arrow keys, Home and End move between tabs and open the one they land on.
  element.addEventListener('keydown', (event) => {
    const current = GAME_TABS.find((tab) => buttons.get(tab) === event.target)
    const next = current && tabAfterKey(current, event.key)
    if (!next) return
    event.preventDefault()
    onSelect(next)
    buttons.get(next).focus()
  })

  return {
    element,
    /** Marks a tab as the open one; only the open tab is in the page's tab order. */
    setSelected(selected) {
      for (const [tab, node] of buttons) {
        const isSelected = tab === selected
        node.setAttribute('aria-selected', String(isSelected))
        node.tabIndex = isSelected ? 0 : -1
      }
    }
  }
}

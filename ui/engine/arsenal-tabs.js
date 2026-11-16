// The Arsenal's own row of tabs, under the game's tabs: Items, Party, Camp. Real tabs, reached
// with the arrow keys like the game's.
import { ARSENAL_SECTIONS, optionAfterKey } from './arsenal-model.js'
import { el } from './dom.js'
import { ARSENAL, ARSENAL_SECTION_LABEL } from './labels.js'

/** The id of a section's tab and of the panel it controls, so each can name the other. */
export const sectionTabId = (section) => `ac-game-section-tab-${section}`
export const sectionPanelId = (section) => `ac-game-section-${section}`

/** @param {{ onSelect: (section: string) => void }} options */
export function createArsenalTabs({ onSelect }) {
  const element = el('div', 'ac-game-subtabs')
  element.setAttribute('role', 'tablist')
  element.setAttribute('aria-label', ARSENAL.sections)

  const buttons = new Map()
  for (const section of ARSENAL_SECTIONS) {
    const node = el('button', 'ac-game-subtab', ARSENAL_SECTION_LABEL[section])
    node.type = 'button'
    node.id = sectionTabId(section)
    node.setAttribute('role', 'tab')
    node.setAttribute('aria-controls', sectionPanelId(section))
    node.addEventListener('click', () => onSelect(section))
    buttons.set(section, node)
    element.append(node)
  }

  element.addEventListener('keydown', (event) => {
    const current = ARSENAL_SECTIONS.find((section) => buttons.get(section) === event.target)
    const next = current && optionAfterKey(ARSENAL_SECTIONS, current, event.key)
    if (!next) return
    event.preventDefault()
    onSelect(next)
    buttons.get(next).focus()
  })

  return {
    element,
    /** Marks a section as the open one; only its tab is in the page's tab order. */
    setSelected(selected) {
      for (const [section, node] of buttons) {
        const isSelected = section === selected
        node.setAttribute('aria-selected', String(isSelected))
        node.tabIndex = isSelected ? 0 : -1
      }
    }
  }
}

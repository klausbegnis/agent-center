// The bar at the top: title, counters, default theme, view, and action buttons.
import { button, el, select, setOptions } from './dom.js'
import { defaultThemeOptions } from './labels.js'

export const VIEWS = /** @type {const} */ (['list', 'gallery'])
const VIEW_OPTIONS = [
  ['list', 'List'],
  ['gallery', 'Gallery']
]

/**
 * @param {{
 *   transport: object,
 *   extraActions?: { label: string, title?: string, onClick: (event: Event) => void }[],
 *   onViewChange: (view: 'list' | 'gallery') => void,
 *   onRefreshed: (state: object) => void
 * }} options
 */
export function createHeader({ transport, extraActions = [], onViewChange, onRefreshed }) {
  const element = el('header', 'ac-header')
  const counts = el('div', 'ac-counts')
  const tools = el('div', 'ac-tools')

  const themeSelect = select('ac-select', 'Default theme')
  themeSelect.title = 'Theme for rooms that have not picked their own; Random gives each a different one'
  themeSelect.addEventListener('change', () => transport.setTheme(themeSelect.value))

  const viewSelect = select('ac-select', 'View', VIEW_OPTIONS)
  viewSelect.title = 'Gallery fits all rooms on screen; List scrolls'
  viewSelect.addEventListener('change', () => onViewChange(viewSelect.value))

  tools.append(themeSelect, viewSelect)

  if (transport.refresh) {
    tools.append(
      button('Refresh', 'ac-button', {
        title: 'Re-read the running agents from Orca',
        onClick: async (event) => {
          const target = event.currentTarget
          target.disabled = true
          try {
            onRefreshed(await transport.refresh())
          } finally {
            target.disabled = false
          }
        }
      })
    )
  }
  for (const action of extraActions) tools.append(button(action.label, 'ac-button', action))

  // The title and the counters share a row that never wraps, so a control put at its end stays
  // on the first line whatever the tools do. Without such a control the row lays out as before.
  const titleRow = el('div', 'ac-title-row')
  titleRow.append(el('h1', 'ac-title', 'Agent Center'), counts)
  element.append(titleRow, tools)

  function addChip(count, label, tone) {
    if (count) counts.append(el('span', `ac-chip ac-chip-${tone}`, `${count} ${label}`))
  }

  return {
    element,
    /** Adds a control at the end of the tools. */
    addTool(node) {
      tools.append(node)
    },
    /** Adds a control at the right end of the title row, such as the game's settings button. */
    addTitleTool(node) {
      titleRow.append(node)
    },
    setView(view) {
      viewSelect.value = view
    },
    update(state) {
      setOptions(themeSelect, defaultThemeOptions(state))
      themeSelect.value = state.theme
      counts.replaceChildren()
      addChip(state.counts.working + state.counts.subs, 'working', 'working')
      addChip(state.counts.waiting, 'waiting', 'wait')
      addChip(state.counts.blocked, 'blocked', 'blocked')
      addChip(state.counts.done, 'asleep', 'sleep')
    }
  }
}

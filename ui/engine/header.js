// The bar at the top: title, counters, default theme, view, and action buttons.
import { button, el, select, setOptions, svgIcon } from './dom.js'
import { defaultThemeOptions, STAR_LINK_LABEL } from './labels.js'
import { pixelPath, STAR_MARK } from './pixel-art.js'
import { REPOSITORY_URL } from './project-link.js'

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
  // on the first line whatever the tools do.
  const titleRow = el('div', 'ac-title-row')
  titleRow.append(el('h1', 'ac-title', 'Agent Center'), counts, starLink(transport))
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

/**
 * A small star that opens the project's repository. A plain link opens it from a web page; a
 * surface whose frame cannot leave its folder hands the fixed address to its transport instead.
 */
function starLink(transport) {
  const link = el('a', 'ac-button ac-star-link')
  link.href = REPOSITORY_URL
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.title = STAR_LINK_LABEL
  link.setAttribute('aria-label', STAR_LINK_LABEL)
  link.append(svgIcon('ac-star-icon', STAR_MARK.length, pixelPath(STAR_MARK, '#')))
  if (transport.openRepository) {
    link.addEventListener('click', (event) => {
      event.preventDefault()
      Promise.resolve(transport.openRepository()).catch((error) => console.error('open the repository', error))
    })
  }
  return link
}

// Loads themes on demand and keeps them. Several can be in use at once, one per room.
import { el } from './dom.js'
import { isAllowedAttribute, isAllowedElement } from './sprite-markup.js'

async function fetchTheme(base, id) {
  const dir = `${base}themes/${id}/`
  const theme = await (await fetch(`${dir}theme.json`)).json()
  const sprites = await (await fetch(dir + theme.actors.file)).text()
  // Decode the scenery before the room is shown, so it does not flash empty.
  const scenery = new Image()
  scenery.src = dir + theme.room.background
  await scenery.decode().catch(() => {})
  return { ...theme, id, dir, sprites }
}

/**
 * Parses a sprite sheet without letting it do anything: a template's content runs no script and
 * loads nothing while it is parsed. Then everything that is not plain drawing is taken out, by
 * the allowlist in `sprite-markup.js`, before the sheet reaches the page.
 *
 * @param {string} markup
 * @returns {DocumentFragment}
 */
function inertMarkup(markup) {
  const template = document.createElement('template')
  template.innerHTML = markup
  const content = template.content
  for (const element of [...content.querySelectorAll('*')]) {
    // Inside an element already taken out: it went with it.
    if (!content.contains(element)) continue
    if (!isAllowedElement(element.localName)) {
      element.remove()
      continue
    }
    for (const attribute of [...element.attributes]) {
      if (!isAllowedAttribute(attribute.name, attribute.value)) element.removeAttribute(attribute.name)
    }
  }
  return content
}

/**
 * @param {string} base address prefix the themes folder is reachable under
 * @param {HTMLElement} spritesHost hidden element that holds each theme's sprite sheet
 */
export function createThemeLibrary(base, spritesHost) {
  const themes = new Map()

  /** Loads a theme once. Resolves to null when it cannot be loaded. */
  async function ensure(id) {
    if (themes.has(id)) return themes.get(id)
    try {
      const theme = await fetchTheme(base, id)
      // A theme's sprite sheet is the one place the engine parses markup. Symbol ids carry the
      // theme's prefix, so sheets do not clash.
      const sheet = el('div')
      sheet.dataset.theme = id
      sheet.append(inertMarkup(theme.sprites))
      spritesHost.append(sheet)
      themes.set(id, theme)
      return theme
    } catch (error) {
      console.error(`Could not load the theme "${id}".`, error)
      return null
    }
  }

  return { ensure, get: (id) => themes.get(id), has: (id) => themes.has(id) }
}

// Themes are discovered, not registered: every folder under themes/ with a readable theme.json
// is a theme. The one exception is the template people copy to start a theme.
import fs from 'node:fs'
import path from 'node:path'

/**
 * The folder holding the theme template. It follows the theme contract like any theme, but it
 * is a starting point for authors and not a look to pick, so it is left out of the list unless
 * asked for. THEMES.md explains how to use it.
 */
export const TEMPLATE_THEME = '_template'

/**
 * @param {string} root the plugin folder
 * @param {{ includeTemplate?: boolean }} [options] `includeTemplate` also lists the theme
 *   template; only the demo asks for it, to show the template while it is being worked on
 * @returns {{ id: string, name: string }[]} sorted by id
 */
export function listThemes(root, { includeTemplate = false } = {}) {
  const themesDir = path.join(root, 'themes')
  let folders = []
  try {
    folders = fs.readdirSync(themesDir).sort()
  } catch {
    return []
  }
  const themes = []
  for (const folder of folders) {
    if (folder === TEMPLATE_THEME && !includeTemplate) continue
    try {
      const theme = JSON.parse(fs.readFileSync(path.join(themesDir, folder, 'theme.json'), 'utf8'))
      themes.push({ id: folder, name: String(theme.name ?? folder) })
    } catch {
      // A folder without a readable theme.json is not a theme.
    }
  }
  return themes
}

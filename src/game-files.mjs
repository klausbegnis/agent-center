// Loads the game's content files and builds the engine from them. A content file that is
// missing or invalid leaves the game unavailable rather than half working.
import fs from 'node:fs'
import path from 'node:path'
import { validateCities } from './game/content-cities.mjs'
import { validateItems, validateMonsters } from './game/content.mjs'
import { validateBosses, validateRaces } from './game/content-races.mjs'
import { createEngine } from './game/engine.mjs'

/**
 * @param {string} root the plugin folder
 * @param {(message: string) => void} log told what is wrong when the engine cannot be built
 * @returns {ReturnType<typeof createEngine> | null}
 */
export function loadGameEngine(root, log) {
  try {
    const readJson = (name) => JSON.parse(fs.readFileSync(path.join(root, 'game', name), 'utf8'))
    const content = {
      monsters: readJson('monsters.json'),
      items: readJson('items.json'),
      races: readJson('races.json'),
      bosses: readJson('bosses.json'),
      cities: readJson('cities.json')
    }
    const problems = [
      ...validateMonsters(content.monsters),
      ...validateItems(content.items),
      ...validateRaces(content.races),
      ...validateBosses(content.bosses, content.races),
      ...validateCities(content.cities)
    ]
    if (problems.length) {
      log(`game: the content files have problems: ${problems.slice(0, 3).join('; ')}`)
      return null
    }
    return createEngine({ content })
  } catch (error) {
    log(`game: could not read the content files: ${error?.message ?? error}`)
    return null
  }
}

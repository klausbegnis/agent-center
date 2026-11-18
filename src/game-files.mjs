// Loads the game's content files and builds the engine from them. A content file that is
// missing or invalid leaves the game unavailable rather than half working.
import fs from 'node:fs'
import path from 'node:path'
import { validateAchievements } from './game/achievement-content.mjs'
import { validateBestiary } from './game/bestiary-content.mjs'
import { validateCities } from './game/content-cities.mjs'
import { validateItems, validateMonsters } from './game/content.mjs'
import { validateBosses, validateRaces } from './game/content-races.mjs'
import { createEngine } from './game/engine.mjs'
import { validateRunContent } from './game/instance-boons.mjs'
import { validateInstances } from './game/instance-content.mjs'
import { validateLegendary } from './game/legendary-content.mjs'
import { validateSettlement } from './game/settlement-content.mjs'
import { validateTraits } from './game/trait-content.mjs'
import { GROUP_UPGRADE_IDS } from './game/spending.mjs'

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
      cities: readJson('cities.json'),
      legendary: readJson('legendary.json'),
      bestiary: readJson('bestiary.json'),
      settlement: readJson('settlement.json'),
      instances: readJson('instances.json'),
      achievements: readJson('achievements.json'),
      traits: readJson('traits.json')
    }
    const problems = [
      ...validateMonsters(content.monsters),
      ...validateItems(content.items),
      ...validateRaces(content.races),
      ...validateBosses(content.bosses, content.races),
      ...validateCities(content.cities),
      ...validateLegendary(content.legendary, content),
      ...validateBestiary(content.bestiary, content),
      ...validateSettlement(content.settlement, { upgradeIds: GROUP_UPGRADE_IDS }),
      ...validateInstances(content.instances, content),
      ...validateRunContent(content.instances, content),
      ...validateAchievements(content.achievements, content),
      ...validateTraits(content.traits, content)
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

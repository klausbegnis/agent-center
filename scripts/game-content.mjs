// The game's content files as `npm run check` enforces them: game/monsters.json, races.json and
// bosses.json must exist and be valid, and game/items.json must be valid once it exists. The
// rules are in src/game/content.mjs and src/game/content-races.mjs.
import fs from 'node:fs'
import path from 'node:path'
import { validateItems, validateMonsters } from '../src/game/content.mjs'
import { validateBosses, validateRaces } from '../src/game/content-races.mjs'

/**
 * Reports every problem of the game's content files.
 *
 * @param {object} options
 * @param {string} options.root the repository folder
 * @param {(file: string, message: string) => void} options.report
 * @param {(file: string) => unknown} options.readJson reports and returns null when a file is not JSON
 */
export function checkGameContent({ root, report, readJson }) {
  const monstersFile = path.join(root, 'game', 'monsters.json')
  if (!fs.existsSync(monstersFile)) {
    report(monstersFile, 'is missing; the game needs its default monsters')
  } else {
    const monsters = readJson(monstersFile)
    if (monsters !== null) for (const problem of validateMonsters(monsters)) report(monstersFile, problem)
  }
  checkRacesAndBosses({ root, report, readJson })
  const itemsFile = path.join(root, 'game', 'items.json')
  if (!fs.existsSync(itemsFile)) return
  const items = readJson(itemsFile)
  if (items !== null) for (const problem of validateItems(items)) report(itemsFile, problem)
}

/** game/races.json and game/bosses.json, the bosses checked against the races. */
function checkRacesAndBosses({ root, report, readJson }) {
  const racesFile = path.join(root, 'game', 'races.json')
  const bossesFile = path.join(root, 'game', 'bosses.json')
  for (const file of [racesFile, bossesFile]) {
    if (!fs.existsSync(file)) report(file, 'is missing; the game needs it for its monsters')
  }
  if (!fs.existsSync(racesFile)) return
  const races = readJson(racesFile)
  if (races === null) return
  for (const problem of validateRaces(races)) report(racesFile, problem)
  if (!fs.existsSync(bossesFile)) return
  const bosses = readJson(bossesFile)
  if (bosses !== null) for (const problem of validateBosses(bosses, races)) report(bossesFile, problem)
}

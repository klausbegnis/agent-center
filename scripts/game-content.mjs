// The game's content files as `npm run check` enforces them: game/monsters.json, races.json,
// bosses.json, cities.json, legendary.json and bestiary.json must exist and be valid, and
// game/items.json must be valid once it exists. The rules are in src/game/content.mjs,
// content-races.mjs, content-cities.mjs, legendary-content.mjs and bestiary-content.mjs.
import fs from 'node:fs'
import path from 'node:path'
import { validateBestiary } from '../src/game/bestiary-content.mjs'
import { validateCities } from '../src/game/content-cities.mjs'
import { validateItems, validateMonsters } from '../src/game/content.mjs'
import { validateBosses, validateRaces } from '../src/game/content-races.mjs'
import { validateLegendary } from '../src/game/legendary-content.mjs'

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
  checkCities({ root, report, readJson })
  const itemsFile = path.join(root, 'game', 'items.json')
  const items = fs.existsSync(itemsFile) ? readJson(itemsFile) : null
  if (items !== null) for (const problem of validateItems(items)) report(itemsFile, problem)
  checkLegendary({ root, report, readJson, items })
  checkBestiary({ root, report, readJson })
}

/** game/bestiary.json, its races checked against game/races.json and its track against the bosses. */
function checkBestiary({ root, report, readJson }) {
  const bestiaryFile = path.join(root, 'game', 'bestiary.json')
  if (!fs.existsSync(bestiaryFile)) return report(bestiaryFile, 'is missing; the game needs it for the bestiary')
  const bestiary = readJson(bestiaryFile)
  const readIfThere = (name) => {
    const file = path.join(root, 'game', name)
    return fs.existsSync(file) ? readJson(file) : null
  }
  if (bestiary === null) return
  const others = { races: readIfThere('races.json'), bosses: readIfThere('bosses.json') }
  for (const problem of validateBestiary(bestiary, others)) report(bestiaryFile, problem)
}

/**
 * game/legendary.json, its bosses checked against game/bosses.json, its cities against
 * game/cities.json and its ids against the items.
 */
function checkLegendary({ root, report, readJson, items }) {
  const legendaryFile = path.join(root, 'game', 'legendary.json')
  if (!fs.existsSync(legendaryFile)) return report(legendaryFile, 'is missing; the game needs it for legendary loot')
  const legendary = readJson(legendaryFile)
  const bossesFile = path.join(root, 'game', 'bosses.json')
  const bosses = fs.existsSync(bossesFile) ? readJson(bossesFile) : null
  const citiesFile = path.join(root, 'game', 'cities.json')
  const cities = fs.existsSync(citiesFile) ? readJson(citiesFile) : null
  if (legendary === null) return
  for (const problem of validateLegendary(legendary, { bosses, items, cities })) report(legendaryFile, problem)
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

/** game/cities.json, the market's cities, and that each city's banner is there. */
function checkCities({ root, report, readJson }) {
  const citiesFile = path.join(root, 'game', 'cities.json')
  if (!fs.existsSync(citiesFile)) return report(citiesFile, 'is missing; the market needs its cities')
  const cities = readJson(citiesFile)
  if (cities === null) return
  const problems = validateCities(cities)
  for (const problem of problems) report(citiesFile, problem)
  if (problems.length) return
  for (const city of cities.cities) {
    if (!fs.existsSync(path.join(root, city.banner))) report(citiesFile, `the banner ${city.banner} is missing`)
  }
}

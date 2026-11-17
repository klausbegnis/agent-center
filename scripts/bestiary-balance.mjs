// The bestiary in the simulator: how far each scenario's world gets (races met, mastery levels,
// bosses beaten, the bonus they give), and how much a whole bestiary at its top adds to a trained
// party that already has the full legendary set and the best relic. Run by `npm run simulate`.
import { bestiaryIndexOf } from '../src/game/bestiary-content.mjs'
import { bestiaryEffects } from '../src/game/bestiary-effects.mjs'
import { distinctBossesOf, hunterLevelOf, masteryOf } from '../src/game/bestiary.mjs'
import { legendaryIndexOf } from '../src/game/legendary-effects.mjs'
import { trainedParty } from './game-balance.mjs'
import { killsOf, withFullSet } from './legendary-balance.mjs'

/**
 * Where a world's bestiary stands: races met, the mastery levels reached (in all, and the races at
 * each level), distinct bosses beaten, the hunter's level, and the mean damage bonus against a
 * race over all of them (what a party gains against a monster picked evenly among the races).
 *
 * @param {object | undefined} world
 * @param {object} content
 */
export function bestiaryProgress(world, content) {
  const index = bestiaryIndexOf(content)
  const bestiary = world?.bestiary
  const levels = index.raceIds.map((raceId) => masteryOf(bestiary, raceId, index))
  const effects = bestiaryEffects(bestiary, index)
  const raceDamage = effects.filter((effect) => effect.effect === 'raceDamage').reduce((sum, effect) => sum + effect.amount, 0)
  return {
    discovered: index.raceIds.filter((raceId) => bestiary?.races[raceId]).length,
    levels: levels.reduce((sum, level) => sum + level, 0),
    byLevel: Array.from({ length: index.levels + 1 }, (_, level) => levels.filter((each) => each === level).length),
    bosses: distinctBossesOf(bestiary, index),
    hunter: hunterLevelOf(bestiary, index),
    meanRaceDamage: raceDamage / index.raceIds.length,
    perks: index.raceIds.filter((raceId, at) => levels[at] >= index.perkLevels[0]).length
  }
}

/** Every race at the top threshold and every boss of the roster beaten once. */
function maxedBestiary(index) {
  const races = Object.fromEntries(index.raceIds.map((raceId) =>
    [raceId, [index.races.get(raceId).thresholds.at(-1), 0, 0, 0, 0, 0, 0]]))
  const bosses = Object.fromEntries(index.bossIdList.map((bossId) => [bossId, [1, 0, 0]]))
  return { races, bosses }
}

/**
 * The kills a trained party with the full legendary set and the given relic gains in a day from a
 * whole bestiary at its top.
 *
 * @param {{ plain: object, legendary: object, loaded: object, content: object }} engines `plain`
 *   without legendary loot or bestiary, `legendary` with legendary loot only, `loaded` with both
 * @param {number} level
 * @param {string | null} relicId the relic active, the one that gives the most at that level
 */
export function bestiaryGain({ plain, legendary, loaded, content }, level, relicId) {
  const index = bestiaryIndexOf(content)
  const save = withFullSet(trainedParty(plain, level), legendaryIndexOf(content), relicId)
  const withBestiary = { ...save, worlds: { main: { ...save.worlds.main, bestiary: maxedBestiary(index) } } }
  const base = killsOf(legendary, save)
  const kills = killsOf(loaded, withBestiary)
  return { base, kills, gain: kills / base - 1 }
}

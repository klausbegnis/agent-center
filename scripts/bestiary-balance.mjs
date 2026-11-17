// The bestiary in the simulator: how far each scenario's world gets (races met, mastery levels,
// bosses beaten, the bonus they give), and how much a whole bestiary at its top adds to a trained
// party that already has the full legendary set and the best relic. Run by `npm run simulate`.
import { bestiaryIndexOf } from '../src/game/bestiary-content.mjs'
import { bestiaryEffects } from '../src/game/bestiary-effects.mjs'
import { distinctBossesOf, hunterLevelOf, hunterRankOf, masteryOf } from '../src/game/bestiary.mjs'
import { legendaryIndexOf } from '../src/game/legendary-effects.mjs'
import { trainedParty } from './game-balance.mjs'
import { killsOf, withFullSet } from './legendary-balance.mjs'

/**
 * Where a world's bestiary stands: races met, the mastery levels reached (in all, the lowest and
 * highest, and how many races are past their powered levels), the races with a perk, distinct
 * bosses beaten, the boss hunter's level, the hunter rank, and the mean damage bonus against a
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
    lowest: Math.min(...levels),
    highest: Math.max(...levels),
    /** The highest level of a race with no scale: one that comes up as often as any. */
    common: Math.max(...index.raceIds.filter((raceId) => (index.races.get(raceId).ladder.scale ?? 1) === 1)
      .map((raceId) => masteryOf(bestiary, raceId, index))),
    prestige: levels.filter((level) => level > index.levels).length,
    bosses: distinctBossesOf(bestiary, index),
    hunter: hunterLevelOf(bestiary, index),
    rank: hunterRankOf(bestiary, index),
    meanRaceDamage: raceDamage / index.raceIds.length,
    perks: index.raceIds.filter((raceId, at) => levels[at] >= index.perkEvery).length
  }
}

/** Every race far past its powered levels, the rank far up, and every boss of the roster beaten once. */
function maxedBestiary(index) {
  const races = Object.fromEntries(index.raceIds.map((raceId) =>
    [raceId, [1e9, 0, 0, 0, 0, 0, 0]]))
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

/**
 * The number of mastery levels a stretch of the engine's kill events brought, and whether one did.
 *
 * @param {object[]} events
 */
export const levelUpsIn = (events) => events.reduce((sum, event) =>
  sum + (event.bestiary ?? []).filter((news) => news.kind === 'race' && news.level).length, 0)

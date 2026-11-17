// The bestiary as a UI draws it. Once for the content: each race's name and a fixed portrait (a
// generated look of that race from a seed of its own, so a card never changes), each boss's name,
// epithet, look and legendary item. Per world: what it has discovered and killed, each race's
// mastery with its thresholds and bonuses now and next, each boss beaten, the boss hunter's track
// and the bonuses of the whole bestiary. Bonuses are effects, which the UI words. Pure.
import { bestiaryIndexOf } from './bestiary-content.mjs'
import { bestiaryEffects, hunterEffects, raceMasteryEffects } from './bestiary-effects.mjs'
import {
  BOSS_BEATEN,
  BOSS_FIRST_DAY,
  BOSS_LEGENDARY,
  RACE_FIRST_DAY,
  distinctBossesOf,
  eliteKillsOf,
  killsOf,
  levelFor
} from './bestiary.mjs'
import { legendaryIndexOf } from './legendary-effects.mjs'
import { legendaryItems, legendaryOf } from './legendary.mjs'
import { bossFor, generateMonster } from './races.mjs'

/** The seed of a race's portrait: the same race always gets the same look. */
const portraitSeed = (raceId) => `bestiary|${raceId}`

/** A race's portrait: a plain monster of that race only, so it is never a chimera. */
function portraitOf(races, race) {
  const generated = generateMonster({ palettes: races.palettes, races: [race] }, { seed: portraitSeed(race.id) })
  return generated.look
}

/** A boss's fixed look, as a boss wave shows it. */
function bossLook(content, bossId) {
  const one = { bosses: content.bosses.bosses.filter((boss) => boss.id === bossId) }
  return bossFor(one, content.races, { worldId: '', projectId: '', bossNumber: 0 }).look
}

/** The content's view, built once per content: it never changes while the plugin runs. */
const contentViews = new WeakMap()

/**
 * What the content's bestiary shows, the same for every world: races with name and portrait, bosses
 * with name, epithet, race, look and their legendary item, and the thresholds. Null without one.
 * Built once per content.
 *
 * @param {object} content the game content
 * @returns {object | null}
 */
export function bestiaryContentView(content) {
  if (!contentViews.has(content)) contentViews.set(content, buildContentView(content))
  return contentViews.get(content)
}

function buildContentView(content) {
  const index = bestiaryIndexOf(content)
  if (!index || !content.races) return null
  const legendary = legendaryIndexOf(content)
  const raceById = new Map(content.races.races.map((race) => [race.id, race]))
  return {
    races: index.raceIds.map((raceId) => ({
      id: raceId,
      name: index.races.get(raceId).name,
      thresholds: [...index.races.get(raceId).thresholds],
      look: portraitOf(content.races, raceById.get(raceId))
    })),
    bosses: (content.bosses?.bosses ?? []).map((boss) => ({
      id: boss.id,
      name: boss.name,
      epithet: boss.epithet,
      race: boss.race,
      look: bossLook(content, boss.id),
      item: legendary?.byBoss.get(boss.id)?.id ?? null
    })),
    perkLevels: [...index.perkLevels],
    hunterThresholds: [...index.hunter.thresholds]
  }
}

/** Effects of the same type and qualifiers added into one, in the order they first come. */
export function mergedEffects(effects) {
  const merged = new Map()
  for (const effect of effects) {
    const { amount, ...kind } = effect
    const key = JSON.stringify(kind)
    const known = merged.get(key)
    merged.set(key, known ? { ...known, amount: known.amount + amount } : { ...effect })
  }
  return [...merged.values()]
}

/** A track's place: its level, the count it started at and the next one (null at the top). */
function trackOf(count, thresholds) {
  const level = levelFor(count, thresholds)
  return { level, maxLevel: thresholds.length, from: level > 0 ? thresholds[level - 1] : 0, to: thresholds[level] ?? null }
}

function raceView(index, raceId, counter) {
  const kills = killsOf(counter)
  const track = trackOf(kills, index.races.get(raceId).thresholds)
  // An unknown race shows only that it is unknown: what it would give stays a surprise.
  if (!counter) return { id: raceId, discovered: false, kills: 0, ...track }
  const next = track.to === null ? null : raceMasteryEffects(index, raceId, track.level + 1)
  return {
    id: raceId,
    discovered: true,
    kills,
    ranks: counter.slice(0, RACE_FIRST_DAY),
    eliteKills: eliteKillsOf(counter),
    firstDay: counter[RACE_FIRST_DAY],
    ...track,
    now: raceMasteryEffects(index, raceId, track.level),
    next
  }
}

/** The legendary ids any room of the world has found: relics owned and legendary items in chests. */
function foundInWorld(world) {
  const found = new Set()
  for (const project of Object.values(world.projects ?? {})) {
    for (const id of legendaryOf(project).relics) found.add(id)
    for (const item of legendaryItems(project)) found.add(item.entryId)
  }
  return found
}

function bossView(bossId, counter, item, found) {
  const own = item ? { item, found: found.has(item) } : { item: null, found: false }
  if (!counter) return { id: bossId, discovered: false, beaten: 0, legendary: 0, ...own }
  return {
    id: bossId,
    discovered: true,
    beaten: counter[BOSS_BEATEN],
    legendary: counter[BOSS_LEGENDARY],
    firstDay: counter[BOSS_FIRST_DAY],
    ...own
  }
}

function hunterView(index, bestiary) {
  const count = distinctBossesOf(bestiary, index)
  const track = trackOf(count, index.hunter.thresholds)
  return {
    count,
    ...track,
    now: hunterEffects(index, track.level),
    next: track.to === null ? null : index.hunter.levels[track.level].map((effect) => ({ ...effect }))
  }
}

/**
 * A world's bestiary as a UI draws it. Null without a bestiary in the content.
 *
 * @param {object} world
 * @param {object} content the game content
 * @returns {object | null}
 */
export function worldBestiaryView(world, content) {
  const index = bestiaryIndexOf(content)
  if (!index) return null
  const bestiary = world.bestiary ?? { races: {}, bosses: {} }
  const legendary = legendaryIndexOf(content)
  const found = foundInWorld(world)
  const races = index.raceIds.map((raceId) => raceView(index, raceId, bestiary.races[raceId]))
  const bosses = index.bossIdList.map((bossId) =>
    bossView(bossId, bestiary.bosses[bossId], legendary?.byBoss.get(bossId)?.id ?? null, found))
  return {
    discovered: races.filter((race) => race.discovered).length,
    raceCount: races.length,
    beaten: bosses.filter((boss) => boss.discovered).length,
    bossCount: bosses.length,
    hunter: hunterView(index, bestiary),
    bonuses: mergedEffects(bestiaryEffects(world.bestiary, index)),
    races,
    bosses,
    others: bestiary.others ? { kills: killsOf(bestiary.others), firstDay: bestiary.others[RACE_FIRST_DAY] } : null
  }
}

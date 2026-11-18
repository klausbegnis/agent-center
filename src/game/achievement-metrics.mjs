// What an achievement's condition can measure: one number per metric, read from the save and the
// content, over every world (a sum, a count of distinct things, or the best of them). A metric may
// take one parameter (a race, a rank, a skill, a building, an instance), which the content check
// holds to the ids the content has. New features add a metric here and achievements as data. Pure.
import { instanceIndexOf } from './instance-content.mjs'
import { regionCounts } from './instance-regions.mjs'
import { BESTIARY_RANKS, BOSS_BEATEN, BOSS_LEGENDARY, distinctBossesOf, hunterRankOf, killsOf, masteryOf, totalPointsOf }
  from './bestiary.mjs'
import { bestiaryIndexOf } from './bestiary-content.mjs'
import { CITY_RANK_MAX } from './city-rank-constants.mjs'
import { effectiveLevel, worldLevel } from './progression.mjs'
import { JOURNAL_COUNTERS } from './journal.mjs'
import { renovationStars, stageIndexOf, tierOf, totalLevels } from './settlement.mjs'
import { settlementIndexOf } from './settlement-content.mjs'
import { GATHERING_SKILLS, WORK_SKILLS } from './skills.mjs'
import { traitIndexOf } from './trait-content.mjs'

const SKILL_IDS = [...WORK_SKILLS, ...GATHERING_SKILLS]

const sum = (values) => values.reduce((total, value) => total + value, 0)
const best = (values) => values.reduce((highest, value) => Math.max(highest, value), 0)

/** Every project of every world, left-behind ones included. */
const projectsOf = (save) => Object.values(save.worlds).flatMap((world) => Object.values(world.projects))

/** Every item of every chest. */
const itemsOf = (save) => projectsOf(save).flatMap((project) => project.chest ?? [])

/** A world's skill's effective level, 0 when the world never trained it. */
const skillLevel = (world, skillId) => (world.skills?.[skillId] ? effectiveLevel(world.skills[skillId]) : 0)

/** The distinct ids, over every world, of a world's keys that pass a test. */
function distinctOver(save, keysOf) {
  const ids = new Set()
  for (const world of Object.values(save.worlds)) for (const id of keysOf(world)) ids.add(id)
  return ids.size
}

/** A lifetime total of the journal (journal.mjs), 0 before it kept one. */
const journalTotal = (save, counter) => save.journal?.totals?.[JOURNAL_COUNTERS.indexOf(counter)] ?? 0

/**
 * The metrics, by id. `params` names the parameter a condition gives (at most one), and `measure`
 * answers the number for a save.
 *
 * @type {Record<string, { param?: string, measure: (save: object, context: object, value?: string) => number }>}
 */
export const METRICS = Object.freeze({
  // Fights
  kills: { measure: (save) => sum(projectsOf(save).map((project) => project.kills ?? 0)) },
  rankKills: {
    param: 'rank',
    measure: (save, _context, rank) => {
      const at = BESTIARY_RANKS.indexOf(rank)
      return sum(Object.values(save.worlds).map((world) => {
        const bestiary = world.bestiary
        if (!bestiary) return 0
        const counters = [...Object.values(bestiary.races ?? {}), ...(bestiary.others ? [bestiary.others] : [])]
        return sum(counters.map((counter) => counter[at] ?? 0))
      }))
    }
  },
  wave: { measure: (save) => best(projectsOf(save).map((project) => project.wave ?? 0)) },

  // Bosses
  bossWins: {
    measure: (save) => sum(Object.values(save.worlds).flatMap((world) =>
      Object.values(world.bestiary?.bosses ?? {}).map((counter) => counter[BOSS_BEATEN] ?? 0)))
  },
  legendaryBossWins: {
    measure: (save) => sum(Object.values(save.worlds).flatMap((world) =>
      Object.values(world.bestiary?.bosses ?? {}).map((counter) => counter[BOSS_LEGENDARY] ?? 0)))
  },
  distinctBosses: { measure: (save) => distinctOver(save, (world) => Object.keys(world.bestiary?.bosses ?? {})) },
  bossBeaten: {
    param: 'boss',
    measure: (save, _context, bossId) => sum(Object.values(save.worlds)
      .map((world) => world.bestiary?.bosses?.[bossId]?.[BOSS_BEATEN] ?? 0))
  },

  // Bestiary
  racesDiscovered: { measure: (save) => distinctOver(save, (world) => Object.keys(world.bestiary?.races ?? {})) },
  raceKills: {
    param: 'race',
    measure: (save, _context, raceId) => sum(Object.values(save.worlds).map((world) => killsOf(world.bestiary?.races?.[raceId])))
  },
  raceMastery: {
    param: 'race',
    measure: (save, { bestiaryIndex }, raceId) => (bestiaryIndex
      ? best(Object.values(save.worlds).map((world) => masteryOf(world.bestiary, raceId, bestiaryIndex)))
      : 0)
  },
  bestMastery: {
    measure: (save, { bestiaryIndex }) => (bestiaryIndex
      ? best(Object.values(save.worlds).flatMap((world) =>
        bestiaryIndex.raceIds.map((raceId) => masteryOf(world.bestiary, raceId, bestiaryIndex))))
      : 0)
  },
  hunterRank: {
    measure: (save, { bestiaryIndex }) => (bestiaryIndex
      ? best(Object.values(save.worlds).map((world) => hunterRankOf(world.bestiary, bestiaryIndex)))
      : 0)
  },
  bestiaryPoints: {
    measure: (save, { bestiaryIndex }) => (bestiaryIndex
      ? sum(Object.values(save.worlds).map((world) => totalPointsOf(world.bestiary, bestiaryIndex)))
      : 0)
  },
  bossHunter: {
    measure: (save, { bestiaryIndex }) => (bestiaryIndex
      ? best(Object.values(save.worlds).map((world) => distinctBossesOf(world.bestiary, bestiaryIndex)))
      : 0)
  },

  // Growth
  worldLevel: { measure: (save) => best(Object.values(save.worlds).map((world) => worldLevel(world.skills ?? {}))) },
  skillLevel: {
    param: 'skill',
    measure: (save, _context, skillId) => best(Object.values(save.worlds).map((world) => skillLevel(world, skillId)))
  },
  bestWorkSkill: {
    measure: (save) => best(Object.values(save.worlds).flatMap((world) => WORK_SKILLS.map((id) => skillLevel(world, id))))
  },
  bestGatheringSkill: {
    measure: (save) => best(Object.values(save.worlds).flatMap((world) => GATHERING_SKILLS.map((id) => skillLevel(world, id))))
  },
  prestigeStars: {
    measure: (save) => best(Object.values(save.worlds).map((world) =>
      sum(SKILL_IDS.map((id) => world.skills?.[id]?.stars ?? 0))))
  },
  characterLevel: {
    measure: (save) => best(projectsOf(save).flatMap((project) => [
      ...Object.values(project.characters ?? {}).map((character) => character.level ?? 0),
      ...(project.retirees ?? []).map((retiree) => retiree.level ?? 0)
    ]))
  },
  retirements: { measure: (save) => sum(projectsOf(save).map((project) => project.retiredCount ?? 0)) },

  // Treasure
  itemTier: { measure: (save) => best(itemsOf(save).map((item) => item.tier ?? 0)) },
  itemLevel: { measure: (save) => best(itemsOf(save).map((item) => item.level ?? 0)) },
  legendaryItems: {
    measure: (save) => new Set(itemsOf(save).filter((item) => item.legendary).map((item) => item.entryId)).size
  },
  relics: {
    measure: (save) => new Set(projectsOf(save).flatMap((project) => project.legendary?.relics ?? [])).size
  },

  // Market
  coins: { measure: (save) => best(Object.values(save.worlds).map((world) => world.coins ?? 0)) },
  citiesOpen: {
    measure: (save, { cities }) => best(Object.values(save.worlds).map((world) => {
      const level = worldLevel(world.skills ?? {})
      return cities.filter((city) => level >= city.opensAt).length
    }))
  },

  // Settlement
  buildingLevels: { measure: (save) => best(Object.values(save.worlds).map((world) => totalLevels(world.upgrades))) },
  stage: {
    measure: (save, { settlementIndex }) => (settlementIndex
      ? best(Object.values(save.worlds).map((world) => stageIndexOf(settlementIndex, totalLevels(world.upgrades)) + 1))
      : 0)
  },
  buildingTier: {
    param: 'building',
    measure: (save, { settlementIndex }, buildingId) => {
      const building = settlementIndex?.buildings.find((entry) => entry.id === buildingId)
      if (!building) return 0
      return best(Object.values(save.worlds).map((world) => tierOf(building, world.upgrades?.[building.upgradeId] ?? 0)))
    }
  },
  renovationStars: {
    measure: (save, { settlementIndex }) => (settlementIndex
      ? best(Object.values(save.worlds).map((world) => renovationStars(settlementIndex, totalLevels(world.upgrades))))
      : 0)
  },

  // Instances
  instanceRuns: {
    measure: (save) => sum(Object.values(save.worlds).flatMap((world) =>
      Object.values(world.instances ?? {}).map((progress) => progress.runs ?? 0)))
  },
  instanceClears: {
    measure: (save) => sum(Object.values(save.worlds).flatMap((world) =>
      Object.values(world.instances ?? {}).map((progress) => progress.clears ?? 0)))
  },
  instancesCleared: {
    measure: (save) => distinctOver(save, (world) =>
      Object.entries(world.instances ?? {}).filter(([, progress]) => progress.clears > 0).map(([id]) => id))
  },
  // Rematches and regions (instance-rematch.mjs, instance-regions.mjs): the best rematch won, and
  // how many regions after the first a world opened and how many it completed.
  bestRematch: {
    measure: (save) => best(Object.values(save.worlds).flatMap((world) =>
      Object.values(world.instances ?? {}).map((progress) => progress.rematch ?? 0)))
  },
  regionsOpened: {
    measure: (save, context) => best(Object.values(save.worlds).map((world) => regionCounts(world, context.instanceIndex).opened))
  },
  regionsComplete: {
    measure: (save, context) => best(Object.values(save.worlds).map((world) => regionCounts(world, context.instanceIndex).complete))
  },
  instanceCleared: {
    param: 'instance',
    measure: (save, _context, instanceId) => sum(Object.values(save.worlds).map((world) => world.instances?.[instanceId]?.clears ?? 0))
  },
  instanceTier: {
    measure: (save) => best(Object.values(save.worlds).flatMap((world) =>
      Object.values(world.instances ?? {}).map((progress) => progress.bestTier ?? 0)))
  },

  // Traits (traits.mjs): a world's collection, its mythic traits, the most one character carries, swaps
  traitsCollected: { measure: (save) => best(Object.values(save.worlds).map((world) => world.traits?.known?.length ?? 0)) },
  mythicTraits: {
    measure: (save, { traitIndex }) => (traitIndex
      ? best(Object.values(save.worlds).map((world) =>
        (world.traits?.known ?? []).filter((id) => traitIndex.byId.get(id)?.tier === 'mythic').length))
      : 0)
  },
  traitsCarried: {
    measure: (save) => best(projectsOf(save).flatMap((project) => Object.values(project.characters ?? {})
      .map((character) => (Array.isArray(character.traits) ? character.traits.length : 0))))
  },
  traitSwaps: { measure: (save) => sum(Object.values(save.worlds).map((world) => world.traits?.swaps ?? 0)) },

  // City ranks (city-ranks.mjs): charters bought over every world, the highest rank any city reached,
  // and the most cities one world raised to the last rank.
  charters: {
    measure: (save) => sum(Object.values(save.worlds).flatMap((world) =>
      Object.values(world.cityRanks ?? {}).map((entry) => entry.rank - 1)))
  },
  cityRank: {
    measure: (save) => best(Object.values(save.worlds).flatMap((world) =>
      Object.values(world.cityRanks ?? {}).map((entry) => entry.rank)))
  },
  citiesAtTopRank: {
    measure: (save) => best(Object.values(save.worlds).map((world) =>
      Object.values(world.cityRanks ?? {}).filter((entry) => entry.rank >= CITY_RANK_MAX).length))
  },

  // Weekly events (weekly.mjs): the weeks whose goal a world reached, over every world.
  weeklyGoals: { measure: (save) => sum(Object.values(save.worlds).map((world) => world.weekly?.goals ?? 0)) },

  // Daily quests (quests.mjs): quests and whole days done over every world, and the best streak.
  questsDone: { measure: (save) => sum(Object.values(save.worlds).map((world) => world.daily?.totals?.[0] ?? 0)) },
  questDays: { measure: (save) => sum(Object.values(save.worlds).map((world) => world.daily?.totals?.[1] ?? 0)) },
  questStreak: { measure: (save) => best(Object.values(save.worlds).map((world) => world.daily?.best ?? 0)) },

  // Worlds
  worlds: { measure: (save) => Object.keys(save.worlds).length },
  rooms: { measure: (save) => projectsOf(save).length },

  // The journal's lifetime totals (journal.mjs): counted from the version that keeps them.
  coinsEarned: { measure: (save) => journalTotal(save, 'coins') },
  materialsEarned: { measure: (save) => journalTotal(save, 'materials') },
  notableLoot: { measure: (save) => journalTotal(save, 'loot') },
  activeDays: { measure: (save) => save.journal?.activeDays ?? 0 },

  // The achievements themselves (achievements.mjs fills these in)
  achievements: { measure: (_save, { earnedCount }) => earnedCount },
  achievementPoints: { measure: (_save, { earnedPoints }) => earnedPoints }
})

/**
 * The ids a metric's parameter may take, from the content.
 *
 * @param {object} content the game content
 * @returns {Record<string, string[]>}
 */
export function paramChoices(content) {
  return {
    rank: [...BESTIARY_RANKS],
    race: (content.bestiary?.races ?? []).map((race) => race.id),
    boss: (content.bosses?.bosses ?? []).map((boss) => boss.id),
    skill: SKILL_IDS,
    building: (content.settlement?.buildings ?? []).map((building) => building.id),
    instance: (content.instances?.instances ?? []).map((instance) => instance.id)
  }
}

/**
 * What every metric reads from the content, worked out once.
 *
 * @param {object} content
 */
export function metricContext(content) {
  return {
    bestiaryIndex: bestiaryIndexOf(content),
    settlementIndex: settlementIndexOf(content),
    cities: content.cities?.cities ?? [],
    traitIndex: traitIndexOf(content),
    instanceIndex: instanceIndexOf(content),
    earnedCount: 0,
    earnedPoints: 0
  }
}

// What one change of the save gained, for the journal (journal.mjs): counted from the events the
// change told and from the save before and after it. Kills, bosses, character levels, notable loot
// and instance results come from the events; skill levels, coins, materials and building levels
// from the two saves, so a purchase by hand counts as well as one by autoSpend. Pure.
import { effectiveLevel } from './progression.mjs'
import { settlementNews, totalLevels } from './settlement.mjs'
import { GATHERING_SKILLS, MATERIALS, WORK_SKILLS } from './skills.mjs'

const SKILL_IDS = [...WORK_SKILLS, ...GATHERING_SKILLS]
const BOSS_RANKS = new Set(['boss', 'legendary'])

/** The worlds both saves hold, as pairs. */
function worldPairs(before, after) {
  if (!before) return []
  return Object.keys(after.worlds).filter((id) => Object.hasOwn(before.worlds, id))
    .map((id) => [before.worlds[id], after.worlds[id]])
}

const positive = (value) => (value > 0 ? value : 0)

/** Skill levels gained in every world, prestige counted as levels too. */
function skillLevelsGained(before, after) {
  let gained = 0
  for (const [was, now] of worldPairs(before, after)) {
    for (const id of SKILL_IDS) {
      const from = was.skills?.[id] ? effectiveLevel(was.skills[id]) : 0
      const to = now.skills?.[id] ? effectiveLevel(now.skills[id]) : 0
      gained += positive(to - from)
    }
  }
  return gained
}

function coinsGained(before, after) {
  return worldPairs(before, after).reduce((sum, [was, now]) => sum + positive((now.coins ?? 0) - (was.coins ?? 0)), 0)
}

function materialsGained(before, midway) {
  let gained = 0
  for (const [was, now] of worldPairs(before, midway)) {
    for (const id of MATERIALS) gained += positive((now.materials?.[id] ?? 0) - (was.materials?.[id] ?? 0))
  }
  return gained
}

function buildingLevelsGained(before, after) {
  return worldPairs(before, after).reduce((sum, [was, now]) => sum + positive(totalLevels(now.upgrades) - totalLevels(was.upgrades)), 0)
}

/** The highest tier a room's chest held before the change. */
function bestTierBefore(before, roomId) {
  if (!before) return 0
  for (const world of Object.values(before.worlds)) {
    const project = world.projects[roomId]
    if (project) return project.chest.reduce((highest, item) => Math.max(highest, item.tier ?? 0), 0)
  }
  return 0
}

/**
 * Loot worth a line: every legendary find, and a drop of a higher tier than its room had.
 * Each room's new best counts once per change, however many such drops it had.
 */
function notableLoot(events, before, tierOf, at) {
  const highlights = []
  const bestByRoom = new Map()
  for (const event of events) {
    if (event.type === 'legendary' && typeof event.item === 'string') {
      highlights.push({ at, kind: 'legendary', ref: event.item })
      continue
    }
    if (event.type !== 'drop' || typeof event.item !== 'string') continue
    const tier = tierOf(event.item)
    const best = bestByRoom.has(event.roomId) ? bestByRoom.get(event.roomId) : bestTierBefore(before, event.roomId)
    if (tier <= best) continue
    bestByRoom.set(event.roomId, tier)
    highlights.push({ at, kind: 'loot', ref: event.item, value: tier })
  }
  return highlights
}

/** A building's new tier and a new stage of any world's settlement. */
function settlementHighlights(before, after, settlementIndex, at) {
  if (!before || !settlementIndex) return []
  return settlementNews(before, after, settlementIndex).flatMap((news) => {
    if (news.kind === 'tier') return [{ at, kind: 'building', ref: news.buildingId, value: news.tier }]
    if (news.kind === 'stage') return [{ at, kind: 'stage', ref: news.stageId }]
    return []
  })
}

/**
 * What a change gained.
 *
 * @param {{ before: object | null, after: object, midway?: object, events?: object[], at: number,
 *   tierOf: (entryId: string) => number, settlementIndex?: object | null }} change `midway` is the
 *   save before anything was spent (a round's, before autoSpend): materials are counted up to it,
 *   and not at all without it, so a trade is not counted as earning
 * @returns {{ counts: Record<string, number>, highlights: import('./journal.mjs').Highlight[] }}
 */
export function journalGains({ before, after, midway, events = [], at, tierOf, settlementIndex = null }) {
  const kills = events.filter((event) => event.type === 'kill')
  const instances = events.filter((event) => event.type === 'instance')
  const loot = notableLoot(events, before, tierOf, at)
  const highlights = [
    ...loot,
    ...events.filter((event) => event.type === 'bestiary' && event.kind === 'boss' && event.discovered && event.creatureId)
      .map((event) => ({ at, kind: 'boss', ref: event.creatureId })),
    ...instances.filter((event) => event.kind === 'cleared' && typeof event.instance === 'string')
      .map((event) => ({ at, kind: 'instance', ref: event.instance, value: event.tier })),
    ...settlementHighlights(before, after, settlementIndex, at)
  ]
  return {
    counts: {
      kills: kills.length,
      bosses: kills.filter((event) => BOSS_RANKS.has(event.rank)).length,
      levels: events.filter((event) => event.type === 'level').length,
      skillLevels: skillLevelsGained(before, after),
      loot: loot.length,
      coins: coinsGained(before, after),
      materials: midway ? materialsGained(before, midway) : 0,
      buildings: buildingLevelsGained(before, after),
      cleared: instances.filter((event) => event.kind === 'cleared').length,
      failed: instances.filter((event) => event.kind === 'failed').length
    },
    highlights
  }
}

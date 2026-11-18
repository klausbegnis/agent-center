// Daily quests: each local day a world gets three quests (easy, medium, hard), chosen by hash of the
// world and the day from the kinds of game/quests.json that it can finish today, sized to its own
// recent pace (the journal's last played days). They are counted from what each change gains, the
// way the journal counts it, pay their reward the moment they are done, and all three done pay the
// day's bonus, larger with a streak of such days. The caller passes the day (the bridge's
// `localDayOf`, the journal's) and the time; nothing here reads the clock. Pure.
import { killsOf } from './bestiary.mjs'
import { REWARD_BASE, REWARD_GROWTH } from './constants.mjs'
import { rewardFor } from './combat.mjs'
import { chanceOf, hashOf } from './hash.mjs'
import { instanceIndexOf } from './instance-content.mjs'
import { bestRematch, isRematch, rematchTier } from './instance-rematch.mjs'
import { enterProblem, openness } from './instance-run.mjs'
import { JOURNAL_COUNTERS } from './journal.mjs'
import { isCityOpen } from './market.mjs'
import { effectiveLevel, worldLevel } from './progression.mjs'
import { QUEST_SLOTS, questIndexOf } from './quest-content.mjs'
import { MATERIALS } from './skills.mjs'
import { traitIndexOf } from './trait-content.mjs'
import { addScrolls } from './traits.mjs'
import { featuredRaceOf } from './weekly.mjs'
import { addMaterials } from './worlds.mjs'

/** Played days of the journal a world's pace is read from, the newest first. */
const PACE_DAYS = 7
/** Fewer played days than this, and the pace is the content's defaults instead. */
const PACE_MIN_DAYS = 2
/** A kill of one race among the twenty, and of an elite or champion (MONSTER_RANKS' shares). */
const RACE_SHARE = 1 / 20
const FEATURED_SHARE = 2 / 21
const ELITE_SHARE = 0.1
/** A race week's race is the culling's pick this often. */
const FEATURED_PICK = 0.5
/** A slot no kind can fill today asks this share of a day's kills instead. */
const FALLBACK_SHARE = { easy: 0.3, medium: 0.5, hard: 0.75 }
const FALLBACK_KINDS = ['kills', 'levels', 'elites']
/** The fewest bosses, coins and skill levels a day must bring for a quest about them. */
const BOSSES_FOR_QUEST = 5
const COINS_FOR_QUEST = 10
/** Coins come in bursts (a run's purse, a sale): a coin quest needs them on most played days. */
const COIN_DAYS_SHARE = 1
/** A race's share of a world's kills is read from its bestiary once it counts this many. */
const RACE_SHARE_FROM = 200
/** The least a quest may pay, in plain kills of the world's level. */
const LEAST_REWARD_KILLS = 0.5

const plainKill = (level) => REWARD_BASE * REWARD_GROWTH ** level

/**
 * A world's pace: what a played day of the journal brought on average over the last ones, or the
 * content's defaults (and what a level's kills are worth) without enough of them. The journal
 * counts every world together; most saves have one.
 *
 * @returns {{ kills: number, bosses: number, levels: number, skillLevels: number, coins: number,
 *   materials: number }}
 */
export function paceOf(save, world, day, defaults) {
  const at = (name) => JOURNAL_COUNTERS.indexOf(name) + 1
  const rows = (save.journal?.days ?? []).filter((row) => row[0] < day && row[at('kills')] > 0).slice(-PACE_DAYS)
  const level = worldLevel(world.skills)
  if (rows.length < PACE_MIN_DAYS) {
    return { kills: defaults.kills, bosses: 0, levels: defaults.levels, skillLevels: defaults.skillLevels, coins: 0,
      materials: defaults.kills * plainKill(level) }
  }
  const mean = (name) => rows.reduce((sum, row) => sum + (row[at(name)] ?? 0), 0) / rows.length
  const coinDays = rows.filter((row) => row[at('coins')] > 0).length / rows.length
  return { kills: mean('kills'), bosses: mean('bosses'), levels: mean('levels'), skillLevels: mean('skillLevels'),
    coins: coinDays >= COIN_DAYS_SHARE ? mean('coins') : 0, materials: mean('materials') }
}

/** A target from a pace and a share: whole, at least 1, or null when the day brings too little. */
const sized = (pace, share) => {
  const target = Math.round(pace * share)
  return target >= 1 ? target : null
}

/**
 * The race a culling names and its share of the world's kills: the race week's half the time, else
 * one the world meets at least as often as the average race (its bestiary says how often, once it
 * has counted enough; the room themes make some races commoner).
 */
function cullingRace(world, content, seed) {
  const featured = featuredRaceOf(world, content)
  const counters = world.bestiary?.races ?? {}
  const total = Object.values(counters).reduce((sum, counter) => sum + killsOf(counter), 0)
  const shareOf = (race) => (total >= RACE_SHARE_FROM ? killsOf(counters[race]) / total : RACE_SHARE)
  if (featured && chanceOf(`${seed}|featured`) < FEATURED_PICK) {
    return { race: featured, share: Math.max(FEATURED_SHARE, total >= RACE_SHARE_FROM ? shareOf(featured) : 0) }
  }
  const met = Object.keys(counters).sort()
  const races = total >= RACE_SHARE_FROM ? met.filter((race) => shareOf(race) >= RACE_SHARE) : met
  const pool = races.length ? races : (content.races?.races ?? []).map((race) => race.id)
  if (!pool.length) return null
  const race = pool[hashOf(`${seed}|race`) % pool.length]
  return { race, share: shareOf(race) || RACE_SHARE }
}

/** The rooms of a world that could enter an instance as asked now, or that are inside one. */
function canRun(save, worldId, content, isRematchRun) {
  const index = instanceIndexOf(content)
  const world = save.worlds[worldId]
  if (!index) return null
  const projects = Object.keys(world.projects).sort()
  if (projects.some((id) => world.projects[id].run && Boolean(world.projects[id].run.rematch) === isRematchRun)) return {}
  for (const instance of index.instances) {
    if (!openness(world, instance, index).open) continue
    const progress = world.instances?.[instance.id]
    const rematch = bestRematch(progress) + 1
    // A rematch quest only where the world has already cleared the instance at the rematch's tier.
    if (isRematchRun && (!isRematch(rematch) || (progress?.bestTier ?? 0) < rematchTier(rematch))) continue
    const entry = isRematchRun ? { instanceId: instance.id, rematch } : { instanceId: instance.id, tier: 1 }
    if (projects.some((projectId) => enterProblem(save, { ...entry, projectId }, index) === null)) return {}
  }
  return null
}

/**
 * How each kind is offered: the quest's target and what it names, or null when the world cannot
 * finish it today.
 */
const OFFERS = {
  kills: ({ pace, share }) => (pace.kills >= 5 ? { target: sized(pace.kills, share) } : null),
  race: ({ pace, share, world, content, seed }) => {
    const picked = cullingRace(world, content, seed)
    if (!picked) return null
    const target = sized(pace.kills * picked.share, share)
    return target ? { target, race: picked.race } : null
  },
  elites: ({ pace, share }) => {
    const target = sized(pace.kills * ELITE_SHARE, share)
    return target ? { target } : null
  },
  boss: ({ pace }) => (pace.bosses >= BOSSES_FOR_QUEST ? { target: 1 } : null),
  collect: ({ pace, share, world, seed }) => {
    const held = MATERIALS.filter((id) => (world.materials[id] ?? 0) > 0)
    const total = held.reduce((sum, id) => sum + world.materials[id], 0)
    if (!held.length || total <= 0) return null
    // The world's stock says what it gets most of; the pick leans to a plentiful one.
    const plentiful = held.filter((id) => world.materials[id] >= total / held.length)
    const material = plentiful[hashOf(`${seed}|material`) % plentiful.length]
    const target = sized(pace.materials * (world.materials[material] / total), share)
    return target ? { target, material } : null
  },
  coins: ({ pace, share }) => (pace.coins >= COINS_FOR_QUEST ? { target: sized(pace.coins, share) } : null),
  trade: ({ world, content }) => {
    const level = worldLevel(world.skills)
    const open = (content.cities?.cities ?? []).some((city) => isCityOpen(city, level))
    return open && MATERIALS.some((id) => (world.materials[id] ?? 0) > 0) ? { target: 1 } : null
  },
  instance: ({ save, worldId, content }) => (canRun(save, worldId, content, false) ? { target: 1 } : null),
  rematch: ({ save, worldId, content }) => (canRun(save, worldId, content, true) ? { target: 1 } : null),
  weekly: ({ world, content, share, pace }) => {
    const weekly = world.weekly
    const event = weekly ? content.events?.events?.find((entry) => entry.id === weekly.event) : null
    if (!event || weekly.done) return null
    // What a day brings the goal: its race, any kill, a boss, or an elite or champion.
    const perDay = { race: pace.kills * FEATURED_SHARE, kills: pace.kills, bosses: pace.bosses, elites: pace.kills * ELITE_SHARE }
    const target = sized(perDay[event.goal.kind] ?? 0, share)
    return target ? { target: Math.min(target, event.goal.count - weekly.progress) } : null
  },
  levels: ({ pace, share }) => {
    const target = sized(pace.levels, share)
    return target ? { target } : null
  },
  skills: ({ pace, share }) => (pace.skillLevels >= 1 ? { target: sized(pace.skillLevels, share) } : null)
}

/** A slot nothing can fill today: defeating monsters, or a kind the day has not used yet. */
function fallback(quests, pace, slot) {
  const kind = FALLBACK_KINDS.find((id) => !quests.some((quest) => quest.kind === id))
  const pacing = kind === 'levels' ? pace.levels : pace.kills * (kind === 'elites' ? ELITE_SHARE : 1)
  return { kind, offer: { target: Math.max(1, Math.round(pacing * FALLBACK_SHARE[slot])) } }
}

/** The materials a reward of `kills` plain kills pays: the quest's own material, or two the world has least of. */
function rewardMaterials(world, kills, { seed, material }) {
  const level = worldLevel(world.skills)
  const least = [...MATERIALS].sort((a, b) => (world.materials[a] ?? 0) - (world.materials[b] ?? 0) || a.localeCompare(b)).slice(0, 2)
  const loot = Object.fromEntries((material ? [material] : least).map((id) => [id, 1]))
  return rewardFor({ level, reward: Math.max(LEAST_REWARD_KILLS, kills), loot, dropFactor: 0 }, { luck: 0, seed }).materials
}

/**
 * The day's quests of a world, chosen by hash of the world and the day among the kinds it can
 * finish today, one per slot and each kind once.
 *
 * @param {object} save
 * @param {string} worldId
 * @param {number} day the local day
 * @param {object} content
 * @returns {object[]} `{ kind, slot, target, progress, done, race?, material?, reward }`
 */
export function rollQuests(save, worldId, day, content) {
  const index = questIndexOf(content)
  const world = save.worlds[worldId]
  const pace = paceOf(save, world, day, index.defaults)
  const quests = []
  for (const slot of QUEST_SLOTS) {
    const seed = `${worldId}|${day}|${slot}`
    const offers = index.kinds
      .filter((kind) => Object.hasOwn(kind.slots, slot) && !quests.some((quest) => quest.kind === kind.id))
      .map((kind) => ({ kind: kind.id, offer: OFFERS[kind.id]({ pace, share: kind.slots[slot], world, worldId, save, content, seed }) }))
      .filter((entry) => entry.offer?.target >= 1)
    const picked = offers.length ? offers[hashOf(`${seed}|kind`) % offers.length] : fallback(quests, pace, slot)
    const reward = rewardMaterials(world, pace.kills * index.rewards.quest, { seed, material: picked.offer.material })
    quests.push({ kind: picked.kind, slot, ...picked.offer, progress: 0, done: false, reward })
  }
  return quests
}

/** The day's bonus: a larger share of a day's income with every day of the streak, up to its cap. */
function dailyBonus(save, world, worldId, day, content, streak) {
  const index = questIndexOf(content)
  const { bonus, streakStep, streakCap } = index.rewards
  const pace = paceOf(save, world, day, index.defaults)
  const kills = pace.kills * bonus * (1 + streakStep * Math.min(streak, streakCap))
  return rewardMaterials(world, kills, { seed: `${worldId}|${day}|bonus` })
}

/**
 * The record of a new day: its quests, and the streak as it stands. A day played and left
 * unfinished breaks it; a day the game did not run at all, or a day nobody worked, does not.
 */
function newDay(save, worldId, day, content) {
  const world = save.worlds[worldId]
  const was = world.daily
  let streak = was?.streak ?? 0
  if (was && !was.bonus && wasPlayed(save, was.day)) streak = 0
  return {
    day,
    quests: rollQuests(save, worldId, day, content),
    bonus: false,
    streak,
    best: was?.best ?? 0,
    totals: was?.totals ?? [0, 0]
  }
}

/** Whether the journal saw a day with work: kills or levels. */
function wasPlayed(save, day) {
  const row = (save.journal?.days ?? []).find((entry) => entry[0] === day)
  if (!row) return false
  const at = (name) => JOURNAL_COUNTERS.indexOf(name) + 1
  return row[at('kills')] > 0 || row[at('levels')] > 0 || row[at('skillLevels')] > 0
}

/** The materials one world gained of one material up to `midway` (before spending), kills and gathering. */
const gainedOf = (before, midway, worldId, material) =>
  Math.max(0, (midway?.worlds?.[worldId]?.materials?.[material] ?? 0) - (before?.worlds?.[worldId]?.materials?.[material] ?? 0))

/** Whether a world traded in a change: a city's pressure on a material moved away from rest. */
function traded(before, after) {
  const was = before?.market?.pressure ?? {}
  for (const [cityId, materials] of Object.entries(after?.market?.pressure ?? {})) {
    for (const [material, pressure] of Object.entries(materials)) {
      // The market only ever eases back towards rest by itself: any push away from it is a trade.
      if (Math.abs(pressure) > Math.abs(was[cityId]?.[material] ?? 0)) return true
    }
  }
  return false
}

/** The skill levels a world gained in a change. */
const skillLevelsGained = (before, after) => Object.entries(after?.skills ?? {})
  .reduce((sum, [id, skill]) => sum + Math.max(0, effectiveLevel(skill) - (before?.skills?.[id] ? effectiveLevel(before.skills[id]) : 0)), 0)

/** The character levels a world's living characters gained in a change. */
function characterLevelsGained(before, after) {
  let gained = 0
  for (const [projectId, project] of Object.entries(after.projects)) {
    for (const [sessionId, character] of Object.entries(project.characters ?? {})) {
      const was = before.projects?.[projectId]?.characters?.[sessionId]
      if (was) gained += Math.max(0, (character.level ?? 0) - (was.level ?? 0))
    }
  }
  return gained
}

/** How far a change moved one quest of a world. */
function stepOf(quest, { kills, instances, before, after, midway, worldId }) {
  const was = before?.worlds?.[worldId]
  const now = after.worlds[worldId]
  switch (quest.kind) {
    case 'kills': return kills.length
    case 'race': return kills.filter((kill) => kill.race === quest.race).length
    case 'elites': return kills.filter((kill) => kill.rank === 'elite' || kill.rank === 'champion').length
    case 'boss': return kills.filter((kill) => kill.rank === 'boss' || kill.rank === 'legendary').length
    case 'collect': return gainedOf(before, midway, worldId, quest.material)
    case 'coins': return Math.max(0, (now.coins ?? 0) - (was?.coins ?? 0))
    case 'trade': return traded(was, now) ? 1 : 0
    case 'instance': return instances.filter((event) => !event.rematch).length
    case 'rematch': return instances.filter((event) => event.rematch).length
    case 'weekly': return was?.weekly?.week === now.weekly?.week ? Math.max(0, (now.weekly?.progress ?? 0) - (was?.weekly?.progress ?? 0)) : 0
    case 'levels': return was ? characterLevelsGained(was, now) : 0
    case 'skills': return was ? skillLevelsGained(was, now) : 0
    default: return 0
  }
}

/** A trait scroll of the common tier, by hash, into the world's first room, now and then. */
function bonusScroll(world, worldId, day, content) {
  const traits = traitIndexOf(content)
  const chance = questIndexOf(content).rewards.scrollChance
  const projectId = Object.keys(world.projects).sort()[0]
  if (!traits || !projectId || chanceOf(`${worldId}|${day}|scroll`) >= chance) return { world, scroll: null }
  const commons = traits.byTier.common ?? []
  if (!commons.length) return { world, scroll: null }
  const traitId = commons[hashOf(`${worldId}|${day}|scroll-pick`) % commons.length].id
  const added = addScrolls(world.projects[projectId], [traitId])
  if (added.overflow.length) return { world, scroll: null }
  return { world: { ...world, projects: { ...world.projects, [projectId]: added.project } }, scroll: traitId }
}

/**
 * The day's quests after a change: a new day rolled when the day turned, every quest moved by what
 * the change gained, a reward paid the moment a quest is done, and the bonus when all three are.
 *
 * @param {object} save after the change
 * @param {{ before: object | null, midway?: object, events?: object[], day: number, isNews?: boolean }} change
 * @param {object} content
 * @returns {{ save: object, news: object[] }} `news`: `{ type: 'quest', kind: 'done' | 'day', worldId, ... }`
 */
export function noteQuests(save, { before, midway, events = [], day, isNews = true }, content) {
  if (!questIndexOf(content)) return { save, news: [] }
  const news = []
  let worlds = null
  for (const [worldId, world] of Object.entries(save.worlds)) {
    if (Object.keys(world.projects).length === 0) continue
    const isNewDay = world.daily?.day !== day
    let daily = isNewDay ? newDay(save, worldId, day, content) : world.daily
    let current = world
    if (isNews) {
      const inWorld = (event) => Object.hasOwn(world.projects, event.projectId ?? event.roomId ?? '')
      const context = {
        kills: events.filter((event) => event.type === 'kill' && inWorld(event)),
        instances: events.filter((event) => event.type === 'instance' && event.kind === 'cleared' && inWorld(event)),
        before, after: save, midway, worldId
      }
      const moved = moveQuests(current, daily, context, news)
      current = moved.world
      daily = moved.daily
      if (!daily.bonus && daily.quests.every((quest) => quest.done)) {
        const bonus = finishDay(save, current, worldId, daily, content)
        current = bonus.world
        daily = bonus.daily
        news.push({ type: 'quest', kind: 'day', worldId, streak: daily.streak, ...(bonus.scroll ? { scroll: bonus.scroll } : {}) })
      }
    }
    if (current === world && daily === world.daily) continue
    worlds ??= { ...save.worlds }
    worlds[worldId] = { ...current, daily }
  }
  return { save: worlds ? { ...save, worlds } : save, news }
}

/** Every quest moved by a change; the done ones pay their reward into the world. */
function moveQuests(world, daily, context, news) {
  let materials = world.materials
  let changed = false
  const quests = daily.quests.map((quest) => {
    if (quest.done) return quest
    const step = stepOf(quest, context)
    if (step <= 0) return quest
    changed = true
    const progress = Math.min(quest.target, quest.progress + step)
    const done = progress >= quest.target
    if (done) {
      materials = addMaterials(materials, quest.reward)
      news.push({ type: 'quest', kind: 'done', worldId: context.worldId, quest: quest.kind, target: quest.target,
        ...(quest.race ? { race: quest.race } : {}), ...(quest.material ? { material: quest.material } : {}) })
    }
    return { ...quest, progress, done }
  })
  if (!changed) return { world, daily }
  const doneNow = quests.filter((quest, at) => quest.done && !daily.quests[at].done).length
  const totals = [daily.totals[0] + doneNow, daily.totals[1]]
  return { world: materials === world.materials ? world : { ...world, materials }, daily: { ...daily, quests, totals } }
}

/** All three done: the bonus, the streak, the day counted. */
function finishDay(save, world, worldId, daily, content) {
  const reward = dailyBonus(save, world, worldId, daily.day, content, daily.streak)
  const scrolled = bonusScroll({ ...world, materials: addMaterials(world.materials, reward) }, worldId, daily.day, content)
  const streak = daily.streak + 1
  return {
    world: scrolled.world,
    scroll: scrolled.scroll,
    daily: { ...daily, bonus: true, bonusReward: reward, streak, best: Math.max(daily.best, streak), totals: [daily.totals[0], daily.totals[1] + 1] }
  }
}

/** The bonus a world's day pays now, for the card before it is earned. */
export const bonusPreview = (save, worldId, content) => {
  const world = save.worlds[worldId]
  if (!world?.daily) return {}
  return world.daily.bonusReward ?? dailyBonus(save, world, worldId, world.daily.day, content, world.daily.streak)
}


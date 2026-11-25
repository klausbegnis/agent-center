// Checks a save that comes from outside the plugin (an imported file) part by part, and rebuilds it
// from the fields the engine writes, so nothing made up can be stored. `migrate` repairs what the
// plugin's own storage holds; a file is refused instead as soon as one part is not what the engine
// would have written. Pure.
import { achievementIndexOf } from './achievement-content.mjs'
import { indexBestiary } from './bestiary-content.mjs'
import { checkChronicle } from './chronicle-save.mjs'
import { checkWorldBestiary } from './bestiary-check.mjs'
import { LAST_OFFER_INDEX } from './city-rank-constants.mjs'
import { checkCityRanks } from './city-ranks-save.mjs'
import {
  ITEM_MAX_TIER,
  MARKET_MAX_COINS,
  MARKET_PRESSURE_MAX,
  MARKET_PRESSURE_MIN,
  MONSTER_KINDS,
  MONSTER_RANKS
} from './constants.mjs'
import { instanceIndexOf } from './instance-content.mjs'
import { checkCooldowns, checkRun, checkWorldInstances, sharedInstance } from './instance-save.mjs'
import { checkRoomLegendary } from './legendary-check.mjs'
import { legendaryIndexOf } from './legendary-effects.mjs'
import { emptyMarket } from './market.mjs'
import { AFFIXES } from './monsters.mjs'
import { isReservedKey, worldLayoutProblem } from './save-layout.mjs'
import { ATTRIBUTES, CLASSES, GATHERING_SKILLS, MATERIALS, TRADE_CHOICES, WORK_SKILLS } from './skills.mjs'
import { indexSettlement } from './settlement-content.mjs'
import { GROUP_UPGRADE_IDS, isUpgradeOpen } from './spending.mjs'
import { checkCharacterTraits, checkRoomScrolls, checkWorldTraits } from './trait-check.mjs'
import { traitIndexOf } from './trait-content.mjs'
import { checkDaily } from './quest-save.mjs'
import { checkWeekly } from './weekly-save.mjs'
import { SAVE_VERSION } from './worlds.mjs'

/** Ids and titles the engine keeps are short; a longer one did not come from it. */
const TEXT_LIMIT = 512
const SLOTS = ['weapon', 'outfit', 'tool']
const DAMAGE_TYPES = ['physical', 'magical']
const CHARACTER_STATES = ['working', 'waiting', 'blocked', 'idle']
const SKILL_IDS = [...WORK_SKILLS, ...GATHERING_SKILLS]
const EQUIPMENT_SLOTS = ['weapon', 'outfit', 'tool']

/** A part of the save that is not what the engine writes; its message says where. */
class SaveProblem extends Error {}

const fail = (path, what) => {
  throw new SaveProblem(`${path} ${what}`)
}

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

function record(value, path) {
  if (!isPlainObject(value)) fail(path, 'is not an object')
  return value
}

function list(value, path) {
  if (!Array.isArray(value)) fail(path, 'is not a list')
  return value
}

function text(value, path) {
  if (typeof value !== 'string' || value === '' || value.length > TEXT_LIMIT) fail(path, 'is not a valid name')
  return value
}

const textOrNull = (value, path) => (value === null || value === undefined ? null : text(value, path))

function number(value, path, { min = 0, max = Infinity } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(path, 'is out of range')
  return value
}

const numberOrNull = (value, path) => (value === null || value === undefined ? null : number(value, path, { min: -Infinity }))

function whole(value, path, { min = 0, max = Infinity } = {}) {
  if (!Number.isInteger(value)) fail(path, 'is not a whole number')
  return number(value, path, { min, max })
}

function oneOf(value, choices, path) {
  if (!choices.includes(value)) fail(path, 'is not one the game knows')
  return value
}

/** A gathering skill, or null (missing in saves from before it was kept). */
const tradeOrNull = (value, path) =>
  (value === null || value === undefined ? null : oneOf(value, GATHERING_SKILLS, path))

/** A person's trade choice: a gathering skill, "what is scarcest", or null for none. */
const choiceOrNull = (value, path) =>
  (value === null || value === undefined ? null : oneOf(value, TRADE_CHOICES, path))

/**
 * A room's picks of what is scarcest (scarcest.mjs), when it has them: the time they were made
 * and a gathering skill by session id. Optional; saves from before it have none.
 */
function scarcestPart(value, path) {
  if (value === undefined) return {}
  const source = record(value, path)
  return {
    scarcest: {
      at: number(source.at, `${path}.at`, { min: -Infinity }),
      picks: entries(source.picks, `${path}.picks`, { key: text, entry: (skillId, at) => oneOf(skillId, GATHERING_SKILLS, at) })
    }
  }
}

function boolean(value, path) {
  if (typeof value !== 'boolean') fail(path, 'is not true or false')
  return value
}

/** An object whose keys pass `key` and whose values pass `entry`, rebuilt from them. */
function entries(value, path, { key, entry }) {
  return Object.fromEntries(Object.entries(record(value, path)).map(([id, item]) => {
    if (isReservedKey(id)) fail(`${path}.${id}`, 'is not a name the game uses')
    key(id, `${path}.${id}`)
    return [id, entry(item, `${path}.${id}`, id)]
  }))
}

/** Amounts by id, such as materials or attributes: known ids, numbers of at least 0. */
const amounts = (value, path, ids) => entries(value, path, {
  key: (id, at) => oneOf(id, ids, at),
  entry: (item, at) => number(item, at)
})

function skill(value, path) {
  const source = record(value, path)
  return {
    level: whole(source.level, `${path}.level`, { min: 1 }),
    xp: number(source.xp, `${path}.xp`),
    banked: number(source.banked, `${path}.banked`),
    stars: whole(source.stars, `${path}.stars`)
  }
}

function item(value, path) {
  const source = record(value, path)
  const slot = oneOf(source.slot, SLOTS, `${path}.slot`)
  const id = text(source.id, `${path}.id`)
  const checked = { id, entryId: text(source.entryId ?? id, `${path}.entryId`), slot }
  if (slot === 'weapon') checked.damageType = oneOf(source.damageType, DAMAGE_TYPES, `${path}.damageType`)
  const recipe = list(source.recipe, `${path}.recipe`)
  if (recipe.length === 0) fail(`${path}.recipe`, 'is empty')
  if (source.legendary !== undefined && source.legendary !== true) fail(`${path}.legendary`, 'is not true')
  return {
    ...checked,
    tier: whole(source.tier, `${path}.tier`, { min: 1, max: ITEM_MAX_TIER }),
    recipe: recipe.map((materialId, index) => oneOf(materialId, MATERIALS, `${path}.recipe.${index}`)),
    level: whole(source.level, `${path}.level`),
    heldBy: textOrNull(source.heldBy, `${path}.heldBy`),
    // Legendary equipment; legendary-check.mjs checks it against the content.
    ...(source.legendary === true ? { legendary: true } : {})
  }
}

/** A part the traits keep (trait-check.mjs), as a field to spread: nothing when it is absent. */
function traitPart(key, checked, path) {
  if (!checked.ok) fail(`${path}.${checked.problem[0]}`, checked.problem[1])
  return checked.value === undefined ? {} : { [key]: checked.value }
}

function character(value, path, sessionId, traitIndex = null) {
  const source = record(value, path)
  if (source.sessionId !== sessionId) fail(`${path}.sessionId`, 'does not match its key')
  const equipment = record(source.equipment, `${path}.equipment`)
  return {
    sessionId,
    class: oneOf(source.class, CLASSES, `${path}.class`),
    level: whole(source.level, `${path}.level`, { min: 1 }),
    xp: number(source.xp, `${path}.xp`),
    attributes: amounts(source.attributes, `${path}.attributes`, ATTRIBUTES),
    levelActivityXp: entries(source.levelActivityXp ?? {}, `${path}.levelActivityXp`, {
      key: text,
      entry: (amount, at) => number(amount, at)
    }),
    equipment: Object.fromEntries(EQUIPMENT_SLOTS.map((slot) =>
      [slot, textOrNull(equipment[slot], `${path}.equipment.${slot}`)])),
    trade: tradeOrNull(source.trade, `${path}.trade`),
    tradeChoice: choiceOrNull(source.tradeChoice, `${path}.tradeChoice`),
    tokens: number(source.tokens, `${path}.tokens`),
    bornAt: number(source.bornAt, `${path}.bornAt`, { min: -Infinity }),
    lastSeenAt: number(source.lastSeenAt, `${path}.lastSeenAt`, { min: -Infinity }),
    skillXp: amounts(source.skillXp ?? {}, `${path}.skillXp`, WORK_SKILLS),
    gatherCarry: number(source.gatherCarry ?? 0, `${path}.gatherCarry`),
    title: textOrNull(source.title, `${path}.title`),
    state: oneOf(source.state ?? 'idle', CHARACTER_STATES, `${path}.state`),
    // Slots chosen by hand; a save from before they existed has none, and the field is left out.
    ...(source.pinned === undefined ? {} : { pinned: pins(source.pinned, `${path}.pinned`) }),
    // The traits a person taught it; a character nobody taught has its born trait worked out.
    ...traitPart('traits', checkCharacterTraits(source.traits, { level: source.level, index: traitIndex }), path)
  }
}

/** The slots a person pinned: known slots, each true. */
function pins(value, path) {
  return entries(value, path, {
    key: (slot, at) => oneOf(slot, EQUIPMENT_SLOTS, at),
    entry: (pinned, at) => {
      if (pinned !== true) fail(at, 'is not true')
      return true
    }
  })
}

function retiree(value, path) {
  const source = record(value, path)
  return {
    sessionId: text(source.sessionId, `${path}.sessionId`),
    nameId: whole(source.nameId, `${path}.nameId`),
    class: oneOf(source.class, CLASSES, `${path}.class`),
    level: whole(source.level, `${path}.level`, { min: 1 }),
    xp: number(source.xp, `${path}.xp`),
    attributes: amounts(source.attributes, `${path}.attributes`, ATTRIBUTES),
    tokens: number(source.tokens, `${path}.tokens`),
    mainSkill: source.mainSkill === null || source.mainSkill === undefined
      ? null
      : oneOf(source.mainSkill, WORK_SKILLS, `${path}.mainSkill`),
    retiredAt: number(source.retiredAt, `${path}.retiredAt`, { min: -Infinity }),
    title: textOrNull(source.title, `${path}.title`),
    trade: tradeOrNull(source.trade, `${path}.trade`),
    tradeChoice: choiceOrNull(source.tradeChoice, `${path}.tradeChoice`),
    bornAt: numberOrNull(source.bornAt, `${path}.bornAt`)
  }
}

const COLOUR = /^#[0-9a-f]{6}$/i
/** A look names a handful of parts and colours; more than this did not come from the engine. */
const LOOK_ENTRIES = 16

function bounded(value, path) {
  const source = record(value, path)
  if (Object.keys(source).length > LOOK_ENTRIES) fail(path, 'has too many entries')
  return source
}

/** A part of a look: one part id, a few of them (the extras), or none. */
function lookPart(value, path) {
  if (value === null) return null
  if (!Array.isArray(value)) return text(value, path)
  if (value.length > LOOK_ENTRIES) fail(path, 'has too many entries')
  return value.map((item, index) => text(item, `${path}[${index}]`))
}

function colour(value, path) {
  if (typeof value !== 'string' || !COLOUR.test(value)) fail(path, 'is not a colour')
  return value
}

/** What a generated monster or a roster boss looks like: its rig, part ids and colours. */
function look(value, path) {
  const source = record(value, path)
  return {
    rig: text(source.rig, `${path}.rig`),
    parts: entries(bounded(source.parts, `${path}.parts`), `${path}.parts`, { key: text, entry: lookPart }),
    colours: entries(bounded(source.colours, `${path}.colours`), `${path}.colours`, { key: text, entry: colour })
  }
}

/**
 * How a monster is drawn and ranked. A hand-made entry has `sprite`; a generated monster or a
 * boss of the roster has `race` and `look`; one saved before ranks existed has no `rank`.
 */
function appearance(source, path) {
  const kept = {}
  if (source.rank !== undefined) kept.rank = oneOf(source.rank, Object.keys(MONSTER_RANKS), `${path}.rank`)
  if (source.dropFactor !== undefined) kept.dropFactor = number(source.dropFactor, `${path}.dropFactor`)
  if (source.race !== undefined) kept.race = text(source.race, `${path}.race`)
  if (source.look !== undefined) kept.look = look(source.look, `${path}.look`)
  if (source.sprite !== undefined) kept.sprite = entries(source.sprite, `${path}.sprite`, { key: text, entry: text })
  if (!kept.look && !kept.sprite) fail(path, 'has nothing to be drawn with')
  return kept
}

function monster(value, path) {
  if (value === null || value === undefined) return null
  const source = record(value, path)
  const maxHp = number(source.maxHp, `${path}.maxHp`, { min: Number.MIN_VALUE })
  return {
    ...appearance(source, path),
    id: text(source.id, `${path}.id`),
    name: text(source.name, `${path}.name`),
    kind: oneOf(source.kind, Object.keys(MONSTER_KINDS), `${path}.kind`),
    affix: source.affix === null ? null : oneOf(source.affix, AFFIXES, `${path}.affix`),
    level: whole(source.level, `${path}.level`, { min: 1 }),
    maxHp,
    hp: number(source.hp, `${path}.hp`, { max: maxHp }),
    physical: number(source.physical, `${path}.physical`),
    magical: number(source.magical, `${path}.magical`),
    attack: number(source.attack, `${path}.attack`),
    reward: number(source.reward, `${path}.reward`),
    loot: amounts(source.loot, `${path}.loot`, MATERIALS)
  }
}

/** Every item held is held by a living character of the project, which names it in its equipment. */
function checkHolders(chest, characters, path) {
  const ids = new Set()
  for (const owned of chest) {
    if (ids.has(owned.id)) fail(`${path}.chest`, `holds two items with the id ${owned.id}`)
    ids.add(owned.id)
    if (owned.heldBy !== null && !characters[owned.heldBy]) fail(`${path}.chest.${owned.id}`, 'is held by nobody here')
  }
  for (const [sessionId, member] of Object.entries(characters)) {
    for (const slot of EQUIPMENT_SLOTS) {
      const itemId = member.equipment[slot]
      if (itemId === null) continue
      const held = chest.find((owned) => owned.id === itemId)
      if (!held || held.heldBy !== sessionId || held.slot !== slot) {
        fail(`${path}.characters.${sessionId}.equipment.${slot}`, 'is not an item it holds')
      }
    }
  }
}

/** A room's run through an instance and its cooldowns, when it has them (instance-save.mjs). */
function roomInstance(source, path, { legendaryIndex, instanceIndex }) {
  const legendaryIds = new Set(legendaryIndex?.byId.keys() ?? [])
  const run = checkRun(source.run, instanceIndex, { legendaryIds, monster: (item, at) => monster(item, `${path}.${at}`) })
  if (!run.ok) fail(`${path}.${run.problem[0]}`, run.problem[1])
  const cooldowns = checkCooldowns(source.instanceCooldowns, instanceIndex)
  if (!cooldowns.ok) fail(`${path}.${cooldowns.problem[0]}`, cooldowns.problem[1])
  return { ...(run.value ? { run: run.value } : {}), ...(cooldowns.value ? { instanceCooldowns: cooldowns.value } : {}) }
}

function project(value, path, legendaryIndex, instanceIndex, traitIndex = null) {
  const source = record(value, path)
  const characters = entries(source.characters, `${path}.characters`, {
    key: text,
    entry: (item, at, id) => character(item, at, id, traitIndex)
  })
  const chest = list(source.chest, `${path}.chest`).map((owned, index) => item(owned, `${path}.chest.${index}`))
  checkHolders(chest, characters, path)
  const loot = checkRoomLegendary(source.legendary, chest, legendaryIndex)
  if (!loot.ok) fail(`${path}.${loot.problem[0]}`, loot.problem[1])
  return {
    ...(loot.legendary ? { legendary: loot.legendary } : {}),
    wave: whole(source.wave, `${path}.wave`, { min: 1 }),
    waveKills: whole(source.waveKills, `${path}.waveKills`),
    kills: whole(source.kills ?? 0, `${path}.kills`),
    monster: monster(source.monster, `${path}.monster`),
    stamina: number(source.stamina, `${path}.stamina`, { max: 1 }),
    restTicks: whole(source.restTicks, `${path}.restTicks`),
    fightMs: number(source.fightMs, `${path}.fightMs`),
    fightTicks: whole(source.fightTicks ?? 0, `${path}.fightTicks`),
    fightRested: boolean(source.fightRested ?? false, `${path}.fightRested`),
    themeId: textOrNull(source.themeId, `${path}.themeId`),
    tradeChoice: choiceOrNull(source.tradeChoice, `${path}.tradeChoice`),
    ...scarcestPart(source.scarcest, `${path}.scarcest`),
    chest,
    characters,
    retirees: list(source.retirees, `${path}.retirees`).map((entry, index) => retiree(entry, `${path}.retirees.${index}`)),
    retiredCount: whole(source.retiredCount, `${path}.retiredCount`),
    ...roomInstance(source, path, { legendaryIndex, instanceIndex }),
    ...traitPart('scrolls', checkRoomScrolls(source.scrolls, traitIndex), path)
  }
}

/** The day's offers bought in a city: each offer once, by its index (city-rank-constants.mjs). */
function soldToday(value, path) {
  const source = record(value, path)
  const offers = list(source.offers, `${path}.offers`)
    .map((index, at) => whole(index, `${path}.offers.${at}`, { max: LAST_OFFER_INDEX }))
  if (new Set(offers).size !== offers.length) fail(`${path}.offers`, 'names an offer twice')
  return { day: whole(source.day, `${path}.day`), offers }
}

/** A world's market: pressures by city and material within their bounds, the stall's sales. */
function market(value, path, cityIds) {
  if (value === undefined) return emptyMarket()
  const source = record(value, path)
  const cityKey = (id, at) => oneOf(id, cityIds, at)
  return {
    clock: numberOrNull(source.clock, `${path}.clock`),
    pressure: entries(source.pressure, `${path}.pressure`, {
      key: cityKey,
      entry: (materials, at) => entries(materials, at, {
        key: (id, materialAt) => oneOf(id, MATERIALS, materialAt),
        entry: (pressure, pressureAt) => number(pressure, pressureAt, { min: MARKET_PRESSURE_MIN, max: MARKET_PRESSURE_MAX })
      })
    }),
    sold: entries(source.sold, `${path}.sold`, { key: cityKey, entry: soldToday })
  }
}

/**
 * A world's building levels: whole numbers, each of a building its settlement has opened at the
 * stage those levels reach (without a settlement in the content, only the buildings every world had).
 */
function buildingLevels(value, path, settlementIndex) {
  const upgrades = entries(value, path, {
    key: (id, at) => oneOf(id, GROUP_UPGRADE_IDS, at),
    entry: (level, at) => whole(level, at)
  })
  for (const [upgradeId, level] of Object.entries(upgrades)) {
    if (level > 0 && !isUpgradeOpen({ upgrades }, upgradeId, settlementIndex)) {
      fail(`${path}.${upgradeId}`, 'is a building the settlement has not opened at that stage')
    }
  }
  return upgrades
}

function world(value, path, { cityIds, rankedCityIds, legendaryIndex, bestiaryIndex, settlementIndex, instanceIndex, traitIndex,
  events, quests }) {
  const source = record(value, path)
  const cityRanks = checkCityRanks(source.cityRanks, rankedCityIds)
  if (!cityRanks.ok) fail(`${path}.${cityRanks.problem[0]}`, cityRanks.problem[1])
  const checked = checkWorldBestiary(source.bestiary, bestiaryIndex)
  if (!checked.ok) fail(`${path}.${checked.problem[0]}`, checked.problem[1])
  const instances = checkWorldInstances(source.instances, instanceIndex)
  if (!instances.ok) fail(`${path}.${instances.problem[0]}`, instances.problem[1])
  const weekly = checkWeekly(source.weekly, events)
  if (!weekly.ok) fail(`${path}.${weekly.problem[0]}`, weekly.problem[1])
  const daily = checkDaily(source.daily, quests)
  if (!daily.ok) fail(`${path}.${daily.problem[0]}`, daily.problem[1])
  const projects = entries(source.projects, `${path}.projects`, {
    key: text,
    entry: (item, at) => project(item, at, legendaryIndex, instanceIndex, traitIndex)
  })
  const shared = sharedInstance(projects)
  if (shared) fail(`${path}.projects`, `has two rooms inside ${shared}`)
  return {
    // A world that never killed, or a save from before the bestiary, has none.
    ...(checked.bestiary ? { bestiary: checked.bestiary } : {}),
    // A world that never entered an instance has no progress in one.
    ...(instances.value ? { instances: instances.value } : {}),
    // A save from before the weekly events, or a world not yet advanced, has none.
    ...(weekly.value ? { weekly: weekly.value } : {}),
    // A save from before the daily quests, or a world not yet played today, has none.
    ...(daily.value ? { daily: daily.value } : {}),
    // A world that never traded, or a save from before city ranks, has none.
    ...(cityRanks.value ? { cityRanks: cityRanks.value } : {}),
    skills: entries(source.skills, `${path}.skills`, { key: (id, at) => oneOf(id, SKILL_IDS, at), entry: skill }),
    materials: amounts(source.materials, `${path}.materials`, MATERIALS),
    upgrades: buildingLevels(source.upgrades, `${path}.upgrades`, settlementIndex),
    projects,
    lastTokenAt: numberOrNull(source.lastTokenAt, `${path}.lastTokenAt`),
    // A save from before the market has neither coins nor market.
    coins: whole(source.coins ?? 0, `${path}.coins`, { max: MARKET_MAX_COINS }),
    market: market(source.market, `${path}.market`, cityIds),
    // The traits the world ever had and its brokers' sales; a world from before traits has none.
    ...traitPart('traits', checkWorldTraits(source.traits, { index: traitIndex, cityIds }), path)
  }
}

/**
 * A save from outside the plugin, rebuilt from the fields the engine writes, or the first part
 * that is not what the engine writes. Run it after `migrate`, which brings an older version up.
 *
 * @param {unknown} value
 * @param {{ cityIds?: string[], legendary?: object, bestiary?: object, bosses?: object }} [content] the
 *   ids of the market's cities, which a market may name; the parsed game/legendary.json: legendary
 *   loot must be loot it has, and without it a save that holds any is refused; the parsed
 *   game/bestiary.json and game/bosses.json, whose races and bosses a bestiary may count, and
 *   without which a save that keeps one is refused; the parsed game/settlement.json, whose stages
 *   open the buildings a world may have levels of; the parsed game/instances.json, whose instances
 *   and boons a world's progress and a room's run may name; the parsed game/traits.json, whose
 *   traits a character, a room's scrolls and a world's collection may name; the parsed
 *   game/events.json, whose events a world's week may name; `rankedCityIds`, the cities with ranks,
 *   which a world's city ranks may name; the parsed game/quests.json, whose kinds a world's daily
 *   quests may name
 * @returns {{ ok: true, save: object } | { ok: false, problem: string }}
 */
export function cleanSave(value, { cityIds = [], rankedCityIds = [], legendary, bestiary, bosses, settlement, instances, achievements, traits, events, quests } = {}) {
  const legendaryIndex = legendaryIndexOf({ legendary })
  const traitIndex = traitIndexOf({ traits })
  const instanceIndex = instanceIndexOf({ instances })
  const bestiaryIndex = indexBestiary(bestiary, bosses)
  const settlementIndex = indexSettlement(settlement)
  try {
    const source = record(value, 'the save')
    if (source.version !== SAVE_VERSION) fail('the save version', 'is not this plugin\'s')
    const worlds = entries(source.worlds, 'worlds', {
      key: text,
      entry: (item, at) => world(item, at, { cityIds, rankedCityIds, legendaryIndex, bestiaryIndex, settlementIndex, instanceIndex, traitIndex, events, quests })
    })
    const projectWorld = entries(source.projectWorld, 'projectWorld', { key: text, entry: textOrNull })
    // A project in two worlds, or in one it does not belong to, would be played twice.
    const layoutProblem = worldLayoutProblem(worlds, projectWorld)
    if (layoutProblem) fail(...layoutProblem)
    const settings = record(source.settings, 'settings')
    // Achievements and the journal (chronicle-save.mjs), when the save has them.
    const chronicle = checkChronicle(source, { index: achievementIndexOf({ achievements }), worlds })
    if (!chronicle.ok) fail(...chronicle.problem)
    const save = { version: SAVE_VERSION, worlds, projectWorld, settings: { keepTitles: boolean(settings.keepTitles, 'settings.keepTitles') },
      ...chronicle.value }
    return { ok: true, save }
  } catch (error) {
    if (error instanceof SaveProblem) return { ok: false, problem: error.message }
    throw error
  }
}

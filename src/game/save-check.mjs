// Checks a save that comes from outside the plugin (an imported file) part by part, and rebuilds it
// from the fields the engine writes, so nothing made up can be stored. `migrate` repairs what the
// plugin's own storage holds; a file is refused instead as soon as one part is not what the engine
// would have written. Pure.
import { ITEM_MAX_TIER, MONSTER_KINDS } from './constants.mjs'
import { AFFIXES } from './monsters.mjs'
import { ATTRIBUTES, CLASSES, GATHERING_SKILLS, MATERIALS, WORK_SKILLS } from './skills.mjs'
import { GROUP_UPGRADE_IDS } from './spending.mjs'
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

function boolean(value, path) {
  if (typeof value !== 'boolean') fail(path, 'is not true or false')
  return value
}

/** An object whose keys pass `key` and whose values pass `entry`, rebuilt from them. */
function entries(value, path, { key, entry }) {
  return Object.fromEntries(Object.entries(record(value, path)).map(([id, item]) => {
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
  return {
    ...checked,
    tier: whole(source.tier, `${path}.tier`, { min: 1, max: ITEM_MAX_TIER }),
    recipe: recipe.map((materialId, index) => oneOf(materialId, MATERIALS, `${path}.recipe.${index}`)),
    level: whole(source.level, `${path}.level`),
    heldBy: textOrNull(source.heldBy, `${path}.heldBy`)
  }
}

function character(value, path, sessionId) {
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
    trade: source.trade === null || source.trade === undefined
      ? null
      : oneOf(source.trade, GATHERING_SKILLS, `${path}.trade`),
    tokens: number(source.tokens, `${path}.tokens`),
    bornAt: number(source.bornAt, `${path}.bornAt`, { min: -Infinity }),
    lastSeenAt: number(source.lastSeenAt, `${path}.lastSeenAt`, { min: -Infinity }),
    skillXp: amounts(source.skillXp ?? {}, `${path}.skillXp`, WORK_SKILLS),
    gatherCarry: number(source.gatherCarry ?? 0, `${path}.gatherCarry`),
    title: textOrNull(source.title, `${path}.title`),
    state: oneOf(source.state ?? 'idle', CHARACTER_STATES, `${path}.state`)
  }
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
    trade: source.trade === null || source.trade === undefined
      ? null
      : oneOf(source.trade, GATHERING_SKILLS, `${path}.trade`),
    bornAt: numberOrNull(source.bornAt, `${path}.bornAt`)
  }
}

function monster(value, path) {
  if (value === null || value === undefined) return null
  const source = record(value, path)
  const maxHp = number(source.maxHp, `${path}.maxHp`, { min: Number.MIN_VALUE })
  return {
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
    loot: amounts(source.loot, `${path}.loot`, MATERIALS),
    sprite: entries(source.sprite, `${path}.sprite`, { key: text, entry: text })
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

function project(value, path) {
  const source = record(value, path)
  const characters = entries(source.characters, `${path}.characters`, { key: text, entry: character })
  const chest = list(source.chest, `${path}.chest`).map((owned, index) => item(owned, `${path}.chest.${index}`))
  checkHolders(chest, characters, path)
  return {
    wave: whole(source.wave, `${path}.wave`, { min: 1 }),
    waveKills: whole(source.waveKills, `${path}.waveKills`),
    monster: monster(source.monster, `${path}.monster`),
    stamina: number(source.stamina, `${path}.stamina`, { max: 1 }),
    restTicks: whole(source.restTicks, `${path}.restTicks`),
    fightMs: number(source.fightMs, `${path}.fightMs`),
    fightTicks: whole(source.fightTicks ?? 0, `${path}.fightTicks`),
    fightRested: boolean(source.fightRested ?? false, `${path}.fightRested`),
    themeId: textOrNull(source.themeId, `${path}.themeId`),
    chest,
    characters,
    retirees: list(source.retirees, `${path}.retirees`).map((entry, index) => retiree(entry, `${path}.retirees.${index}`)),
    retiredCount: whole(source.retiredCount, `${path}.retiredCount`)
  }
}

function world(value, path) {
  const source = record(value, path)
  return {
    skills: entries(source.skills, `${path}.skills`, { key: (id, at) => oneOf(id, SKILL_IDS, at), entry: skill }),
    materials: amounts(source.materials, `${path}.materials`, MATERIALS),
    upgrades: entries(source.upgrades, `${path}.upgrades`, {
      key: (id, at) => oneOf(id, GROUP_UPGRADE_IDS, at),
      entry: (level, at) => whole(level, at)
    }),
    projects: entries(source.projects, `${path}.projects`, { key: text, entry: project }),
    lastTokenAt: numberOrNull(source.lastTokenAt, `${path}.lastTokenAt`)
  }
}

/** A project kept in two worlds would be played twice. */
function checkProjectsOnce(worlds) {
  const seen = new Set()
  for (const [worldId, kept] of Object.entries(worlds)) {
    for (const projectId of Object.keys(kept.projects)) {
      if (seen.has(projectId)) fail(`worlds.${worldId}.projects.${projectId}`, 'is in two worlds')
      seen.add(projectId)
    }
  }
}

/**
 * A save from outside the plugin, rebuilt from the fields the engine writes, or the first part
 * that is not what the engine writes. Run it after `migrate`, which brings an older version up.
 *
 * @param {unknown} value
 * @returns {{ ok: true, save: object } | { ok: false, problem: string }}
 */
export function cleanSave(value) {
  try {
    const source = record(value, 'the save')
    if (source.version !== SAVE_VERSION) fail('the save version', 'is not this plugin\'s')
    const worlds = entries(source.worlds, 'worlds', { key: text, entry: world })
    checkProjectsOnce(worlds)
    const projectWorld = entries(source.projectWorld, 'projectWorld', { key: text, entry: textOrNull })
    const settings = record(source.settings, 'settings')
    const save = { version: SAVE_VERSION, worlds, projectWorld, settings: { keepTitles: boolean(settings.keepTitles, 'settings.keepTitles') } }
    return { ok: true, save }
  } catch (error) {
    if (error instanceof SaveProblem) return { ok: false, problem: error.message }
    throw error
  }
}

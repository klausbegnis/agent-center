// Checks game/instances.json (already parsed) and indexes it for the engine: the region's roadmap,
// and the instances along it, each with its races, the world level it opens at, its art, its six
// rooms, its boss and elite from the roster, its signature relic and its vault. Boons and tier
// modifiers are checked by instance-boons.mjs. Pure: problems come back as text, nothing is thrown.
import { LATER_REGION_KEYS, indexRegions, mapSizeOf, validateRegions } from './instance-regions.mjs'
import { ATTRIBUTES, MATERIALS, WORK_SKILLS } from './skills.mjs'

/** The rooms of every instance, in order. The third is a trap or a puzzle. */
export const ROOM_KINDS = Object.freeze(['entrance', 'hall', 'trap', 'puzzle', 'elite', 'vault', 'boss'])
const ROOM_ORDER = [['entrance'], ['hall'], ['trap', 'puzzle'], ['elite'], ['vault'], ['boss']]
/** Rooms with a fight, and rooms with a check. */
export const FIGHT_ROOMS = Object.freeze(['entrance', 'hall', 'elite', 'boss'])
export const CHECK_ROOMS = Object.freeze(['trap', 'puzzle'])

const TOP_KEYS = ['region', 'regions', 'instances', 'boons', 'modifiers']
const INSTANCE_KEYS = [
  'id', 'name', 'races', 'opensAt', 'banner', 'card', 'alt', 'route', 'map', 'boss', 'elite', 'relic', 'loot',
  'vault', 'rooms', 'modifiers', 'region'
]
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/
/** Art is served with the UI, so the panel, the tab and the external view all reach it. */
const ART_PATH = /^ui\/instances\/[a-z0-9]+(-[a-z0-9]+)*\.png$/
/** A name sits on a card in a 380 px sidebar. */
const TEXT_LIMIT = 60
const ALT_LIMIT = 200
/** A world level an instance could ever open at; past it an instance is a mistake, not a goal. */
const MAX_OPENS_AT = 1000
/**
 * Legendary kinds a vault may hold: a boss's own equipment. Never a relic: a city's is the stalls'
 * to sell, and a boss's own relic comes only from that boss.
 */
const VAULT_KINDS = ['equipment']

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isShortText = (value, limit = TEXT_LIMIT) => typeof value === 'string' && value.trim() !== '' && value.length <= limit
const isArt = (value) => typeof value === 'string' && ART_PATH.test(value)
const unknownKeys = (name, value, known) =>
  Object.keys(value).filter((key) => !known.includes(key)).map((key) => `${name}: "${key}" is not a known key`)

/** Problems of a point on the roadmap: whole pixels inside the map. */
function checkPoint(name, point, map) {
  const inside = (value, size) => Number.isInteger(value) && value >= 0 && value < size
  if (!isObject(point) || !inside(point.x, map?.width ?? 0) || !inside(point.y, map?.height ?? 0)) {
    return [`${name}: "map" must be { x, y } in whole pixels inside the roadmap`]
  }
  return unknownKeys(name, point, ['x', 'y'])
}

function checkRegion(region, name = 'region', keys = ['id', 'name', 'title', 'map', 'maps']) {
  if (!isObject(region)) return [`"${name}" must be an object`]
  const problems = unknownKeys(name, region, keys)
  if (typeof region.id !== 'string' || !KEBAB_CASE.test(region.id)) problems.push(`${name}: "id" must be in kebab-case`)
  for (const key of ['name', 'title']) {
    if (!isShortText(region[key])) problems.push(`${name}: "${key}" must be text of at most ${TEXT_LIMIT} characters`)
  }
  const size = region.map
  if (!isObject(size) || !Number.isInteger(size.width) || !Number.isInteger(size.height) || size.width < 1 || size.height < 1) {
    problems.push(`${name}: "map" must be { width, height } in whole pixels`)
  }
  const maps = region.maps
  const isMap = (map) => isObject(map) && Number.isInteger(map.cleared) && map.cleared >= 0 && isArt(map.art) &&
    isShortText(map.alt, ALT_LIMIT) && unknownKeys('', map, ['cleared', 'art', 'alt']).length === 0
  if (!Array.isArray(maps) || maps.length === 0 || !maps.every(isMap)) {
    problems.push(`${name}: "maps" must list { cleared, art, alt }, art a PNG under ui/instances/`)
  } else if (maps[0].cleared !== 0 || maps.some((map, at) => at > 0 && map.cleared <= maps[at - 1].cleared)) {
    problems.push(`${name}: "maps" must start at 0 cleared and rise`)
  }
  return problems
}

/** Problems of the six rooms: the order of their kinds, a name each, a check for a trap or a puzzle. */
function checkRooms(name, rooms) {
  if (!Array.isArray(rooms) || rooms.length !== ROOM_ORDER.length) return [`${name}: "rooms" must list six rooms`]
  const problems = []
  rooms.forEach((room, at) => {
    const where = `${name}: room ${at + 1}`
    if (!isObject(room)) return problems.push(`${where} must be an object`)
    problems.push(...unknownKeys(where, room, ['kind', 'name', 'check']))
    if (!ROOM_ORDER[at].includes(room.kind)) problems.push(`${where} must be ${ROOM_ORDER[at].join(' or ')}`)
    if (!isShortText(room.name)) problems.push(`${where}: "name" must be text of at most ${TEXT_LIMIT} characters`)
    if (CHECK_ROOMS.includes(room.kind)) problems.push(...checkCheck(where, room.check))
    else if (room.check !== undefined) problems.push(`${where}: only a trap or a puzzle has a "check"`)
  })
  return problems
}

/** A check is against one attribute of the party or one work skill of the world. */
function checkCheck(where, check) {
  const isAttribute = isObject(check) && ATTRIBUTES.includes(check.attribute) && Object.keys(check).length === 1
  const isSkill = isObject(check) && WORK_SKILLS.includes(check.skill) && Object.keys(check).length === 1
  return isAttribute || isSkill ? [] : [`${where}: "check" must be { attribute } or { skill } of a work skill`]
}

/** Problems of the instance's boss and elite: bosses of the roster, of its races, in no other instance. */
function checkBosses(name, entry, context) {
  const problems = []
  for (const key of ['boss', 'elite']) {
    const boss = context.bossById.get(entry[key])
    if (!boss) {
      problems.push(`${name}: "${key}" must be the id of a boss in game/bosses.json`)
      continue
    }
    if (Array.isArray(entry.races) && !entry.races.includes(boss.race)) problems.push(`${name}: its ${key} is not of its races`)
    if (context.bossesUsed.has(boss.id)) problems.push(`${name}: the boss "${boss.id}" already belongs to an instance`)
    context.bossesUsed.add(boss.id)
  }
  if (entry.boss === entry.elite) problems.push(`${name}: its boss and elite must differ`)
  return problems
}

/**
 * A vault holds bosses' own equipment, each at most once: its elite's, and others of the roster,
 * never a relic, nor one an instance's boss guards or another instance's elite carries.
 */
function checkVault(name, { vault, elite }, context) {
  if (!Array.isArray(vault) || vault.length === 0 || new Set(vault).size !== vault.length) {
    return [`${name}: "vault" must list legendary ids, each once`]
  }
  const problems = []
  for (const id of vault) {
    const entry = context.legendaryById.get(id)
    if (!entry || !VAULT_KINDS.includes(entry.kind)) problems.push(`${name}: "${id}" is not a boss's item in game/legendary.json`)
    else if (context.instanceBosses.has(entry.boss)) problems.push(`${name}: "${id}" is the item of an instance's boss`)
    else if (context.instanceElites.has(entry.boss) && entry.boss !== elite) problems.push(`${name}: "${id}" is another instance's elite's`)
  }
  return problems
}

function checkArt(name, entry) {
  const problems = []
  for (const key of ['banner', 'card']) if (!isArt(entry[key])) problems.push(`${name}: "${key}" must be a PNG under ui/instances/`)
  if (!isShortText(entry.alt, ALT_LIMIT)) problems.push(`${name}: "alt" must describe the banner`)
  if (entry.route === undefined) return problems
  const route = entry.route
  if (!isObject(route) || !['start', 'mid', 'boss'].every((key) => isArt(route[key])) || !isShortText(route.alt, ALT_LIMIT)) {
    problems.push(`${name}: "route" must be { start, mid, boss, alt }, each a PNG under ui/instances/`)
  } else {
    problems.push(...unknownKeys(`${name}: route`, route, ['start', 'mid', 'boss', 'alt']))
  }
  return problems
}

function checkInstance(entry, index, context) {
  if (!isObject(entry)) return [`instances[${index}] must be an object`]
  const name = `instance "${entry.id ?? index}"`
  const problems = unknownKeys(name, entry, INSTANCE_KEYS)
  if (typeof entry.id !== 'string' || !KEBAB_CASE.test(entry.id)) problems.push(`${name}: "id" must be in kebab-case`)
  else if (context.seenIds.has(entry.id)) problems.push(`${name}: another instance has the same id`)
  context.seenIds.add(entry.id)
  if (!isShortText(entry.name)) problems.push(`${name}: "name" must be text of at most ${TEXT_LIMIT} characters`)
  const races = entry.races
  if (!Array.isArray(races) || races.length === 0 || new Set(races).size !== races.length || !races.every((id) => context.raceIds.has(id))) {
    problems.push(`${name}: "races" must list races of game/races.json, each once`)
  }
  if (!Number.isInteger(entry.opensAt) || entry.opensAt < 1 || entry.opensAt > MAX_OPENS_AT) {
    problems.push(`${name}: "opensAt" must be a world level from 1 to ${MAX_OPENS_AT}`)
  } else if (entry.opensAt < context.lastOpensAt) {
    problems.push(`${name}: "opensAt" must not be below the instance before it on the road`)
  } else {
    context.lastOpensAt = entry.opensAt
  }
  const loot = entry.loot
  if (!isObject(loot) || Object.keys(loot).length === 0 ||
    !Object.entries(loot).every(([id, weight]) => MATERIALS.includes(id) && Number.isInteger(weight) && weight > 0)) {
    problems.push(`${name}: "loot" must weigh materials with whole numbers above 0`)
  }
  if (typeof entry.relic !== 'string' || !KEBAB_CASE.test(entry.relic)) problems.push(`${name}: "relic" must be a legendary id`)
  return [
    ...problems,
    ...checkArt(name, entry),
    ...checkPoint(name, entry.map, mapSizeOf(context.data, entry)),
    ...checkBosses(name, entry, context),
    ...checkVault(name, entry, context),
    ...checkRooms(name, entry.rooms)
  ]
}

/**
 * Everything wrong with a parsed game/instances.json, apart from its boons and tier modifiers
 * (instance-boons.mjs). Empty when it is valid.
 *
 * @param {unknown} data
 * @param {{ races?: { races: { id: string }[] }, bosses?: { bosses: { id: string, race: string }[] },
 *   legendary?: { legendary: object[] } }} [others] the parsed races, bosses and legendary loot the
 *   instances name
 * @returns {string[]}
 */
export function validateInstances(data, { races, bosses, legendary } = {}) {
  if (!isObject(data) || !Array.isArray(data.instances) || data.instances.length === 0) {
    return ['must be an object with an "instances" list']
  }
  const problems = Object.keys(data).filter((key) => !TOP_KEYS.includes(key)).map((key) => `"${key}" is not a known key`)
  problems.push(...checkRegion(data.region))
  problems.push(...validateRegions(data, (region, name) => checkRegion(region, name, LATER_REGION_KEYS)))
  const context = {
    seenIds: new Set(),
    bossesUsed: new Set(),
    lastOpensAt: 1,
    data,
    raceIds: new Set((races?.races ?? []).map((race) => race.id)),
    bossById: new Map((bosses?.bosses ?? []).map((boss) => [boss.id, boss])),
    legendaryById: new Map((legendary?.legendary ?? []).map((entry) => [entry.id, entry])),
    instanceBosses: new Set(data.instances.filter(isObject).map((entry) => entry.boss)),
    instanceElites: new Set(data.instances.filter(isObject).map((entry) => entry.elite))
  }
  data.instances.forEach((entry, index) => problems.push(...checkInstance(entry, index, context)))
  return problems
}

/**
 * @typedef {{ region: object, regions: object[], instances: object[], byId: Map<string, object>, order: string[],
 *   byRelic: Map<string, object>, boons: object[], boonById: Map<string, object>,
 *   modifierById: Map<string, object> }} InstanceIndex
 */

/**
 * The content indexed for the engine: the instances in the order of the road, by id and by relic,
 * and the boons and tier modifiers by id.
 *
 * @param {object | null | undefined} data a valid instances file, or none
 * @returns {InstanceIndex | null} null without content: the engine then has no instances
 */
export function indexInstances(data) {
  if (!data) return null
  const instances = data.instances
  return {
    region: data.region,
    // Every region of the road, the first included, with its instances (instance-regions.mjs).
    regions: indexRegions(data),
    instances,
    byId: new Map(instances.map((entry) => [entry.id, entry])),
    order: instances.map((entry) => entry.id),
    byRelic: new Map(instances.map((entry) => [entry.relic, entry])),
    boons: data.boons ?? [],
    boonById: new Map((data.boons ?? []).map((boon) => [boon.id, boon])),
    modifierById: new Map((data.modifiers ?? []).map((modifier) => [modifier.id, modifier]))
  }
}

const indexes = new WeakMap()

/**
 * The instance index of a set of content, built once per content file.
 *
 * @param {{ instances?: object } | null | undefined} content
 * @returns {InstanceIndex | null}
 */
export function instanceIndexOf(content) {
  const data = content?.instances
  if (!data) return null
  if (!indexes.has(data)) indexes.set(data, indexInstances(data))
  return indexes.get(data)
}

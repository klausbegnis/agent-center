// Checks game/legendary.json (already parsed) and indexes it for the engine. An entry is a relic,
// a boss-owned relic or a piece of legendary equipment, and its buff is data: one effect of a
// closed set of types, with an amount and a few qualifiers, that the engine interprets
// (legendary-effects.mjs). Pure: problems come back as text, nothing is thrown.
import { LEGENDARY_EFFECT_CAPS, MONSTER_RANKS } from './constants.mjs'
import { CLASSES, GATHERING_SKILLS, MATERIALS, WORK_SKILLS } from './skills.mjs'

export const LEGENDARY_KINDS = Object.freeze(['relic', 'boss-relic', 'equipment', 'instance-relic'])
/**
 * The kinds a room owns as relics, one of which it can make active. An instance relic is the reward
 * of an instance's first clear (game/instances.json): never sold and never dropped.
 */
export const RELIC_KINDS = Object.freeze(['relic', 'boss-relic', 'instance-relic'])

/**
 * The effect types: where each may act (`party` for an active relic, `holder` for equipment, on
 * the character holding it or, for a party quantity, on its party while it fights, `world` for the
 * bestiary, on every party of its world) and the qualifiers it takes. Every type's amount is
 * capped by LEGENDARY_EFFECT_CAPS.
 */
export const EFFECT_TYPES = Object.freeze({
  attackSpeed: { scopes: ['party', 'holder'], qualifiers: [] },
  damage: { scopes: ['party', 'holder', 'world'], qualifiers: ['damageType', 'ranks'] },
  critChance: { scopes: ['holder'], qualifiers: [] },
  critDamage: { scopes: ['party', 'world'], qualifiers: [] },
  staminaDrain: { scopes: ['party', 'holder', 'world'], qualifiers: [] },
  staminaPool: { scopes: ['party', 'world'], qualifiers: [] },
  outfitStamina: { scopes: ['holder'], qualifiers: [] },
  restTime: { scopes: ['party', 'world'], qualifiers: [] },
  staminaPerKill: { scopes: ['party', 'world'], qualifiers: [] },
  healing: { scopes: ['holder'], qualifiers: [] },
  supportAura: { scopes: ['holder'], qualifiers: [] },
  affixWeakening: { scopes: ['party', 'world'], qualifiers: [] },
  thorns: { scopes: ['party', 'world'], qualifiers: [] },
  runeCircle: { scopes: ['party', 'world'], qualifiers: [] },
  itemDrop: { scopes: ['party', 'world'], qualifiers: [] },
  killMaterials: { scopes: ['party', 'world'], qualifiers: ['materials'] },
  gatherYield: { scopes: ['party', 'holder'], qualifiers: ['materials'] },
  gatherHours: { scopes: ['party', 'world'], qualifiers: [] },
  gatherXp: { scopes: ['party', 'world'], qualifiers: [] },
  characterXp: { scopes: ['party', 'world'], qualifiers: [] },
  // An instance relic's (game/instances.json) acts on every character of the room.
  skillXp: { scopes: ['party', 'holder'], qualifiers: ['skill'] },
  upgradeCost: { scopes: ['party', 'world'], qualifiers: [] },
  // The bestiary's: damage against monsters of the races listed, and legendary pity that grows faster.
  // An instance relic's acts on its room's party.
  raceDamage: { scopes: ['party', 'world'], qualifiers: ['races'] },
  legendaryPity: { scopes: ['world'], qualifiers: [] },
  // The settlement's Storehouse: the market's fee lowered by the amount.
  marketFee: { scopes: ['world'], qualifiers: [] }
})

const ENTRY_KEYS = [
  'id', 'name', 'kind', 'city', 'boss', 'slot', 'damageType', 'class', 'trade', 'recipe', 'effect', 'flavour',
  'colour', 'instance'
]
/** The keys each kind may have beyond the shared ones. */
const KIND_KEYS = {
  relic: ['city'],
  'boss-relic': ['boss'],
  equipment: ['boss', 'slot', 'damageType', 'class', 'trade', 'recipe'],
  'instance-relic': ['instance']
}
const SHARED_KEYS = ['id', 'name', 'kind', 'effect', 'flavour', 'colour']
const SLOTS = ['weapon', 'outfit', 'tool']
const DAMAGE_TYPES = ['physical', 'magical']
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const HEX_COLOUR = /^#[0-9A-Fa-f]{6}$/

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isFilledString = (value) => typeof value === 'string' && value.trim() !== ''
const isDistinctList = (value, allowed) => Array.isArray(value) && value.length > 0 &&
  value.every((item) => allowed.includes(item)) && new Set(value).size === value.length

/** The scope an entry's effect must have: a relic acts on the party, equipment on its holder. */
export const scopeOfKind = (kind) => (kind === 'equipment' ? 'holder' : 'party')

/** Problems of an effect's qualifiers: only the type's own, each well formed. */
function checkQualifiers(name, effect, type, raceIds) {
  const problems = []
  const known = ['effect', 'scope', 'amount', ...type.qualifiers]
  for (const key of Object.keys(effect).filter((key) => !known.includes(key))) {
    problems.push(`${name}: "effect.${key}" is not a qualifier of ${effect.effect}`)
  }
  if (effect.damageType !== undefined && !DAMAGE_TYPES.includes(effect.damageType)) {
    problems.push(`${name}: "effect.damageType" must be one of: ${DAMAGE_TYPES.join(', ')}`)
  }
  if (effect.ranks !== undefined && !isDistinctList(effect.ranks, Object.keys(MONSTER_RANKS))) {
    problems.push(`${name}: "effect.ranks" must list distinct ranks`)
  }
  if (effect.materials !== undefined && !isDistinctList(effect.materials, MATERIALS)) {
    problems.push(`${name}: "effect.materials" must list distinct materials`)
  }
  if (type.qualifiers.includes('skill') && !WORK_SKILLS.includes(effect.skill)) {
    problems.push(`${name}: "effect.skill" must be one of: ${WORK_SKILLS.join(', ')}`)
  }
  if (effect.races !== undefined && !isDistinctList(effect.races, raceIds ?? effect.races)) {
    problems.push(`${name}: "effect.races" must list distinct races of game/races.json`)
  }
  return problems
}

/**
 * Problems of an effect: a known type that may act in `scope`, an amount above 0 and at most the
 * type's cap, and only the type's qualifiers. Shared by legendary loot and the bestiary.
 *
 * @param {string} name how the problems name the effect's owner
 * @param {unknown} effect
 * @param {string} scope the scope the owner's effects must have
 * @param {{ raceIds?: string[] }} [known] the race ids a `races` qualifier may name
 * @returns {string[]}
 */
export function effectProblems(name, effect, scope, { raceIds } = {}) {
  if (!isObject(effect)) return [`${name}: "effect" must be an object`]
  const type = EFFECT_TYPES[effect.effect]
  if (!Object.hasOwn(EFFECT_TYPES, effect.effect ?? '')) {
    return [`${name}: "effect.effect" must be one of: ${Object.keys(EFFECT_TYPES).join(', ')}`]
  }
  const problems = []
  if (effect.scope !== scope) problems.push(`${name}: its effect has the scope "${scope}"`)
  if (!type.scopes.includes(effect.scope)) problems.push(`${name}: ${effect.effect} cannot act on the ${effect.scope}`)
  const cap = LEGENDARY_EFFECT_CAPS[effect.effect]
  const amount = effect.amount
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > cap) {
    problems.push(`${name}: "effect.amount" must be above 0 and at most ${cap}`)
  }
  return [...problems, ...checkQualifiers(name, effect, type, raceIds)]
}

/** Problems of an entry's effect: its kind's scope (a relic acts on the party, equipment on its holder). */
function checkEffect(name, entry) {
  const problems = effectProblems(name, entry.effect, scopeOfKind(entry.kind))
  return problems.map((problem) => problem.replace(': its effect has the scope', `: a ${entry.kind}'s effect has the scope`))
}

/** Problems of what an equipment entry is: slot, damage type, who it is made for, its recipe. */
function checkEquipment(name, entry) {
  const problems = []
  if (!SLOTS.includes(entry.slot)) problems.push(`${name}: "slot" must be one of: ${SLOTS.join(', ')}`)
  if (entry.slot === 'weapon' && !DAMAGE_TYPES.includes(entry.damageType)) {
    problems.push(`${name}: a weapon's "damageType" must be one of: ${DAMAGE_TYPES.join(', ')}`)
  }
  if (entry.slot !== 'weapon' && entry.damageType !== undefined) problems.push(`${name}: only a weapon has a "damageType"`)
  if (entry.slot === 'tool') {
    if (!GATHERING_SKILLS.includes(entry.trade)) problems.push(`${name}: a tool's "trade" must be a gathering skill`)
    if (entry.class !== undefined) problems.push(`${name}: a tool is for any class; it names a "trade"`)
  } else {
    if (!CLASSES.includes(entry.class)) problems.push(`${name}: "class" must be one of: ${CLASSES.join(', ')}`)
    if (entry.trade !== undefined) problems.push(`${name}: only a tool has a "trade"`)
  }
  const classType = entry.class === 'magical' ? 'magical' : 'physical'
  if (entry.slot === 'weapon' && CLASSES.includes(entry.class) && entry.damageType !== classType) {
    problems.push(`${name}: a ${entry.class} character never holds a ${entry.damageType} weapon`)
  }
  const recipe = entry.recipe
  const isPair = Array.isArray(recipe) && recipe.length === 2 && recipe[0] !== recipe[1]
  if (!isPair || !recipe.every((material) => MATERIALS.includes(material))) {
    problems.push(`${name}: "recipe" must be two different materials`)
  }
  return problems
}

/**
 * Problems of where an entry comes from: a city of game/cities.json for a relic (any kebab-case id
 * when no cities are given), an instance for an instance relic (instance-content.mjs checks that it
 * exists and names the relic), a boss of the roster otherwise.
 */
function checkSource(name, entry, { bossIds, bossesUsed, cityIds }) {
  if (entry.kind === 'instance-relic') {
    return typeof entry.instance === 'string' && KEBAB_CASE.test(entry.instance)
      ? []
      : [`${name}: "instance" must be the id of an instance in game/instances.json`]
  }
  if (entry.kind === 'relic') {
    if (typeof entry.city !== 'string' || !KEBAB_CASE.test(entry.city)) return [`${name}: "city" must be a city id in kebab-case`]
    return cityIds && !cityIds.has(entry.city) ? [`${name}: "city" must be the id of a city in game/cities.json`] : []
  }
  if (!bossIds.has(entry.boss)) return [`${name}: "boss" must be the id of a boss in game/bosses.json`]
  if (bossesUsed.has(entry.boss)) return [`${name}: the boss "${entry.boss}" already has an item`]
  bossesUsed.add(entry.boss)
  return []
}

function checkEntry(entry, index, context) {
  if (!isObject(entry)) return [`legendary[${index}] must be an object`]
  const name = `legendary "${entry.id ?? index}"`
  const problems = []
  const allowed = [...SHARED_KEYS, ...(KIND_KEYS[entry.kind] ?? [])]
  for (const key of Object.keys(entry).filter((key) => !allowed.includes(key))) {
    problems.push(`${name}: "${key}" is not a known key${ENTRY_KEYS.includes(key) ? ` for a ${entry.kind}` : ''}`)
  }
  if (typeof entry.id !== 'string' || !KEBAB_CASE.test(entry.id)) problems.push(`${name}: "id" must be in kebab-case`)
  else if (context.seenIds.has(entry.id)) problems.push(`${name}: another entry has the same id`)
  else if (context.itemIds.has(entry.id)) problems.push(`${name}: game/items.json has an item with the same id`)
  context.seenIds.add(entry.id)
  if (!LEGENDARY_KINDS.includes(entry.kind)) {
    return [...problems, `${name}: "kind" must be one of: ${LEGENDARY_KINDS.join(', ')}`]
  }
  for (const key of ['name', 'flavour']) {
    if (!isFilledString(entry[key])) problems.push(`${name}: "${key}" must be a non-empty string`)
  }
  if (!HEX_COLOUR.test(entry.colour ?? '')) problems.push(`${name}: "colour" must be a colour like #A0522D`)
  problems.push(...checkSource(name, entry, context))
  if (entry.kind === 'equipment') problems.push(...checkEquipment(name, entry))
  return [...problems, ...checkEffect(name, entry)]
}

/**
 * Everything wrong with a parsed game/legendary.json. Empty when it is valid.
 *
 * @param {unknown} data
 * @param {{ bosses?: { bosses: { id: string }[] }, items?: { items: { id: string }[] },
 *   cities?: { cities: { id: string }[] } }} [others] the parsed bosses (the ids entries name),
 *   items (ids an entry must not reuse) and cities (the ids relics name)
 * @returns {string[]}
 */
export function validateLegendary(data, { bosses, items, cities } = {}) {
  if (!isObject(data) || !Array.isArray(data.legendary)) return ['must be an object with a "legendary" list']
  const problems = Object.keys(data).filter((key) => key !== 'legendary').map((key) => `"${key}" is not a known key`)
  const context = {
    seenIds: new Set(),
    bossesUsed: new Set(),
    bossIds: new Set((bosses?.bosses ?? []).map((boss) => boss.id)),
    itemIds: new Set((items?.items ?? []).map((item) => item.id)),
    cityIds: Array.isArray(cities?.cities) ? new Set(cities.cities.map((city) => city.id)) : null
  }
  data.legendary.forEach((entry, index) => problems.push(...checkEntry(entry, index, context)))
  return problems
}

/**
 * @typedef {{ byId: Map<string, object>, poolRelicIds: string[], relicIds: Set<string>,
 *   equipmentIds: Set<string>, byBoss: Map<string, object>, relicCount: number,
 *   equipmentCount: number }} LegendaryIndex
 */

/**
 * The content indexed for the engine: entries by id, the pool relics (those a city sells, in the
 * file's order), and each named boss's own item.
 *
 * @param {{ legendary: object[] } | null | undefined} data a valid legendary file, or none
 * @returns {LegendaryIndex | null} null without content: the engine then has no legendary loot
 */
export function indexLegendary(data) {
  if (!data) return null
  const entries = data.legendary
  const ofKind = (...kinds) => entries.filter((entry) => kinds.includes(entry.kind))
  return {
    byId: new Map(entries.map((entry) => [entry.id, entry])),
    poolRelicIds: ofKind('relic').map((entry) => entry.id),
    relicIds: new Set(ofKind(...RELIC_KINDS).map((entry) => entry.id)),
    equipmentIds: new Set(ofKind('equipment').map((entry) => entry.id)),
    byBoss: new Map(entries.filter((entry) => entry.boss).map((entry) => [entry.boss, entry])),
    relicCount: ofKind(...RELIC_KINDS).length,
    equipmentCount: ofKind('equipment').length
  }
}

/**
 * The relics a city's stall can offer a room now: the pool relics of that city the room does not
 * own yet, in the file's order. Boss-owned relics are never sold. Pure, so the market's stall can
 * call it with the room's owned ids and pick by its own rules.
 *
 * @param {LegendaryIndex | null} index
 * @param {{ cityId: string, ownedIds?: string[] }} where
 * @returns {object[]} the content entries
 */
export function relicsCityCanOffer(index, { cityId, ownedIds = [] }) {
  if (!index) return []
  const owned = new Set(ownedIds)
  return index.poolRelicIds
    .map((id) => index.byId.get(id))
    .filter((entry) => entry.city === cityId && !owned.has(entry.id))
}

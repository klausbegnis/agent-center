// Checks the game's content files (monsters and items, already parsed) and picks the monster
// entries that fit a room's theme. Pure: problems come back as text, nothing is thrown.
import { ITEM_MAX_TIER, MONSTER_KINDS } from './constants.mjs'
import { MATERIALS } from './skills.mjs'

/** The body shapes the scene can draw a monster with. */
const MONSTER_BODIES = ['blob', 'tall', 'wide', 'swarm', 'floating']
const MONSTER_KEYS = ['id', 'name', 'kind', 'loot', 'sprite', 'themes']
const SPRITE_KEYS = ['body', 'accent']
const ITEM_SLOTS = ['weapon', 'outfit', 'tool']
const DAMAGE_TYPES = ['physical', 'magical']
const ITEM_KEYS = ['id', 'name', 'slot', 'damageType', 'tier', 'recipe', 'themes']
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const HEX_COLOUR = /^#[0-9A-Fa-f]{6}$/

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isGeneric = (entry) => entry.themes === undefined
const isFilledString = (value) => typeof value === 'string' && value.trim() !== ''

/** The list under `key`, or a problem when the file does not hold one. */
function entriesOf(data, key, problems) {
  if (!isObject(data) || !Array.isArray(data[key])) {
    problems.push(`must be an object with a "${key}" list`)
    return []
  }
  for (const extra of Object.keys(data).filter((name) => name !== key)) {
    problems.push(`"${extra}" is not a known key`)
  }
  return data[key]
}

/** Problems shared by every entry: an object, a unique kebab-case id, a name, known keys, themes. */
function checkCommon(entry, index, label, knownKeys, seenIds) {
  if (!isObject(entry)) return [`${label}[${index}] must be an object`]
  const name = `${label} "${entry.id ?? index}"`
  const problems = []
  for (const key of Object.keys(entry).filter((key) => !knownKeys.includes(key))) {
    problems.push(`${name}: "${key}" is not a known key`)
  }
  if (typeof entry.id !== 'string' || !KEBAB_CASE.test(entry.id)) {
    problems.push(`${name}: "id" must be in kebab-case`)
  } else if (seenIds.has(entry.id)) {
    problems.push(`${name}: another entry has the same id`)
  }
  seenIds.add(entry.id)
  if (!isFilledString(entry.name)) problems.push(`${name}: "name" must be a non-empty string`)
  const { themes } = entry
  const hasThemes = Array.isArray(themes) && themes.length > 0 && themes.every(isFilledString)
  if (entry.themes !== undefined && !hasThemes) {
    problems.push(`${name}: "themes" must be a non-empty list of theme ids`)
  }
  return problems
}

function checkLoot(name, loot) {
  if (!isObject(loot) || Object.keys(loot).length === 0) {
    return [`${name}: "loot" must map one or more materials to weights`]
  }
  const problems = []
  for (const [material, weight] of Object.entries(loot)) {
    if (!MATERIALS.includes(material)) problems.push(`${name}: "${material}" is not a material`)
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
      problems.push(`${name}: the weight of "${material}" must be a number above 0`)
    }
  }
  return problems
}

function checkSprite(name, sprite) {
  if (!isObject(sprite)) return [`${name}: "sprite" must be an object with "body" and "accent"`]
  const problems = []
  for (const key of Object.keys(sprite).filter((key) => !SPRITE_KEYS.includes(key))) {
    problems.push(`${name}: "sprite.${key}" is not a known key`)
  }
  if (!MONSTER_BODIES.includes(sprite.body)) {
    problems.push(`${name}: "sprite.body" must be one of: ${MONSTER_BODIES.join(', ')}`)
  }
  if (typeof sprite.accent !== 'string' || !HEX_COLOUR.test(sprite.accent)) {
    problems.push(`${name}: "sprite.accent" must be a colour like #A0522D`)
  }
  return problems
}

function checkMonster(entry, index, seenIds) {
  const problems = checkCommon(entry, index, 'monster', MONSTER_KEYS, seenIds)
  if (!isObject(entry)) return problems
  const name = `monster "${entry.id ?? index}"`
  if (!Object.hasOwn(MONSTER_KINDS, entry.kind)) {
    problems.push(`${name}: "kind" must be one of: ${Object.keys(MONSTER_KINDS).join(', ')}`)
  }
  return [...problems, ...checkLoot(name, entry.loot), ...checkSprite(name, entry.sprite)]
}

/**
 * Everything wrong with a parsed game/monsters.json. Empty when it is valid.
 *
 * @param {unknown} data
 * @returns {string[]}
 */
export function validateMonsters(data) {
  const problems = []
  const entries = entriesOf(data, 'monsters', problems)
  const seenIds = new Set()
  entries.forEach((entry, index) => problems.push(...checkMonster(entry, index, seenIds)))
  const generic = entries.filter((entry) => isObject(entry) && isGeneric(entry))
  for (const kind of Object.keys(MONSTER_KINDS)) {
    if (!generic.some((entry) => entry.kind === kind)) {
      problems.push(`needs at least one generic (theme-less) monster of kind "${kind}"`)
    }
  }
  return problems
}

function checkRecipe(name, recipe) {
  const isPair = Array.isArray(recipe) && recipe.length === 2
  if (!isPair || !recipe.every((material) => MATERIALS.includes(material)) || recipe[0] === recipe[1]) {
    return [`${name}: "recipe" must be two different materials`]
  }
  return []
}

function checkItem(entry, index, seenIds) {
  const problems = checkCommon(entry, index, 'item', ITEM_KEYS, seenIds)
  if (!isObject(entry)) return problems
  const name = `item "${entry.id ?? index}"`
  if (!ITEM_SLOTS.includes(entry.slot)) {
    problems.push(`${name}: "slot" must be one of: ${ITEM_SLOTS.join(', ')}`)
  }
  if (entry.slot === 'weapon' && !DAMAGE_TYPES.includes(entry.damageType)) {
    problems.push(`${name}: a weapon's "damageType" must be one of: ${DAMAGE_TYPES.join(', ')}`)
  }
  if (entry.slot !== 'weapon' && entry.damageType !== undefined) {
    problems.push(`${name}: only a weapon has a "damageType"`)
  }
  if (!Number.isInteger(entry.tier) || entry.tier < 1 || entry.tier > ITEM_MAX_TIER) {
    problems.push(`${name}: "tier" must be a whole number from 1 to ${ITEM_MAX_TIER}`)
  }
  return [...problems, ...checkRecipe(name, entry.recipe)]
}

/** The generic items every theme can fall back to: a weapon of each damage type, an outfit, a tool. */
const REQUIRED_GENERIC_ITEMS = [
  { label: 'physical weapon', matches: (item) => item.slot === 'weapon' && item.damageType === 'physical' },
  { label: 'magical weapon', matches: (item) => item.slot === 'weapon' && item.damageType === 'magical' },
  { label: 'outfit', matches: (item) => item.slot === 'outfit' },
  { label: 'tool', matches: (item) => item.slot === 'tool' }
]

/**
 * Everything wrong with a parsed game/items.json. Empty when it is valid.
 *
 * @param {unknown} data
 * @returns {string[]}
 */
export function validateItems(data) {
  const problems = []
  const entries = entriesOf(data, 'items', problems)
  const seenIds = new Set()
  entries.forEach((entry, index) => problems.push(...checkItem(entry, index, seenIds)))
  const generic = entries.filter((entry) => isObject(entry) && isGeneric(entry))
  for (const { label, matches } of REQUIRED_GENERIC_ITEMS) {
    if (!generic.some(matches)) problems.push(`needs at least one generic (theme-less) ${label}`)
  }
  return problems
}

/**
 * The monster entries of a kind for a room's theme: the theme's own, or the generic ones when
 * the theme has none of that kind. Keeps the file's order, so a hash over the list is stable.
 *
 * @param {{ monsters: object[] }} data a valid monsters file
 * @param {{ kind: string, themeId?: string | null }} which
 * @returns {object[]}
 */
export function monstersFor(data, { kind, themeId }) {
  const ofKind = data.monsters.filter((entry) => entry.kind === kind)
  const themed = ofKind.filter((entry) => !isGeneric(entry) && entry.themes.includes(themeId))
  return themed.length ? themed : ofKind.filter(isGeneric)
}

// What a run of an instance adds beyond the usual effects: the boons offered in the vault (one
// chosen, lasting the rest of the run) and the modifier of each tier above the first, which makes
// the run differ from the last. Both are data in game/instances.json, interpreted here by a closed
// set of types, apart from legendary loot's: a boon or a modifier never touches the effects summed
// under LEGENDARY_EFFECT_CAPS, so the caps hold with a run as without. Pure.
import { AFFIXES } from './monsters.mjs'

/**
 * The boons' types, each with the most it may be. `whole` amounts are counts. A boon lasts from
 * the vault, where it is chosen, to the end of the run: the boss's room and the rewards.
 */
export const BOON_TYPES = Object.freeze({
  // Hits against the boss × (1 + a).
  bossDamage: { max: 0.5 },
  // The boss's strikes × (1 − a).
  bossAttack: { max: 0.5 },
  // The party's stamina goes up by a of its pool when the boon is chosen.
  staminaNow: { max: 1 },
  // A rest takes (1 − a) of its time, in whole ticks.
  restShort: { max: 0.75 },
  // a more failed tries before the run ends, in every room left.
  tries: { max: 3, whole: true },
  // The time each room left allows × (1 + a).
  timeLimit: { max: 1 },
  // The clear's purse (materials and coins) × (1 + a).
  purse: { max: 1 },
  // The chance the boss leaves its own item × (1 + a).
  bossItem: { max: 1 },
  // a more rolls at the boss's own item when the first gives nothing.
  rewardRoll: { max: 2, whole: true },
  // The boss comes without an affix, whatever the tier's modifier says.
  noBossAffix: { max: 1, whole: true }
})

/** The tier modifiers' types: what makes a room harder at a tier. */
export const MODIFIER_TYPES = Object.freeze({
  // The monsters of the rooms listed carry this affix (instead of their own).
  affix: { keys: ['affix', 'rooms'] },
  // The campfire gives no stamina back after a kill in the run.
  noCampfire: { keys: [] },
  // A rest takes (1 + amount) of its time.
  restLonger: { keys: ['amount'], max: 3 },
  // The trap's or puzzle's check is (1 + amount) times as hard.
  checkHarder: { keys: ['amount'], max: 1 },
  // The hall holds `amount` fights instead of three.
  hallFights: { keys: ['amount'], min: 4, max: 6 }
})

/** The rooms whose monsters an affix modifier may name. */
const AFFIX_ROOMS = ['entrance', 'hall', 'elite', 'boss']
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const TEXT_LIMIT = 40
/** Two boons are offered in each vault: the pool must give a choice. */
export const BOONS_OFFERED = 2
const MIN_BOONS = 4

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isShortText = (value) => typeof value === 'string' && value.trim() !== '' && value.length <= TEXT_LIMIT

/** Problems of an id and a name, shared by boons and modifiers. */
function checkNamed(name, entry, seenIds, keys) {
  const problems = Object.keys(entry).filter((key) => !keys.includes(key)).map((key) => `${name}: "${key}" is not a known key`)
  if (typeof entry.id !== 'string' || !KEBAB_CASE.test(entry.id)) problems.push(`${name}: "id" must be in kebab-case`)
  else if (seenIds.has(entry.id)) problems.push(`${name}: another one has the same id`)
  seenIds.add(entry.id)
  if (!isShortText(entry.name)) problems.push(`${name}: "name" must be text of at most ${TEXT_LIMIT} characters`)
  return problems
}

function checkBoon(entry, index, seenIds) {
  if (!isObject(entry)) return [`boons[${index}] must be an object`]
  const name = `boon "${entry.id ?? index}"`
  const problems = checkNamed(name, entry, seenIds, ['id', 'name', 'effect'])
  const effect = entry.effect
  const type = BOON_TYPES[effect?.effect]
  if (!isObject(effect) || !Object.hasOwn(BOON_TYPES, effect.effect ?? '')) {
    return [...problems, `${name}: "effect.effect" must be one of: ${Object.keys(BOON_TYPES).join(', ')}`]
  }
  const extra = Object.keys(effect).filter((key) => key !== 'effect' && key !== 'amount')
  for (const key of extra) problems.push(`${name}: "effect.${key}" is not a key of a boon's effect`)
  const amount = effect.amount
  const isAmount = typeof amount === 'number' && amount > 0 && amount <= type.max && (!type.whole || Number.isInteger(amount))
  if (!isAmount) problems.push(`${name}: "effect.amount" must be above 0 and at most ${type.max}${type.whole ? ', whole' : ''}`)
  return problems
}

function checkModifierEffect(name, effect) {
  const type = MODIFIER_TYPES[effect?.effect]
  if (!isObject(effect) || !Object.hasOwn(MODIFIER_TYPES, effect.effect ?? '')) {
    return [`${name}: "effect.effect" must be one of: ${Object.keys(MODIFIER_TYPES).join(', ')}`]
  }
  const problems = Object.keys(effect).filter((key) => key !== 'effect' && !type.keys.includes(key))
    .map((key) => `${name}: "effect.${key}" is not a key of ${effect.effect}`)
  if (effect.effect === 'affix') {
    if (!AFFIXES.includes(effect.affix)) problems.push(`${name}: "effect.affix" must be one of: ${AFFIXES.join(', ')}`)
    const rooms = effect.rooms
    if (!Array.isArray(rooms) || rooms.length === 0 || new Set(rooms).size !== rooms.length || !rooms.every((room) => AFFIX_ROOMS.includes(room))) {
      problems.push(`${name}: "effect.rooms" must list distinct rooms with a fight`)
    }
  }
  if (type.keys.includes('amount')) {
    const amount = effect.amount
    const isCount = type.min !== undefined
    const isAmount = typeof amount === 'number' && (isCount ? Number.isInteger(amount) && amount >= type.min : amount > 0) &&
      amount <= type.max
    if (!isAmount) problems.push(`${name}: "effect.amount" must be ${isCount ? `a whole number from ${type.min} to` : 'above 0 and at most'} ${type.max}`)
  }
  return problems
}

function checkModifier(entry, index, seenIds) {
  if (!isObject(entry)) return [`modifiers[${index}] must be an object`]
  const name = `modifier "${entry.id ?? index}"`
  return [...checkNamed(name, entry, seenIds, ['id', 'name', 'effect']), ...checkModifierEffect(name, entry.effect)]
}

/** Each instance's rotation of modifiers, and its relic: an instance relic that names it back. */
function checkInstanceLinks(data, modifierIds, legendary) {
  const problems = []
  const relics = new Map((legendary?.legendary ?? []).map((entry) => [entry.id, entry]))
  for (const entry of data.instances.filter(isObject)) {
    const name = `instance "${entry.id}"`
    const rotation = entry.modifiers
    if (!Array.isArray(rotation) || rotation.length === 0 || new Set(rotation).size !== rotation.length ||
      !rotation.every((id) => modifierIds.has(id))) {
      problems.push(`${name}: "modifiers" must list modifiers of the file, each once`)
    }
    const relic = relics.get(entry.relic)
    if (legendary && (relic?.kind !== 'instance-relic' || relic.instance !== entry.id)) {
      problems.push(`${name}: "relic" must be an instance relic of game/legendary.json that names this instance`)
    }
  }
  return problems
}

/**
 * Everything wrong with the boons, the tier modifiers and the links to them of a parsed
 * game/instances.json whose instances are already valid. Empty when they are valid.
 *
 * @param {object} data
 * @param {{ legendary?: { legendary: object[] } }} [others] the legendary loot the relics are in
 * @returns {string[]}
 */
export function validateRunContent(data, { legendary } = {}) {
  const problems = []
  if (!Array.isArray(data?.boons) || data.boons.length < MIN_BOONS) problems.push(`"boons" must list at least ${MIN_BOONS} boons`)
  if (!Array.isArray(data?.modifiers) || data.modifiers.length === 0) problems.push('"modifiers" must list tier modifiers')
  if (problems.length) return problems
  const seenBoons = new Set()
  data.boons.forEach((entry, index) => problems.push(...checkBoon(entry, index, seenBoons)))
  const seenModifiers = new Set()
  data.modifiers.forEach((entry, index) => problems.push(...checkModifier(entry, index, seenModifiers)))
  return [...problems, ...checkInstanceLinks(data, seenModifiers, legendary)]
}

/**
 * The modifier of an instance at a tier: none at tier 1, then its rotation in turn, round and round.
 *
 * @param {object} instance the content entry
 * @param {number} tier from 1
 * @param {import('./instance-content.mjs').InstanceIndex} index
 * @returns {object | null} the modifier's content entry
 */
export function modifierAt(instance, tier, index) {
  if (tier < 2 || !instance.modifiers?.length) return null
  return index.modifierById.get(instance.modifiers[(tier - 2) % instance.modifiers.length]) ?? null
}

/**
 * @typedef {{ bossDamage: number, bossAttack: number, staminaNow: number, restFactor: number,
 *   tries: number, timeFactor: number, purse: number, bossItem: number, rewardRolls: number,
 *   noBossAffix: boolean, affixes: Record<string, string>, noCampfire: boolean, checkFactor: number,
 *   hallFights: number | null }} RunBonuses
 */

/**
 * What the chosen boon and the tier's modifier do to a run, as numbers its rooms use. A boon not
 * chosen yet does nothing.
 *
 * @param {object | null} boon the boon's content entry
 * @param {object | null} modifier the modifier's content entry
 * @returns {RunBonuses}
 */
export function runBonuses(boon, modifier) {
  const boonAmount = (type) => (boon?.effect.effect === type ? boon.effect.amount : 0)
  const change = modifier?.effect ?? {}
  const affixes = change.effect === 'affix' ? Object.fromEntries(change.rooms.map((room) => [room, change.affix])) : {}
  return {
    bossDamage: boonAmount('bossDamage'),
    bossAttack: boonAmount('bossAttack'),
    staminaNow: boonAmount('staminaNow'),
    restFactor: (1 - boonAmount('restShort')) * (change.effect === 'restLonger' ? 1 + change.amount : 1),
    tries: boonAmount('tries'),
    timeFactor: 1 + boonAmount('timeLimit'),
    purse: boonAmount('purse'),
    bossItem: boonAmount('bossItem'),
    rewardRolls: boonAmount('rewardRoll'),
    noBossAffix: boonAmount('noBossAffix') > 0,
    affixes,
    noCampfire: change.effect === 'noCampfire',
    checkFactor: change.effect === 'checkHarder' ? 1 + change.amount : 1,
    hallFights: change.effect === 'hallFights' ? change.amount : null
  }
}

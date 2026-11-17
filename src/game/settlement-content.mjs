// Checks game/settlement.json (already parsed) and indexes it for the engine: the world's buildings,
// each one of the group upgrades with its tiers and art, and the settlement's stages, reached by the
// total of all building levels, each with its art and a small bonus for the whole world. A bonus is
// an effect of the closed set legendary loot uses (legendary-content.mjs), with the scope `world`.
// Pure: problems come back as text, nothing is thrown.
import { LEGENDARY_EFFECT_CAPS } from './constants.mjs'
import { effectProblems } from './legendary-content.mjs'

const TOP_KEYS = ['buildings', 'stages', 'coinsFromTier', 'renovation']
const BUILDING_KEYS = ['id', 'name', 'upgrade', 'opensAt', 'tiers']
const TIER_KEYS = ['name', 'from', 'art']
const STAGE_KEYS = ['id', 'name', 'from', 'art', 'alt', 'bonus']
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/
/** Art is served with the UI, so the panel, the tab and the external view all reach it. */
const ART_PATH = /^ui\/settlement\/[a-z0-9]+(-[a-z0-9]+)*\.png$/
/** A name sits on a card in a 380 px sidebar. */
const NAME_LIMIT = 40
const ALT_LIMIT = 200
/** A building has at least one tier and at most this many sprites. */
const MAX_TIERS = 5

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isText = (value, limit) => typeof value === 'string' && value.trim() !== '' && value.length <= limit
const isWhole = (value, min) => Number.isInteger(value) && value >= min
const isArtPath = (value) => typeof value === 'string' && ART_PATH.test(value)
const unknownKeys = (object, known, label) =>
  Object.keys(object).filter((key) => !known.includes(key)).map((key) => `${label}: "${key}" is not a known key`)

/** Problems of a list whose entries each start where the one before ends: `from` rising from `first`. */
function risingFrom(label, list, first) {
  const problems = []
  list.forEach((entry, at) => {
    if (!isObject(entry)) return
    if (at === 0 && entry.from !== first) problems.push(`${label}: the first must start "from" ${first}`)
    if (!isWhole(entry.from, first)) problems.push(`${label}[${at}]: "from" must be a whole number from ${first}`)
    else if (at > 0 && !(entry.from > list[at - 1]?.from)) {
      problems.push(`${label}[${at}]: "from" must be above the one before`)
    }
  })
  return problems
}

function checkTier(label, tier) {
  if (!isObject(tier)) return [`${label} must be an object`]
  const problems = unknownKeys(tier, TIER_KEYS, label)
  if (!isText(tier.name, NAME_LIMIT)) problems.push(`${label}: "name" must be text of at most ${NAME_LIMIT} characters`)
  if (!isArtPath(tier.art)) problems.push(`${label}: "art" must be a PNG under ui/settlement/`)
  return problems
}

function checkBuilding(entry, index, { seen, upgradeIds, stageIds }) {
  if (!isObject(entry)) return [`building[${index}] must be an object`]
  const label = `building "${entry.id ?? index}"`
  const problems = unknownKeys(entry, BUILDING_KEYS, label)
  if (typeof entry.id !== 'string' || !KEBAB_CASE.test(entry.id)) problems.push(`${label}: "id" must be in kebab-case`)
  else if (seen.ids.has(entry.id)) problems.push(`${label}: another building has the same id`)
  seen.ids.add(entry.id)
  if (!isText(entry.name, NAME_LIMIT)) problems.push(`${label}: "name" must be text of at most ${NAME_LIMIT} characters`)
  if (!upgradeIds.includes(entry.upgrade)) problems.push(`${label}: "upgrade" must be one of: ${upgradeIds.join(', ')}`)
  else if (seen.upgrades.has(entry.upgrade)) problems.push(`${label}: another building is the same upgrade`)
  seen.upgrades.add(entry.upgrade)
  if (!stageIds.includes(entry.opensAt)) problems.push(`${label}: "opensAt" must name a stage`)
  if (!Array.isArray(entry.tiers) || entry.tiers.length < 1 || entry.tiers.length > MAX_TIERS) {
    return [...problems, `${label}: "tiers" must list 1 to ${MAX_TIERS} tiers`]
  }
  entry.tiers.forEach((tier, at) => problems.push(...checkTier(`${label} tier[${at}]`, tier)))
  return [...problems, ...risingFrom(`${label} tiers`, entry.tiers, 1)]
}

function checkStage(entry, index, seenIds) {
  if (!isObject(entry)) return [`stage[${index}] must be an object`]
  const label = `stage "${entry.id ?? index}"`
  const problems = unknownKeys(entry, STAGE_KEYS, label)
  if (typeof entry.id !== 'string' || !KEBAB_CASE.test(entry.id)) problems.push(`${label}: "id" must be in kebab-case`)
  else if (seenIds.has(entry.id)) problems.push(`${label}: another stage has the same id`)
  seenIds.add(entry.id)
  if (!isText(entry.name, NAME_LIMIT)) problems.push(`${label}: "name" must be text of at most ${NAME_LIMIT} characters`)
  if (!isArtPath(entry.art)) problems.push(`${label}: "art" must be a PNG under ui/settlement/`)
  if (!isText(entry.alt, ALT_LIMIT)) {
    problems.push(`${label}: "alt" must describe the art in at most ${ALT_LIMIT} characters`)
  }
  if (!Array.isArray(entry.bonus)) return [...problems, `${label}: "bonus" must be a list of effects`]
  entry.bonus.forEach((effect, at) => problems.push(...effectProblems(`${label} bonus[${at}]`, effect, 'world')))
  return problems
}

/** Every stage's bonus counts once the settlement passes it: their sum must fit under each cap. */
function bonusTotalProblems(stages) {
  const totals = {}
  for (const effect of stages.flatMap((stage) => (isObject(stage) && Array.isArray(stage.bonus) ? stage.bonus : []))) {
    if (isObject(effect) && typeof effect.amount === 'number') totals[effect.effect] = (totals[effect.effect] ?? 0) + effect.amount
  }
  return Object.entries(totals)
    .filter(([type, total]) => Object.hasOwn(LEGENDARY_EFFECT_CAPS, type) && total > LEGENDARY_EFFECT_CAPS[type] + 1e-9)
    .map(([type, total]) => `the stages' ${type} bonuses add up to ${total}, more than the cap ${LEGENDARY_EFFECT_CAPS[type]}`)
}

function checkStages(stages) {
  if (!Array.isArray(stages) || stages.length < 2) return ['"stages" must list at least two stages']
  const seenIds = new Set()
  const problems = []
  stages.forEach((entry, index) => problems.push(...checkStage(entry, index, seenIds)))
  return [...problems, ...risingFrom('stages', stages, 0), ...bonusTotalProblems(stages)]
}

/**
 * Everything wrong with a parsed game/settlement.json. Empty when it is valid.
 *
 * @param {unknown} data
 * @param {{ upgradeIds: readonly string[] }} known the group upgrades: each is exactly one building
 * @returns {string[]}
 */
export function validateSettlement(data, { upgradeIds }) {
  if (!isObject(data)) return ['must be an object with "buildings" and "stages"']
  const problems = unknownKeys(data, TOP_KEYS, 'settlement')
  problems.push(...checkStages(data.stages))
  const stageIds = Array.isArray(data.stages) ? data.stages.filter(isObject).map((stage) => stage.id) : []
  if (!Array.isArray(data.buildings) || data.buildings.length === 0) return [...problems, '"buildings" must list the buildings']
  const seen = { ids: new Set(), upgrades: new Set() }
  data.buildings.forEach((entry, index) => problems.push(...checkBuilding(entry, index, { seen, upgradeIds, stageIds })))
  for (const upgradeId of upgradeIds.filter((id) => !seen.upgrades.has(id))) {
    problems.push(`the group upgrade "${upgradeId}" has no building`)
  }
  const tierCounts = data.buildings.filter(isObject).map((entry) => (Array.isArray(entry.tiers) ? entry.tiers.length : 1))
  const tierCount = Math.min(...tierCounts)
  if (!isWhole(data.coinsFromTier, 2) || data.coinsFromTier > tierCount) {
    problems.push(`"coinsFromTier" must be a tier every building has, from 2 to ${tierCount}`)
  }
  if (!isObject(data.renovation) || !isWhole(data.renovation.every, 1) || Object.keys(data.renovation).length !== 1) {
    problems.push('"renovation" must say after how many levels past the last stage a star is earned: { "every": n }')
  }
  return problems
}

/**
 * @typedef {{ id: string, name: string, upgradeId: string, opensAt: number,
 *   tiers: { name: string, from: number, art: string }[] }} Building `opensAt` the stage's index
 * @typedef {{ id: string, name: string, from: number, art: string, alt: string, bonus: object[] }} Stage
 * @typedef {{ buildings: Building[], byUpgrade: Map<string, Building>, stages: Stage[],
 *   coinsFromTier: number, renovationEvery: number }} SettlementIndex
 */

/**
 * The settlement indexed for the engine.
 *
 * @param {object | null | undefined} data a valid settlement file, or none
 * @returns {SettlementIndex | null} null without one: no stages, and only the buildings every world
 *   always had
 */
export function indexSettlement(data) {
  if (!data) return null
  const stageIndex = new Map(data.stages.map((stage, at) => [stage.id, at]))
  const buildings = data.buildings.map((entry) => ({
    id: entry.id,
    name: entry.name,
    upgradeId: entry.upgrade,
    opensAt: stageIndex.get(entry.opensAt),
    tiers: entry.tiers.map((tier) => ({ ...tier }))
  }))
  return {
    buildings,
    byUpgrade: new Map(buildings.map((building) => [building.upgradeId, building])),
    stages: data.stages.map((stage) => ({ ...stage, bonus: stage.bonus.map((effect) => ({ ...effect })) })),
    coinsFromTier: data.coinsFromTier,
    renovationEvery: data.renovation.every
  }
}

const indexes = new WeakMap()

/**
 * The settlement index of a set of content, built once per settlement file.
 *
 * @param {{ settlement?: object } | null | undefined} content
 * @returns {SettlementIndex | null}
 */
export function settlementIndexOf(content) {
  const data = content?.settlement
  if (!data) return null
  if (!indexes.has(data)) indexes.set(data, indexSettlement(data))
  return indexes.get(data)
}

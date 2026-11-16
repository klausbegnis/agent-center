// Checks game/races.json and game/bosses.json, already parsed. Pure: problems come back as text.
// Which part ids exist is the UI's to know; a test checks every id named here against it.
import { HUMANOID_BUILDS, NO_PART, PALETTE_ROLES, RIG_SLOTS } from './races.mjs'

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const HEX_COLOUR = /^#[0-9A-Fa-f]{6}$/
const RACE_KEYS = [
  'id', 'noun', 'rig', 'build', 'descriptor', 'themes', 'palettes', 'parts', 'always', 'roles', 'marks'
]
const ROLE_KEYS = ['id', 'word', 'noun', 'descriptor', 'palettes']
const BOSS_KEYS = ['id', 'name', 'epithet', 'race', 'parts', 'colours']

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isFilledString = (value) => typeof value === 'string' && value.trim() !== ''
const isPartId = (value) => typeof value === 'string' && KEBAB_CASE.test(value)
const isIdList = (value) => Array.isArray(value) && value.length > 0 && value.every(isPartId)
const unknownKeys = (object, known) => Object.keys(object).filter((key) => !known.includes(key))

/** Problems of one palette: a list of `{ id, word?, colour }`, with words when `needsWords`. */
function checkPalette(label, entries, needsWords) {
  if (!Array.isArray(entries) || entries.length === 0) return [`${label} must be a non-empty list`]
  const problems = []
  const ids = new Set()
  for (const entry of entries) {
    if (!isObject(entry) || !isPartId(entry.id)) {
      problems.push(`${label}: every colour needs a kebab-case "id"`)
      continue
    }
    if (ids.has(entry.id)) problems.push(`${label}: "${entry.id}" is listed twice`)
    ids.add(entry.id)
    const named = `${label}: "${entry.id}"`
    if (!HEX_COLOUR.test(entry.colour ?? '')) problems.push(`${named} needs a colour like #A0522D`)
    if (entry.word !== undefined && !isFilledString(entry.word)) problems.push(`${named} has an empty word`)
    if (needsWords && !isFilledString(entry.word)) problems.push(`${named} needs a word for names`)
  }
  return problems
}

function checkSharedPalettes(palettes) {
  if (!isObject(palettes)) return ['"palettes" must map colour roles to lists']
  return PALETTE_ROLES.filter((role) => role !== 'skin')
    .flatMap((role) => checkPalette(`palettes.${role}`, palettes[role], false))
}

/** The palette a race picks a role's colour from: its own, or the shared one. */
const paletteOf = (data, race, role) => race.palettes?.[role] ?? data.palettes?.[role] ?? []

function checkRaceShape(race, name) {
  const problems = unknownKeys(race, RACE_KEYS).map((key) => `${name}: "${key}" is not a known key`)
  if (typeof race.noun !== 'string') problems.push(`${name}: "noun" must be a string (empty for none)`)
  if (!Object.hasOwn(RIG_SLOTS, race.rig)) {
    problems.push(`${name}: "rig" must be one of: ${Object.keys(RIG_SLOTS).join(', ')}`)
  }
  if (!HUMANOID_BUILDS.includes(race.build)) {
    problems.push(`${name}: "build" must be one of: ${HUMANOID_BUILDS.join(', ')}`)
  }
  if (race.themes !== undefined && !(Array.isArray(race.themes) && race.themes.every(isFilledString))) {
    problems.push(`${name}: "themes" must be a list of theme ids`)
  }
  if (!Array.isArray(race.marks) || race.marks.length === 0 || !race.marks.every(isFilledString)) {
    problems.push(`${name}: "marks" must be a non-empty list of words`)
  }
  if (race.descriptor !== undefined && !PALETTE_ROLES.includes(race.descriptor)) {
    problems.push(`${name}: "descriptor" must be a colour role`)
  }
  return problems
}

function checkRacePalettes(data, race, name) {
  if (!isObject(race.palettes) || !race.palettes.skin) return [`${name}: "palettes" must have a "skin" list`]
  const problems = []
  for (const [role, entries] of Object.entries(race.palettes)) {
    if (!PALETTE_ROLES.includes(role)) problems.push(`${name}: "palettes.${role}" is not a colour role`)
    else problems.push(...checkPalette(`${name}: palettes.${role}`, entries, false))
  }
  return problems
}

function checkRaceParts(race, name) {
  if (!isObject(race.parts)) return [`${name}: "parts" must map slots to part ids`]
  const slots = RIG_SLOTS[race.rig] ?? []
  const problems = unknownKeys(race.parts, [...slots, 'extras'])
    .map((slot) => `${name}: "parts.${slot}" is not a slot of its rig`)
  for (const slot of slots) {
    if (!isIdList(race.parts[slot])) {
      problems.push(`${name}: "parts.${slot}" must be a non-empty list of part ids`)
    }
  }
  for (const list of ['extras', 'always']) {
    const value = list === 'always' ? race.always : race.parts.extras
    if (value !== undefined && !(Array.isArray(value) && value.every(isPartId))) {
      problems.push(`${name}: "${list}" must be a list of part ids`)
    }
  }
  return problems
}

/** A role's lists must stay inside the race's, its colours inside the race's palettes. */
function checkRole(data, race, role, name, seenIds) {
  if (!isObject(role) || !isPartId(role.id)) return [`${name}: every role needs a kebab-case "id"`]
  const label = `${name} role "${role.id}"`
  const slots = [...(RIG_SLOTS[race.rig] ?? []), 'extras']
  const problems = unknownKeys(role, [...ROLE_KEYS, ...slots])
    .map((key) => `${label}: "${key}" is not a known key`)
  if (seenIds.has(role.id)) problems.push(`${label}: another role has the same id`)
  seenIds.add(role.id)
  if (typeof role.word !== 'string') problems.push(`${label}: "word" must be a string (empty for none)`)
  for (const slot of slots) {
    if (role[slot] === undefined) continue
    const allowed = race.parts?.[slot] ?? []
    const outside = Array.isArray(role[slot])
      ? role[slot].filter((id) => !allowed.includes(id))
      : ['(not a list)']
    if (outside.length) {
      problems.push(`${label}: "${slot}" names parts the race does not have: ${outside.join(', ')}`)
    }
  }
  for (const [paletteRole, ids] of Object.entries(role.palettes ?? {})) {
    const known = paletteOf(data, race, paletteRole).map((entry) => entry.id)
    if (!Array.isArray(ids) || ids.some((id) => !known.includes(id))) {
      problems.push(`${label}: "palettes.${paletteRole}" names colours the race does not have`)
    }
  }
  const descriptor = role.descriptor ?? race.descriptor ?? 'skin'
  const named = isFilledString(role.word) || isFilledString(role.noun ?? race.noun)
  const words = paletteOf(data, race, descriptor).every((entry) => isFilledString(entry.word))
  if (!words && !named) problems.push(`${label}: its name would be empty`)
  return problems
}

function checkRace(data, race, index, seenIds) {
  if (!isObject(race) || !isPartId(race.id)) return [`race ${index} needs a kebab-case "id"`]
  const name = `race "${race.id}"`
  const problems = seenIds.has(race.id) ? [`${name}: another race has the same id`] : []
  seenIds.add(race.id)
  problems.push(...checkRaceShape(race, name), ...checkRacePalettes(data, race, name))
  problems.push(...checkRaceParts(race, name))
  if (!Array.isArray(race.roles) || race.roles.length === 0) {
    return [...problems, `${name}: "roles" must be a non-empty list`]
  }
  const roleIds = new Set()
  for (const role of race.roles) problems.push(...checkRole(data, race, role, name, roleIds))
  return problems
}

/**
 * Everything wrong with a parsed game/races.json. Empty when it is valid.
 *
 * @param {unknown} data
 * @returns {string[]}
 */
export function validateRaces(data) {
  if (!isObject(data) || !Array.isArray(data.races) || data.races.length === 0) {
    return ['must be an object with "palettes" and a non-empty "races" list']
  }
  const problems = unknownKeys(data, ['palettes', 'races']).map((key) => `"${key}" is not a known key`)
  problems.push(...checkSharedPalettes(data.palettes))
  const seenIds = new Set()
  data.races.forEach((race, index) => problems.push(...checkRace(data, race, index, seenIds)))
  return problems
}

function checkBoss(boss, index, races, seen) {
  if (!isObject(boss) || !isPartId(boss.id)) return [`boss ${index} needs a kebab-case "id"`]
  const name = `boss "${boss.id}"`
  const problems = unknownKeys(boss, BOSS_KEYS).map((key) => `${name}: "${key}" is not a known key`)
  for (const [key, label] of [['id', 'id'], ['name', 'name']]) {
    if (seen[key].has(boss[key])) problems.push(`${name}: another boss has the same ${label}`)
    seen[key].add(boss[key])
  }
  if (!isFilledString(boss.name) || !isFilledString(boss.epithet)) {
    problems.push(`${name}: needs a "name" and an "epithet"`)
  }
  const race = races.find((each) => each.id === boss.race)
  if (!race) return [...problems, `${name}: "race" must be a race of game/races.json`]
  const slots = RIG_SLOTS[race.rig] ?? []
  if (!isObject(boss.parts)) return [...problems, `${name}: "parts" must name a part for every slot`]
  for (const slot of slots) {
    if (!isPartId(boss.parts[slot])) {
      problems.push(`${name}: "parts.${slot}" must name a part (or "${NO_PART}")`)
    }
  }
  const extra = unknownKeys(boss.parts, [...slots, 'extras'])
  if (extra.length) problems.push(`${name}: "parts" has slots its rig does not: ${extra.join(', ')}`)
  const { extras } = boss.parts
  if (extras !== undefined && !(Array.isArray(extras) && extras.every(isPartId))) {
    problems.push(`${name}: "parts.extras" must be a list of part ids`)
  }
  for (const role of PALETTE_ROLES) {
    if (!HEX_COLOUR.test(boss.colours?.[role] ?? '')) {
      problems.push(`${name}: "colours.${role}" must be a colour like #A0522D`)
    }
  }
  return problems
}

/**
 * Everything wrong with a parsed game/bosses.json, given the races it draws on. Empty when valid.
 *
 * @param {unknown} data
 * @param {{ races: object[] }} races a valid races file
 * @returns {string[]}
 */
export function validateBosses(data, races) {
  if (!isObject(data) || !Array.isArray(data.bosses) || data.bosses.length === 0) {
    return ['must be an object with a non-empty "bosses" list']
  }
  const problems = unknownKeys(data, ['bosses']).map((key) => `"${key}" is not a known key`)
  const seen = { id: new Set(), name: new Set() }
  data.bosses.forEach((boss, index) => problems.push(...checkBoss(boss, index, races?.races ?? [], seen)))
  return problems
}

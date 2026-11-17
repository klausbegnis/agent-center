// The save file: worlds, the projects in them and which world each project belongs to. Every
// function returns a new save; `migrate` turns whatever was read from disk into a valid one.
import { GATHERING_SKILLS } from './skills.mjs'

export const SAVE_VERSION = 1
/** The world a project plays in until it is assigned another one. */
export const DEFAULT_WORLD = 'main'
/** The wave a project starts at when the caller does not say (a world at level 1). */
const FIRST_WAVE = 1

/**
 * Steps from each older save version to the next one. Empty while only version 1 exists; a
 * version with no step here cannot be read and becomes an empty save.
 *
 * @type {Record<number, (save: object) => object>}
 */
const MIGRATIONS = {}

/** @returns {{ version: number, worlds: object, projectWorld: object, settings: { keepTitles: boolean } }} */
export function emptySave() {
  return { version: SAVE_VERSION, worlds: {}, projectWorld: {}, settings: { keepTitles: false } }
}

export function emptyWorld() {
  return { skills: {}, materials: {}, upgrades: {}, projects: {}, lastTokenAt: null }
}

/**
 * A project before its first fight. `kills` counts every monster it ever killed (only a world
 * reset starts it over), `stamina` is a share of the party's pool, `restTicks` the
 * fight ticks of rest left, `fightMs` fight time not yet worth a whole tick, and `fightTicks` and
 * `fightRested` describe the fight under way. `tradeChoice` is the trade chosen for the room's
 * idle characters, null for Auto (see trades.mjs).
 *
 * @param {{ wave?: number }} [start] the wave is the world level when the project first joins
 */
export function emptyProject({ wave = FIRST_WAVE } = {}) {
  return {
    wave,
    waveKills: 0,
    kills: 0,
    monster: null,
    stamina: 1,
    restTicks: 0,
    fightMs: 0,
    fightTicks: 0,
    fightRested: false,
    themeId: null,
    tradeChoice: null,
    chest: [],
    characters: {},
    retirees: [],
    retiredCount: 0
  }
}

/**
 * @param {object} save
 * @param {string} projectId
 * @returns {string | null} the project's world, or null when it was put out of the game
 */
export function worldIdOf(save, projectId) {
  if (!Object.hasOwn(save.projectWorld, projectId)) return DEFAULT_WORLD
  return save.projectWorld[projectId]
}

/** The world that holds the project's data: its own world first, then any other. */
function worldHoldingProject(save, projectId) {
  const ownWorldId = worldIdOf(save, projectId)
  if (ownWorldId !== null && save.worlds[ownWorldId]?.projects[projectId]) return ownWorldId
  return Object.keys(save.worlds).sort().find((worldId) => save.worlds[worldId].projects[projectId]) ?? null
}

/**
 * Puts a project in a world. Data it already has (wave, chest, characters, retirees) moves with
 * it. Skills and materials belong to the worlds and stay where they are.
 *
 * @param {object} save
 * @param {string} projectId
 * @param {string | null} worldId null puts the project out of the game
 * @returns {object}
 */
export function assignProject(save, projectId, worldId) {
  if (worldId === null) return excludeProject(save, projectId)
  const assigned = { ...save, projectWorld: { ...save.projectWorld, [projectId]: worldId } }
  const sourceId = worldHoldingProject(save, projectId)
  if (sourceId === null || sourceId === worldId) return assigned
  const data = save.worlds[sourceId].projects[projectId]
  const withoutProject = withWorld(assigned, sourceId, (world) => {
    const projects = { ...world.projects }
    delete projects[projectId]
    return { ...world, projects }
  })
  return withWorld(withoutProject, worldId, (world) => ({
    ...world,
    projects: { ...world.projects, [projectId]: data }
  }))
}

/**
 * Puts a project out of the game. Its data stays in its world in case it is assigned again.
 *
 * @param {object} save
 * @param {string} projectId
 * @returns {object}
 */
export function excludeProject(save, projectId) {
  return { ...save, projectWorld: { ...save.projectWorld, [projectId]: null } }
}

/**
 * @param {object} save
 * @param {string} worldId
 * @param {(world: object) => object} change returns the new world
 * @returns {object} a new save; the world is created empty first when missing
 */
export function withWorld(save, worldId, change) {
  const world = save.worlds[worldId] ?? emptyWorld()
  return { ...save, worlds: { ...save.worlds, [worldId]: change(world) } }
}

/**
 * Changes one project in the world it belongs to, creating the world and the project when
 * missing. A project out of the game is left alone and the same save is returned.
 *
 * @param {object} save
 * @param {string} projectId
 * @param {(project: object, world: object) => object} change returns the new project
 * @param {{ wave?: number }} [start] the wave of a project created here
 * @returns {object}
 */
export function withProject(save, projectId, change, { wave = FIRST_WAVE } = {}) {
  const worldId = worldIdOf(save, projectId)
  if (worldId === null) return save
  return withWorld(save, worldId, (world) => {
    const project = world.projects[projectId] ?? emptyProject({ wave })
    return { ...world, projects: { ...world.projects, [projectId]: change(project, world) } }
  })
}

/**
 * Starts a world over: its skills, materials, upgrades and projects are gone. Projects keep
 * their assignment and begin again from an empty project.
 *
 * @param {object} save
 * @param {string} worldId
 * @returns {object}
 */
export function resetWorld(save, worldId) {
  return { ...save, worlds: { ...save.worlds, [worldId]: emptyWorld() } }
}

/**
 * @param {object} world
 * @param {string} projectId
 * @param {object} project
 * @returns {object} the world with that project replaced
 */
export const withProjectIn = (world, projectId, project) => ({
  ...world,
  projects: { ...world.projects, [projectId]: project }
})

/**
 * @param {object} project
 * @param {object} character
 * @returns {object} the project with that character replaced
 */
export const withCharacter = (project, character) => ({
  ...project,
  characters: { ...project.characters, [character.sessionId]: character }
})

/**
 * @param {Record<string, number>} materials
 * @param {Record<string, number>} more
 * @returns {Record<string, number>} both added together
 */
export function addMaterials(materials, more) {
  const sum = { ...materials }
  for (const [materialId, amount] of Object.entries(more)) sum[materialId] = (sum[materialId] ?? 0) + amount
  return sum
}

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)
const isWorldIdOrNull = (value) => value === null || typeof value === 'string'
const objectOr = (value, fallback) => (isPlainObject(value) ? value : fallback)

/** Keeps the entries of an object whose value passes the test. */
function keepEntries(value, isValid) {
  return Object.fromEntries(Object.entries(objectOr(value, {})).filter(([, entry]) => isValid(entry)))
}

function normalizeProject(value) {
  const project = { ...emptyProject(), ...value }
  return {
    ...project,
    wave: isNumber(project.wave) ? project.wave : FIRST_WAVE,
    waveKills: isNumber(project.waveKills) ? project.waveKills : 0,
    // Saves from before the kill count start it at 0.
    kills: Number.isInteger(project.kills) && project.kills > 0 ? project.kills : 0,
    stamina: isNumber(project.stamina) ? Math.min(1, Math.max(0, project.stamina)) : 1,
    restTicks: isNumber(project.restTicks) ? project.restTicks : 0,
    fightMs: isNumber(project.fightMs) ? project.fightMs : 0,
    // Saves from before trades could be chosen, or with an unknown one, have Auto.
    tradeChoice: GATHERING_SKILLS.includes(project.tradeChoice) ? project.tradeChoice : null,
    chest: Array.isArray(project.chest) ? project.chest.filter(isPlainObject) : [],
    characters: keepEntries(project.characters, isPlainObject),
    retirees: Array.isArray(project.retirees) ? project.retirees.filter(isPlainObject) : [],
    retiredCount: isNumber(project.retiredCount) ? project.retiredCount : 0
  }
}

function normalizeWorld(value) {
  return {
    skills: keepEntries(value.skills, isPlainObject),
    materials: keepEntries(value.materials, isNumber),
    upgrades: keepEntries(value.upgrades, isNumber),
    projects: Object.fromEntries(Object.entries(keepEntries(value.projects, isPlainObject))
      .map(([projectId, project]) => [projectId, normalizeProject(project)])),
    lastTokenAt: isNumber(value.lastTokenAt) ? value.lastTokenAt : null
  }
}

/** Brings a save of an older version up to this one, or returns null when there is no way. */
function upgradeVersion(value) {
  let save = value
  while (save.version < SAVE_VERSION) {
    const step = MIGRATIONS[save.version]
    if (!step) return null
    save = step(save)
  }
  return save
}

/**
 * A valid save from whatever was read from disk. Missing or malformed parts are filled with
 * their empty form; anything that is not a save of a known version becomes an empty save.
 * Never throws.
 *
 * @param {unknown} value
 * @returns {object}
 */
export function migrate(value) {
  if (!isPlainObject(value) || !Number.isInteger(value.version)) return emptySave()
  if (value.version > SAVE_VERSION) return emptySave()
  const save = upgradeVersion(value)
  if (!save) return emptySave()
  return {
    version: SAVE_VERSION,
    worlds: Object.fromEntries(Object.entries(keepEntries(save.worlds, isPlainObject))
      .map(([worldId, world]) => [worldId, normalizeWorld(world)])),
    projectWorld: keepEntries(save.projectWorld, isWorldIdOrNull),
    settings: { keepTitles: objectOr(save.settings, {}).keepTitles === true }
  }
}

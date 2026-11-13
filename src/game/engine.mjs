// The game engine: one pure reducer over the save. Tokens become experience, time becomes fights
// and gathering, closed sessions retire, and materials buy upgrades. Never mutates, no I/O, no
// clock and no randomness: the same save and the same calls always give the same result.
import { advanceWithEvents } from './advance.mjs'
import { findItem } from './chest.mjs'
import { upgradeCost } from './items.mjs'
import { referencePartyHit as computeReferencePartyHit } from './power.mjs'
import { canPrestige, prestige as prestigeSkill } from './progression.mjs'
import { forgetTitles } from './retirement.mjs'
import { applyTokens, closeSession } from './sessions.mjs'
import { GROUP_UPGRADE_IDS, applyPurchase, groupLevel, groupUpgradeCost, spendWorld } from './spending.mjs'
import { viewOf } from './view.mjs'
import { withWorld, worldIdOf } from './worlds.mjs'

/**
 * @typedef {{ monsters: { monsters: object[] }, items: { items: object[] } }} Content the parsed
 *   game/monsters.json and game/items.json
 */

/**
 * Prestiges a skill of a world when it is at the cap. The only choice the game asks of a person.
 *
 * @param {object} save
 * @param {{ worldId: string, skillId: string }} which
 * @returns {object}
 */
function prestige(save, { worldId, skillId }) {
  const skill = save.worlds[worldId]?.skills[skillId]
  if (!skill || !canPrestige(skill)) return save
  const skills = { ...save.worlds[worldId].skills, [skillId]: prestigeSkill(skill) }
  return withWorld(save, worldId, (world) => ({ ...world, skills }))
}

/**
 * Upgrades an item of a project's chest with its world's materials. Unchanged when it cannot pay.
 *
 * @param {object} save
 * @param {{ projectId: string, itemId: string }} which
 * @returns {object}
 */
function upgradeItem(save, { projectId, itemId }) {
  const worldId = worldIdOf(save, projectId)
  const world = worldId === null ? null : save.worlds[worldId]
  const item = world?.projects[projectId] ? findItem(world.projects[projectId].chest, itemId) : null
  if (!item) return save
  const cost = upgradeCost(item, { workbenchLevel: groupLevel(world.upgrades, 'workbench') })
  const next = applyPurchase(world, { kind: item.slot, projectId, itemId, cost })
  return next === world ? save : { ...save, worlds: { ...save.worlds, [worldId]: next } }
}

/**
 * Buys the next level of a group upgrade for a world. Unchanged when it cannot pay.
 *
 * @param {object} save
 * @param {{ worldId: string, upgradeId: string }} which one of GROUP_UPGRADE_IDS
 * @returns {object}
 */
function buyGroupUpgrade(save, { worldId, upgradeId }) {
  const world = save.worlds[worldId]
  if (!world || !GROUP_UPGRADE_IDS.includes(upgradeId)) return save
  const cost = groupUpgradeCost(upgradeId, groupLevel(world.upgrades, upgradeId))
  const next = applyPurchase(world, { kind: 'group', upgradeId, cost })
  return next === world ? save : { ...save, worlds: { ...save.worlds, [worldId]: next } }
}

/**
 * Turns keeping session titles on or off. Turning it off forgets every title already kept.
 *
 * @param {object} save
 * @param {boolean} keepTitles
 * @returns {object}
 */
function setKeepTitles(save, keepTitles) {
  const settings = { ...save.settings, keepTitles: keepTitles === true }
  if (settings.keepTitles) return { ...save, settings }
  const forget = (project) => {
    const characters = Object.fromEntries(Object.entries(project.characters)
      .map(([sessionId, character]) => [sessionId, { ...character, title: null }]))
    return { ...forgetTitles(project), characters }
  }
  const worlds = Object.fromEntries(Object.entries(save.worlds).map(([worldId, world]) => [worldId, {
    ...world,
    projects: Object.fromEntries(Object.entries(world.projects).map(([id, project]) => [id, forget(project)]))
  }]))
  return { ...save, settings, worlds }
}

/**
 * Buys the best affordable upgrade again and again in every world (see spending.mjs).
 *
 * @param {object} save
 * @returns {{ save: object, purchases: object[] }}
 */
function autoSpendWithPurchases(save) {
  const purchases = []
  const worlds = {}
  for (const worldId of Object.keys(save.worlds).sort()) {
    const spent = spendWorld(save.worlds[worldId])
    worlds[worldId] = spent.world
    purchases.push(...spent.purchases.map((purchase) => ({ ...purchase, worldId })))
  }
  return purchases.length ? { save: { ...save, worlds }, purchases } : { save, purchases }
}

/**
 * Creates the engine for a set of content.
 *
 * @param {{ content: Content }} options
 */
export function createEngine({ content }) {
  const references = new Map()
  /** Pure, so its results can be kept: a fight asks for the same few levels over and over. */
  const referencePartyHit = (level) => {
    if (!references.has(level)) references.set(level, computeReferencePartyHit(level))
    return references.get(level)
  }
  const context = { content, referencePartyHit }
  return {
    applyTokens: (save, reading) => applyTokens(save, reading, content),
    advance: (save, interval) => advanceWithEvents(save, interval, context).save,
    advanceWithEvents: (save, interval) => advanceWithEvents(save, interval, context),
    closeSession,
    prestige,
    upgradeItem,
    buyGroupUpgrade,
    setKeepTitles,
    autoSpend: (save) => autoSpendWithPurchases(save).save,
    autoSpendWithPurchases,
    view: (save) => viewOf(save, content)
  }
}

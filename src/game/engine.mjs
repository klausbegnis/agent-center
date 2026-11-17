// The game engine: one pure reducer over the save. Tokens become experience, time becomes fights
// and gathering, closed sessions retire, and materials buy upgrades. Never mutates, no I/O, no
// clock and no randomness: the same save and the same calls always give the same result.
import { advanceWithEvents, prepareFights } from './advance.mjs'
import { findItem } from './chest.mjs'
import { upgradeCost } from './items.mjs'
import { legendaryIndexOf, upgradeDiscountOf } from './legendary-effects.mjs'
import { withActiveRelic } from './legendary.mjs'
import { buyMaterial, sellMaterial, tradeMaterial } from './market.mjs'
import { referencePartyHit as computeReferencePartyHit } from './power.mjs'
import { moveProjectItems } from './orphans.mjs'
import { canPrestige, prestige as prestigeSkill, worldLevel } from './progression.mjs'
import { forgetTitles } from './retirement.mjs'
import { cleanSave } from './save-check.mjs'
import { applyTokens, closeSession } from './sessions.mjs'
import { GROUP_UPGRADE_IDS, applyPurchase, groupLevel, groupUpgradeCost, spendWorld } from './spending.mjs'
import { buyStallOffer } from './stall.mjs'
import { RELIC_OFFER_INDEX, buyStallRelic } from './stall-relic.mjs'
import { setCharacterTrade, setRoomTrade } from './trades.mjs'
import { bestGearForRoom, equipItem, equipProblem } from './equip.mjs'
import { viewOf } from './view.mjs'
import { withWorld, worldIdOf } from './worlds.mjs'

/**
 * @typedef {{ monsters: { monsters: object[] }, items: { items: object[] },
 *   races?: { palettes: object, races: object[] }, bosses?: { bosses: object[] },
 *   cities?: { cities: object[] } }} Content the parsed game/monsters.json, game/items.json,
 *   game/races.json, game/bosses.json and game/cities.json; without races every monster is a
 *   hand-made entry, without cities the market has none
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
 * @param {object} [content] the game content, for a relic that makes upgrades cheaper
 * @returns {object}
 */
function upgradeItem(save, { projectId, itemId }, content) {
  const worldId = worldIdOf(save, projectId)
  const world = worldId === null ? null : save.worlds[worldId]
  const item = world?.projects[projectId] ? findItem(world.projects[projectId].chest, itemId) : null
  if (!item) return save
  const workbenchLevel = groupLevel(world.upgrades, 'workbench')
  const relicDiscount = upgradeDiscountOf(world.projects[projectId], legendaryIndexOf(content))
  const cost = upgradeCost(item, { workbenchLevel, worldLevel: worldLevel(world.skills), relicDiscount })
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
  const cost = groupUpgradeCost(upgradeId, groupLevel(world.upgrades, upgradeId), worldLevel(world.skills))
  const next = applyPurchase(world, { kind: 'group', upgradeId, cost })
  return next === world ? save : { ...save, worlds: { ...save.worlds, [worldId]: next } }
}

/**
 * Makes one of a room's relics the active one, or none with null. The only choice legendary loot
 * asks of a person; unchanged when the room does not own the relic or it is active already.
 *
 * @param {object} save
 * @param {{ projectId: string, relicId: string | null }} which
 * @returns {object}
 */
function setActiveRelic(save, { projectId, relicId }) {
  const worldId = worldIdOf(save, projectId)
  const project = worldId === null ? null : save.worlds[worldId]?.projects[projectId]
  if (!project) return save
  const next = withActiveRelic(project, relicId)
  return next === project ? save : withWorld(save, worldId, (world) => ({ ...world, projects: { ...world.projects, [projectId]: next } }))
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
 * @param {object} [content] the game content, for relics that make upgrades cheaper
 * @returns {{ save: object, purchases: object[] }}
 */
function autoSpendWithPurchases(save, content) {
  const purchases = []
  const worlds = {}
  for (const worldId of Object.keys(save.worlds).sort()) {
    const spent = spendWorld(save.worlds[worldId], legendaryIndexOf(content))
    worlds[worldId] = spent.world
    purchases.push(...spent.purchases.map((purchase) => ({ ...purchase, worldId })))
  }
  return purchases.length ? { save: { ...save, worlds }, purchases } : { save, purchases }
}

/**
 * Applies a change to one existing world: the same save when the world is missing or the change
 * gives back the same world.
 */
function inWorld(save, worldId, change) {
  const world = Object.hasOwn(save.worlds, worldId) ? save.worlds[worldId] : null
  if (!world) return save
  const next = change(world)
  return next === world ? save : { ...save, worlds: { ...save.worlds, [worldId]: next } }
}

/**
 * The market's actions over a save, each unchanged when it cannot be made (see market.mjs and
 * stall.mjs).
 *
 * @param {Content} content
 */
function marketActions(content) {
  const cities = content.cities?.cities ?? []
  return {
    sellMaterial: (save, { worldId, ...sale }) => inWorld(save, worldId, (world) => sellMaterial(world, cities, sale)),
    buyMaterial: (save, { worldId, ...purchase }) =>
      inWorld(save, worldId, (world) => buyMaterial(world, cities, purchase)),
    tradeMaterial: (save, { worldId, ...trade }) => inWorld(save, worldId, (world) => tradeMaterial(world, cities, trade)),
    // The relic's offer follows the gear's (stall-relic.mjs).
    buyStallOffer: (save, { worldId, ...purchase }) => inWorld(save, worldId, (world) =>
      (purchase.offerIndex === RELIC_OFFER_INDEX
        ? buyStallRelic(world, { worldId, cities, index: legendaryIndexOf(content) }, purchase)
        : buyStallOffer(world, { worldId, cities, items: content.items }, purchase)))
  }
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
    prepareFights: (save, readings) => prepareFights(save, readings, context),
    closeSession,
    prestige,
    upgradeItem: (save, which) => upgradeItem(save, which, content),
    buyGroupUpgrade,
    setActiveRelic,
    setKeepTitles,
    setCharacterTrade,
    setRoomTrade,
    // Who may hold a legendary item is the content's to say (legendary-equip.mjs).
    equipItem: (save, choice) => equipItem(save, choice, legendaryIndexOf(content)),
    bestGearForRoom: (save, where) => bestGearForRoom(save, where, legendaryIndexOf(content)),
    equipProblem: (project, choice) => equipProblem(project, choice, legendaryIndexOf(content)),
    autoSpend: (save) => autoSpendWithPurchases(save, content).save,
    autoSpendWithPurchases: (save) => autoSpendWithPurchases(save, content),
    view: (save) => viewOf(save, content),
    cleanSave: (save) => cleanSave(save, {
      cityIds: (content.cities?.cities ?? []).map((city) => city.id),
      legendary: content.legendary,
      bestiary: content.bestiary,
      bosses: content.bosses
    }),
    moveProjectItems,
    ...marketActions(content),
    /** The ids of the market's cities, for the bridge to check an action's city against. */
    cityIds: (content.cities?.cities ?? []).map((city) => city.id)
  }
}

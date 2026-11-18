// The game engine: one pure reducer over the save. Tokens become experience, time becomes fights
// and gathering, closed sessions retire, and materials buy upgrades. Never mutates, no I/O, no
// clock and no randomness: the same save and the same calls always give the same result.
import { advanceWithEvents, prepareFights } from './advance.mjs'
import { findItem } from './chest.mjs'
import { chronicleActions } from './chronicle.mjs'
import { citiesOfWeek } from './city-festival.mjs'
import { withCityRanks } from './city-rank-actions.mjs'
import { cityRankIndexOf } from './city-ranks-content.mjs'
import { upgradeCost } from './items.mjs'
import { legendaryIndexOf, upgradeDiscountOf } from './legendary-effects.mjs'
import { withActiveRelic } from './legendary.mjs'
import { buyMaterial, sellMaterial, tradeMaterial } from './market.mjs'
import { referencePartyHit as computeReferencePartyHit } from './power.mjs'
import { moveProjectItems } from './orphans.mjs'
import { canPrestige, prestige as prestigeSkill, worldLevel } from './progression.mjs'
import { forgetTitles } from './retirement.mjs'
import { instanceIndexOf } from './instance-content.mjs'
import { boonProblem, chooseBoon, enterInstance, enterProblem, recallParty } from './instance-run.mjs'
import { cleanSave } from './save-check.mjs'
import { applyTokens, closeSession } from './sessions.mjs'
import { buildingProblem, buyGroupUpgrade } from './buildings.mjs'
import { settlementIndexOf } from './settlement-content.mjs'
import { settlementNews } from './settlement.mjs'
import { applyPurchase, groupLevel, spendWorld } from './spending.mjs'
import { buyStallOffer } from './stall.mjs'
import { RELIC_OFFER_INDEX, buyStallRelic } from './stall-relic.mjs'
import { setCharacterTrade, setRoomTrade } from './trades.mjs'
import { traitIndexOf } from './trait-content.mjs'
import { closeSessionKeepingTraits, moveKeepingTraits, traitActions } from './trait-engine.mjs'
import { sendItem, sendItemProblem, sendRelic, sendRelicProblem } from './transfer.mjs'
import { bestGearForRoom, equipItem, equipProblem } from './equip.mjs'
import { viewOf } from './view.mjs'
import { advanceWeek } from './weekly.mjs'
import { worldEffectsOf } from './world-effects.mjs'
import { withWorld, worldIdOf } from './worlds.mjs'

/**
 * @typedef {{ monsters: { monsters: object[] }, items: { items: object[] },
 *   races?: { palettes: object, races: object[] }, bosses?: { bosses: object[] },
 *   cities?: { cities: object[] }, settlement?: object }} Content the parsed game/monsters.json,
 *   game/items.json, game/races.json, game/bosses.json, game/cities.json and game/settlement.json;
 *   without races every monster is a hand-made entry, without cities the market has none, without a
 *   settlement there are no stages and only the buildings every world always had
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
  const relicDiscount = upgradeDiscountOf(world.projects[projectId], legendaryIndexOf(content), worldEffectsOf(world, content))
  const cost = upgradeCost(item, { workbenchLevel, worldLevel: worldLevel(world.skills), relicDiscount })
  const next = applyPurchase(world, { kind: item.slot, projectId, itemId, cost })
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
    const world = save.worlds[worldId]
    const settlement = settlementIndexOf(content)
    const spent = spendWorld(world, legendaryIndexOf(content), worldEffectsOf(world, content), settlement)
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
  // A festival's city trades at its festival fee (city-festival.mjs).
  const ofWeek = (world) => citiesOfWeek(cities, world, content)
  return {
    sellMaterial: (save, { worldId, ...sale }) => inWorld(save, worldId, (world) => sellMaterial(world, ofWeek(world), sale)),
    buyMaterial: (save, { worldId, ...purchase }) =>
      inWorld(save, worldId, (world) => buyMaterial(world, ofWeek(world), purchase)),
    tradeMaterial: (save, { worldId, ...trade }) => inWorld(save, worldId, (world) => tradeMaterial(world, ofWeek(world), trade)),
    // The relic's offer follows the gear's (stall-relic.mjs).
    buyStallOffer: (save, { worldId, ...purchase }) => inWorld(save, worldId, (world) =>
      (purchase.offerIndex === RELIC_OFFER_INDEX
        ? buyStallRelic(world, { worldId, cities, index: legendaryIndexOf(content) }, purchase)
        : buyStallOffer(world, { worldId, cities, items: content.items }, purchase)))
  }
}

/** The name of an item's entry, plain or legendary. */
function itemNameOf(content, entryId) {
  const plain = content.items?.items?.find((entry) => entry.id === entryId)
  return plain?.name ?? legendaryIndexOf(content)?.byId.get(entryId)?.name ?? entryId
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
  // Traits (trait-engine.mjs): each advance brings the worlds' collections up to date.
  const traits = traitActions(content)
  const advanceNoting = (save, interval) => {
    const moved = advanceWithEvents(save, interval, context)
    return { ...moved, save: traits.noteKnownTraits(moved.save) }
  }
  return {
    applyTokens: (save, reading) => applyTokens(save, reading, content),
    // The weekly event is checked against the advance's end first and its goal counted after (weekly.mjs).
    advance: (save, interval) => advanceWeek(save, interval, content, (dated) => advanceNoting(dated, interval)).save,
    advanceWithEvents: (save, interval) => advanceWeek(save, interval, content, (dated) => advanceNoting(dated, interval)),
    prepareFights: (save, readings) => prepareFights(save, readings, context),
    closeSession: closeSessionKeepingTraits(closeSession, traitIndexOf(content)),
    prestige,
    upgradeItem: (save, which) => upgradeItem(save, which, content),
    buyGroupUpgrade: (save, which) => buyGroupUpgrade(save, which, settlementIndexOf(content)),
    /** Why a building's next level cannot be bought as asked now, or null (buildings.mjs). */
    buildingProblem: (save, which) => buildingProblem(save, which, settlementIndexOf(content)),
    /** The tiers and stages a change reached, for the bridge to celebrate (settlement.mjs). */
    settlementNews: (before, after) => settlementNews(before, after, settlementIndexOf(content)),
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
      rankedCityIds: [...(cityRankIndexOf(content)?.byCity.keys() ?? [])],
      legendary: content.legendary,
      bestiary: content.bestiary,
      bosses: content.bosses,
      settlement: content.settlement,
      instances: content.instances,
      achievements: content.achievements,
      traits: content.traits,
      events: content.events
    }),
    moveProjectItems: moveKeepingTraits(moveProjectItems, traitIndexOf(content)),
    // Sending to another room of the world (transfer.mjs): the item's answer says what was salvaged.
    // An item a character holds is taken from it, and the slot re-picked under the legendary rules.
    sendItem: (save, sending) => sendItem(save, sending, legendaryIndexOf(content)).save,
    sendItemWithSalvage: (save, sending) => sendItem(save, sending, legendaryIndexOf(content)),
    sendItemProblem,
    sendRelic,
    sendRelicProblem,
    // Every deal counts towards the city's rank; charters raise it (city-rank-actions.mjs).
    ...withCityRanks(marketActions(content), content),
    /** The name of an item's entry, plain or legendary, as the view gives it; the id when unknown. */
    itemName: (entryId) => itemNameOf(content, entryId),
    // Instances (instance-run.mjs): entering one, choosing the vault's boon, recalling the party;
    // each answers the same save when refused, and its problem function says why.
    enterInstance: (save, entry) => enterInstance(save, entry, instanceIndexOf(content)),
    enterProblem: (save, entry) => enterProblem(save, entry, instanceIndexOf(content)),
    chooseBoon: (save, choice) => chooseBoon(save, choice, instanceIndexOf(content)),
    boonProblem: (save, choice) => boonProblem(save, choice, instanceIndexOf(content)),
    recallParty,
    // Achievements and the journal (chronicle.mjs): granted and counted after every change kept.
    ...chronicleActions(content),
    ...traits,
    /** The ids of the market's cities, for the bridge to check an action's city against. */
    cityIds: (content.cities?.cities ?? []).map((city) => city.id)
  }
}

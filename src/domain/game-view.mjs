// The game part of the view state: why the game is off, or the worlds, rooms and characters a
// UI draws, reshaped from the engine's view and kept small enough for a panel post. Pure.
import { describeBestiaryEvent } from './game-bestiary-view.mjs'
import { describeLegendaryDrop, legendaryMarks, legendaryShown } from './game-legendary-view.mjs'
import { gameStateOf } from './game-sessions.mjs'

/** Items of a room's chest sent to the UI: the ones in use, then the strongest free ones. */
export const CHEST_ITEMS_SHOWN = 12
/** Retirees of a room sent to the UI, newest first; the rest are only counted. */
export const RETIREES_SHOWN = 8
/** Events kept for a UI to animate. */
export const RECENT_EVENTS_KEPT = 20
/** States in which an agent waits for a person; its party waits with it. */
const PAUSING_STATES = new Set(['waiting', 'blocked'])

/**
 * @typedef {'running' | 'off' | 'unsupported' | 'newer-save'} GameStatus `unsupported` only when
 *   the game cannot run here at all (its content did not load)
 * @typedef {'history' | 'estimated'} TokenSource where the tokens come from: Orca's session
 *   totals, or the estimate from working time and tool calls
 */

/**
 * Whether the game runs, and if not, why. It runs when the person turned it on and its save is
 * not from a newer plugin; without session totals from Orca it runs on the estimate.
 *
 * @param {{ enabled: boolean, newerSave: boolean }} facts
 * @returns {GameStatus}
 */
export function gameStatus({ enabled, newerSave, loaded = true }) {
  if (!enabled) return 'off'
  if (!loaded) return 'loading-save'
  if (newerSave) return 'newer-save'
  return 'running'
}

/**
 * Where the tokens come from: real session totals when this Orca offers the session history and
 * the person granted reading it, the estimate otherwise.
 *
 * @param {{ supported: boolean, granted: boolean }} access
 * @returns {TokenSource}
 */
export function tokenSourceOf({ supported, granted }) {
  return supported && granted ? 'history' : 'estimated'
}

/**
 * What a room's party is doing, from its sessions' states in the last round.
 *
 * @param {{ state: string }[]} readings the room's session states
 * @param {boolean} resting whether the party is resting in its fight
 * @returns {'fighting' | 'resting' | 'paused' | 'idle'}
 */
export function partyStateOf(readings, resting) {
  if (readings.some((reading) => PAUSING_STATES.has(reading.state))) return 'paused'
  if (!readings.some((reading) => reading.state === 'working')) return 'idle'
  return resting ? 'resting' : 'fighting'
}

/**
 * Why a paused party waits: an agent `blocked` comes first, then one `waiting` for the person.
 *
 * @param {{ state: string }[]} readings the room's session states
 * @returns {'blocked' | 'waiting' | null} null when nobody pauses the party
 */
export function pauseReasonOf(readings) {
  if (readings.some((reading) => reading.state === 'blocked')) return 'blocked'
  if (readings.some((reading) => reading.state === 'waiting')) return 'waiting'
  return null
}

/**
 * Adds events to the kept list, newest last, keeping RECENT_EVENTS_KEPT.
 *
 * @param {object[]} recent
 * @param {object[]} events
 * @returns {object[]}
 */
export function keepRecent(recent, events) {
  return [...recent, ...events].slice(-RECENT_EVENTS_KEPT)
}

const compactItem = (item) => item && {
  id: item.id,
  name: item.name,
  slot: item.slot,
  damageType: item.damageType,
  tier: item.tier,
  level: item.level,
  power: item.power,
  heldBy: item.heldBy ?? null,
  upgradeCost: item.upgradeCost,
  affordable: item.affordable,
  ...legendaryMarks(item)
}

/** The items in use, then the strongest free ones, up to CHEST_ITEMS_SHOWN. */
function shownChest(chest) {
  const held = chest.filter((item) => item.heldBy)
  const free = chest.filter((item) => !item.heldBy).sort((a, b) => b.power - a.power || a.id.localeCompare(b.id))
  return [...held, ...free].slice(0, CHEST_ITEMS_SHOWN).map(compactItem)
}

function shownRetirees(retirees, keepTitles) {
  return [...retirees]
    .sort((a, b) => (b.retiredAt ?? 0) - (a.retiredAt ?? 0))
    .slice(0, RETIREES_SHOWN)
    .map((retiree) => ({
      nameId: retiree.nameId,
      class: retiree.class,
      level: retiree.level,
      mainSkill: retiree.mainSkill ?? null,
      retiredAt: retiree.retiredAt ?? null,
      title: keepTitles ? retiree.title ?? null : null
    }))
}

function roomView(project, worldId, readings, keepTitles, sceneTheme) {
  const kills = project.kills ?? 0
  return {
    worldId,
    joined: true,
    wave: project.wave,
    waveKills: project.waveKills,
    kills,
    // Only a travelling room has one: the theme it is drawn in, whatever its default.
    ...(sceneTheme ? { sceneTheme } : {}),
    killsToPass: project.killsToPass,
    monster: project.monster,
    party: partyStateOf(readings, project.resting),
    pausedBy: pauseReasonOf(readings),
    stamina: project.stamina,
    tradeChoice: project.tradeChoice ?? null,
    chest: shownChest(project.chest),
    chestSize: project.chest.length,
    retirees: shownRetirees(project.retirees, keepTitles),
    retiredCount: project.retirees.length + project.retiredCount,
    bonus: project.retireeBonus,
    relics: project.relics ?? { owned: [], active: null },
    // Inside an instance: where its run is (docs/GAME.md, "Instances"); null on the waves.
    run: project.run ?? null,
    instanceCooldowns: project.instanceCooldowns ?? null,
    // The trait scrolls in its chest (docs/GAME.md, "Traits").
    scrolls: project.scrolls ?? []
  }
}

function characterView(member, link, state) {
  const equipment = Object.fromEntries(Object.entries(member.equipment)
    .map(([slot, item]) => [slot, item
      ? { id: item.id, name: item.name, tier: item.tier, level: item.level, ...legendaryMarks(item) }
      : null]))
  return {
    sessionId: member.sessionId,
    link: link.how,
    guest: false,
    class: member.class,
    level: member.level,
    levelProgress: member.levelProgress,
    attributes: member.attributes,
    equipment,
    trade: member.trade,
    tradeChoice: member.tradeChoice ?? null,
    autoTrade: member.autoTrade ?? null,
    pinned: member.pinned ?? {},
    // What it carries, its slots and its next one; null without traits in the content.
    traits: member.traits ?? null,
    state
  }
}

/**
 * Each room's session states as they are now: those of the agents on screen from the store, the
 * others (sessions no agent runs) from the last round.
 */
function currentStatesByRoom({ links, agentStates, agentlessStates }) {
  const byRoom = {}
  for (const [roomId, readings] of Object.entries(agentlessStates)) byRoom[roomId] = [...readings]
  for (const [agentId, link] of links) {
    if (!agentStates.has(agentId)) continue
    ;(byRoom[link.roomId] ??= []).push({ state: gameStateOf(agentStates.get(agentId)) })
  }
  return byRoom
}

/**
 * A room's name from its id, the last segment of its folder: "local:/work/rumble-banana" is
 * "rumble-banana". The whole path is never shown.
 *
 * @param {string} roomId
 */
export function roomNameOf(roomId) {
  const segments = roomId.split(/[/\\]/).filter(Boolean)
  const last = segments.at(-1) ?? roomId
  return last.slice(last.lastIndexOf(':') + 1) || roomId
}

/**
 * The world's projects left behind: not among the rooms on screen, with a chest item or a retiree
 * to move. A room out of the game that is still on screen is not one.
 *
 * @param {object[]} projects the world's projects in the engine's view
 * @param {string[]} roomIds the rooms on screen
 */
export function orphansOf(projects, roomIds) {
  return projects
    .filter((project) => !roomIds.includes(project.id))
    .map((project) => ({
      roomId: project.id,
      name: roomNameOf(project.id),
      chestSize: project.chest.length,
      retiredCount: project.retirees.length + project.retiredCount
    }))
    .filter((orphan) => orphan.chestSize > 0 || orphan.retiredCount > 0)
}

/** How many purchases of the same thing come after the one at `index` in the kept events. */
function laterPurchases(recent, index, isSame) {
  return recent.slice(index + 1).filter((event) => event.type === 'purchase' && isSame(event)).length
}

/**
 * A purchase with what a UI shows of it: the room and the item's name for an item upgrade, and
 * the level it reached, worked back from the level now and the purchases of the same thing kept
 * after it. An upgrade made by hand after it is not an event, so it is not counted.
 */
function describePurchase(event, index, recent, { projects, worlds }) {
  if (event.kind === 'group') {
    const world = worlds.find((item) => item.id === event.worldId)
    const upgrade = world?.upgrades?.find((item) => item.id === event.upgradeId)
    if (!upgrade) return event
    const later = laterPurchases(recent, index, (other) => other.kind === 'group' &&
      other.worldId === event.worldId && other.upgradeId === event.upgradeId)
    return { ...event, roomId: null, level: upgrade.level - later }
  }
  const item = projects.get(event.projectId)?.project.chest.find((entry) => entry.id === event.itemId)
  const described = { ...event, roomId: event.projectId }
  if (!item) return described
  const later = laterPurchases(recent, index, (other) =>
    other.projectId === event.projectId && other.itemId === event.itemId)
  return { ...described, name: item.name, level: item.level - later }
}

/**
 * The kept events with the names and levels a UI shows: a kill's monster level (its wave: a
 * monster's level is the wave it comes on), a drop's item name and tier, and a purchase's room,
 * name and level. A kill's monster name is not known here: the bridge's kill events do not
 * carry it.
 */
function describeEvents(recent, { projects, worlds, itemEntries, legendary, bestiary }) {
  return recent.map((event, index) => {
    if (event.type === 'kill') return { ...event, level: event.wave }
    if (event.type === 'legendary') return describeLegendaryDrop(event, legendary)
    if (event.type === 'bestiary') return describeBestiaryEvent(event, bestiary)
    if (event.type === 'drop') {
      const entry = itemEntries[event.item]
      return entry ? { ...event, name: entry.name, tier: entry.tier } : event
    }
    if (event.type === 'purchase') return describePurchase(event, index, recent, { projects, worlds })
    return event
  })
}

/**
 * The game part of the view state.
 *
 * @param {object} input
 * @param {GameStatus} input.status
 * @param {TokenSource | null} input.tokenSource null when the game is not running
 * @param {boolean} input.autoSpend
 * @param {boolean} [input.travel] "new scene after each monster"
 * @param {boolean} input.keepTitles
 * @param {{ worlds: object[], projectWorld: Record<string, string | null> } | null} input.engineView
 *   the engine's `view(save)`, or null when the game is not running
 * @param {string} input.defaultWorldId the world of a room that was never assigned one
 * @param {string[]} input.roomIds the rooms the store shows now
 * @param {Map<string, { sessionId: string | null, roomId: string, how: string }>} input.links by agent
 *   id: the session each character on screen runs, `how` the way it was matched ('session',
 *   'title', 'only', 'agent' for the estimate) or 'guest'
 * @param {Map<string, string>} input.agentStates the store's state of each agent on screen now. A
 *   character's state and its party's come from here, so they never lag behind the rooms; a
 *   character whose agent is not on screen is left out.
 * @param {Record<string, { state: string }[]>} input.agentlessStates by room, the last round's
 *   states of the sessions no agent on screen runs
 * @param {object[]} input.recent
 * @param {object} input.debug counters from the last round
 * @param {Record<string, object>} [input.skillSplits] by world: where its split between work skills
 *   comes from and what a rebalance would do, added to the world as `skillSplit`
 * @param {(roomId: string, kills: number) => string | null} [input.sceneThemeOf] the theme a room
 *   that travels is in after that many kills, null for a room that stays put
 * @returns {object}
 */
export function buildGameView(input) {
  const { status, autoSpend, keepTitles, engineView, defaultWorldId, roomIds, links, agentStates, recent, debug } = input
  const travel = input.travel === true
  const sceneThemeOf = input.sceneThemeOf ?? (() => null)
  if (status !== 'running' || !engineView) return { status, tokenSource: null, autoSpend, travel, keepTitles }
  const { tokenSource } = input
  const projects = new Map()
  for (const world of engineView.worlds) {
    for (const project of world.projects) projects.set(project.id, { project, worldId: world.id })
  }
  const worldOf = (roomId) =>
    (Object.hasOwn(engineView.projectWorld, roomId) ? engineView.projectWorld[roomId] : defaultWorldId)
  const statesByRoom = currentStatesByRoom({ links, agentStates, agentlessStates: input.agentlessStates })
  const rooms = {}
  for (const roomId of roomIds) {
    const worldId = worldOf(roomId)
    const found = projects.get(roomId)
    if (worldId === null || !found || found.worldId !== worldId) {
      rooms[roomId] = { worldId, joined: false }
      continue
    }
    const sceneTheme = sceneThemeOf(roomId, found.project.kills ?? 0)
    rooms[roomId] = roomView(found.project, worldId, statesByRoom[roomId] ?? [], keepTitles, sceneTheme)
  }
  const characters = {}
  for (const [agentId, link] of links) {
    if (!agentStates.has(agentId)) continue
    if (link.how === 'guest') {
      characters[agentId] = { sessionId: null, link: 'guest', guest: true, level: 1 }
      continue
    }
    const member = projects.get(link.roomId)?.project.party.find((item) => item.sessionId === link.sessionId)
    if (member) characters[agentId] = characterView(member, link, gameStateOf(agentStates.get(agentId)))
  }
  const worlds = engineView.worlds.map(({ projects: worldProjects, ...world }) => ({
    ...world,
    roomIds: worldProjects.map((project) => project.id).filter((id) => roomIds.includes(id)),
    orphans: orphansOf(worldProjects, roomIds),
    ...(input.skillSplits?.[world.id] ? { skillSplit: input.skillSplits[world.id] } : {})
  }))
  const tickSeconds = engineView.tickSeconds ?? null
  const described = describeEvents(recent, {
    projects, worlds, itemEntries: engineView.itemEntries ?? {}, legendary: engineView.legendary,
    bestiary: engineView.bestiary
  })
  const legendary = legendaryShown(engineView.legendary, { rooms, characters, recent: described, worlds })
  return {
    status, tokenSource, autoSpend, travel, keepTitles, tickSeconds, worlds, rooms, characters, recent: described, debug,
    ...(legendary ? { legendary } : {}),
    // The races' and bosses' names and looks, the same for every world; each world has its counts.
    ...(engineView.bestiary ? { bestiary: engineView.bestiary } : {}),
    // The instances' names, art and rooms, the same for every world; each world has its progress.
    ...(engineView.instances ? { instances: engineView.instances } : {}),
    // The trait catalogue, the same for every world; each world has its collection and brokers.
    ...(engineView.traits ? { traits: engineView.traits } : {})
  }
}

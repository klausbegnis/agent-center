// The game part of the view state: why the game is off, or the worlds, rooms and characters a
// UI draws, reshaped from the engine's view and kept small enough for a panel post. Pure.

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
export function gameStatus({ enabled, newerSave }) {
  if (!enabled) return 'off'
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
  affordable: item.affordable
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

function roomView(project, worldId, partyState, keepTitles) {
  return {
    worldId,
    joined: true,
    wave: project.wave,
    waveKills: project.waveKills,
    killsToPass: project.killsToPass,
    monster: project.monster,
    party: partyState,
    stamina: project.stamina,
    chest: shownChest(project.chest),
    chestSize: project.chest.length,
    retirees: shownRetirees(project.retirees, keepTitles),
    retiredCount: project.retirees.length + project.retiredCount,
    bonus: project.retireeBonus
  }
}

function characterView(member, link) {
  const equipment = Object.fromEntries(Object.entries(member.equipment)
    .map(([slot, item]) => [slot, item ? { id: item.id, name: item.name, tier: item.tier, level: item.level } : null]))
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
    state: member.state
  }
}

/**
 * The game part of the view state.
 *
 * @param {object} input
 * @param {GameStatus} input.status
 * @param {TokenSource | null} input.tokenSource null when the game is not running
 * @param {boolean} input.autoSpend
 * @param {boolean} input.keepTitles
 * @param {{ worlds: object[], projectWorld: Record<string, string | null> } | null} input.engineView
 *   the engine's `view(save)`, or null when the game is not running
 * @param {string} input.defaultWorldId the world of a room that was never assigned one
 * @param {string[]} input.roomIds the rooms the store shows now
 * @param {Map<string, { sessionId: string | null, roomId: string, how: string }>} input.links by agent
 *   id: the session each character on screen runs, `how` the way it was matched ('session',
 *   'title', 'only', 'agent' for the estimate) or 'guest'
 * @param {Record<string, { state: string }[]>} input.statesByRoom the last round's session states
 * @param {object[]} input.recent
 * @param {object} input.debug counters from the last round
 * @returns {object}
 */
export function buildGameView(input) {
  const { status, autoSpend, keepTitles, engineView, defaultWorldId, roomIds, links, statesByRoom, recent, debug } = input
  if (status !== 'running' || !engineView) return { status, tokenSource: null, autoSpend, keepTitles }
  const { tokenSource } = input
  const projects = new Map()
  for (const world of engineView.worlds) {
    for (const project of world.projects) projects.set(project.id, { project, worldId: world.id })
  }
  const worldOf = (roomId) =>
    (Object.hasOwn(engineView.projectWorld, roomId) ? engineView.projectWorld[roomId] : defaultWorldId)
  const rooms = {}
  for (const roomId of roomIds) {
    const worldId = worldOf(roomId)
    const found = projects.get(roomId)
    if (worldId === null || !found || found.worldId !== worldId) {
      rooms[roomId] = { worldId, joined: false }
      continue
    }
    const partyState = partyStateOf(statesByRoom[roomId] ?? [], found.project.resting)
    rooms[roomId] = roomView(found.project, worldId, partyState, keepTitles)
  }
  const characters = {}
  for (const [agentId, link] of links) {
    if (link.how === 'guest') {
      characters[agentId] = { sessionId: null, link: 'guest', guest: true, level: 1 }
      continue
    }
    const member = projects.get(link.roomId)?.project.party.find((item) => item.sessionId === link.sessionId)
    if (member) characters[agentId] = characterView(member, link)
  }
  const worlds = engineView.worlds.map(({ projects: worldProjects, ...world }) => ({
    ...world,
    roomIds: worldProjects.map((project) => project.id).filter((id) => roomIds.includes(id))
  }))
  return { status, tokenSource, autoSpend, keepTitles, worlds, rooms, characters, recent, debug }
}

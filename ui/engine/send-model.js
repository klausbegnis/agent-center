// Sending an item or a relic to another room of the same world, as data: which rooms it can go
// to and what can be sent. Never touches the DOM; the worker checks everything again.
import { joinedRooms } from './game-model.js'
import { roomTitle } from './labels.js'

/**
 * The rooms on screen that play in the same world as `roomId`, other than it, in the order the
 * rooms are listed: where something of its chest can be sent.
 *
 * @param {{ rooms: object[], game: object }} state
 * @param {string} roomId
 * @returns {{ id: string, name: string }[]}
 */
export function sendTargets(state, roomId) {
  const worldId = state.game?.rooms?.[roomId]?.worldId ?? null
  if (worldId === null) return []
  return joinedRooms(state)
    .filter((room) => room.id !== roomId && state.game.rooms[room.id].worldId === worldId)
    .map((room) => ({ id: room.id, name: roomTitle(room) }))
}

/** What a chest slot carries when it is dragged onto a room chip: `{ roomId, itemIds }` as JSON. */
export const ITEM_DRAG_TYPE = 'application/x-agent-center-items'

/**
 * The relics a room owns that can be sent: every one but the active one, in the order owned.
 *
 * @param {object} game the view state's `game`
 * @param {string} roomId
 * @returns {string[]}
 */
export function sendableRelics(game, roomId) {
  const relics = game?.rooms?.[roomId]?.relics
  if (!relics) return []
  return relics.owned.filter((id) => id !== relics.active)
}

/**
 * Who on screen is the character with a session id: its agent's name, or '' when none is.
 *
 * @param {{ rooms: object[], game: object }} state
 */
function characterName(state, sessionId) {
  const characters = state.game?.characters ?? {}
  const agentId = Object.keys(characters).find((id) => characters[id]?.sessionId === sessionId)
  if (!agentId) return ''
  return state.rooms.flatMap((room) => room.agents ?? []).find((agent) => agent.id === agentId)?.name ?? ''
}

/** Whether a room's chest, as the view shows it, holds a legendary entry. */
const ownsLegendaryEntry = (state, roomId, entryId) =>
  (state.game?.rooms?.[roomId]?.chest ?? []).some((owned) => owned.legendary && owned.entryId === entryId)

/**
 * What the send control of an item's detail shows: the rooms it can go to (one that owns a legendary
 * item already says so and cannot be picked), why it cannot be used at all, and who holds the item.
 *
 * @param {{ rooms: object[], game: object }} state
 * @param {string} roomId
 * @param {{ id: string, heldBy?: string | null, legendary?: boolean, entryId?: string }} item
 * @param {{ canSend: boolean, words: { viewOnly: string, noRoom: string, legendaryEverywhere: string } }} options
 *   `canSend` is false on a page that only watches
 * @returns {{ reason: string | null, targets: { id: string, name: string, owns: boolean }[],
 *   isHeld: boolean, holder: string }}
 */
export function itemSending(state, roomId, item, { canSend, words }) {
  const isHeld = Boolean(item.heldBy)
  const holder = isHeld ? characterName(state, item.heldBy) : ''
  const targets = sendTargets(state, roomId).map((room) => ({
    ...room,
    owns: Boolean(item.legendary) && ownsLegendaryEntry(state, room.id, item.entryId)
  }))
  let reason = null
  if (!canSend) reason = words.viewOnly
  else if (targets.length === 0) reason = words.noRoom
  else if (targets.every((room) => room.owns)) reason = words.legendaryEverywhere
  return { reason, targets, isHeld, holder }
}

/**
 * What the Relics card's send row shows: the relics that can go, the rooms, and why it cannot be
 * used when it cannot.
 *
 * @param {{ rooms: object[], game: object }} state
 * @param {string} roomId
 * @param {{ canSend: boolean, words: { viewOnly: string, noRoom: string, noRelics: string, onlyActive: string } }} options
 * @returns {{ reason: string | null, relicIds: string[], targets: { id: string, name: string }[] }}
 */
export function relicSending(state, roomId, { canSend, words }) {
  const owned = state.game?.rooms?.[roomId]?.relics?.owned ?? []
  const relicIds = sendableRelics(state.game, roomId)
  const targets = sendTargets(state, roomId)
  let reason = null
  if (!canSend) reason = words.viewOnly
  else if (owned.length === 0) reason = words.noRelics
  else if (relicIds.length === 0) reason = words.onlyActive
  else if (targets.length === 0) reason = words.noRoom
  return { reason, relicIds, targets }
}

/**
 * The names of the characters holding some of the chosen items, each once, in chest order; '' for
 * one not on screen is left out.
 *
 * @param {{ rooms: object[], game: object }} state
 * @param {{ heldBy?: string | null }[]} items
 */
export function holdersOf(state, items) {
  const names = items.filter((item) => item.heldBy).map((item) => characterName(state, item.heldBy)).filter(Boolean)
  return [...new Set(names)]
}

/**
 * What each character that lost a sent item took instead, as `{ name, slot, itemName }`, from the
 * worker's answer.
 *
 * @param {{ rooms: object[], game: object }} state
 * @param {{ sessionId: string, slot: string, itemName: string | null }[]} repicks
 */
export function repickedNames(state, repicks = []) {
  return repicks
    .map(({ sessionId, slot, itemName }) => ({ name: characterName(state, sessionId), slot, itemName }))
    .filter((entry) => entry.name)
}

/**
 * The chosen items of a chest that are still in it, in chest order, for the move mode.
 *
 * @param {{ id: string }[]} chest
 * @param {Set<string>} chosenIds
 */
export function chosenItems(chest, chosenIds) {
  return chest.filter((item) => chosenIds.has(item.id))
}

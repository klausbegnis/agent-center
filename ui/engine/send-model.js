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

/**
 * Whether an item of the chest can be sent: one nobody holds. A free item is never pinned, since a
 * pin names a slot of a character, which holds its item.
 *
 * @param {{ heldBy?: string | null } | null} item
 */
export function canSendItem(item) {
  return Boolean(item) && !item.heldBy
}

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

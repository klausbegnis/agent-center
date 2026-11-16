// What a page opened from another machine on the local network receives. It sees the rooms like
// the page on this computer, but not the game's session ids or the conversation titles kept on
// retirees, and it is told that the game's controls work only on this computer.
import crypto from 'node:crypto'

/** Long enough that two sessions of one game never share an alias. */
const ALIAS_LENGTH = 16

/**
 * @param {{ secret?: Buffer }} [options] the key the aliases are made with; a new random one by
 *   default, so an alias means nothing outside this run of the worker
 * @returns {(state: object) => object} the view state as a page on another machine gets it
 */
export function createNetworkView({ secret = crypto.randomBytes(32) } = {}) {
  /**
   * Each session id is replaced by an alias. The same session gets the same alias in every state,
   * so the page can still tell who holds an item, but the id cannot be read back from it.
   */
  const aliasOf = (sessionId) => (typeof sessionId === 'string'
    ? `session-${crypto.createHmac('sha256', secret).update(sessionId).digest('base64url').slice(0, ALIAS_LENGTH)}`
    : sessionId)

  function roomOf(room) {
    if (!room?.joined) return room
    return {
      ...room,
      chest: room.chest?.map((item) => ({ ...item, heldBy: aliasOf(item.heldBy) })),
      retirees: room.retirees?.map((retiree) => ({ ...retiree, title: null }))
    }
  }

  function gameOf(game) {
    if (!game) return game
    const shown = { ...game, viewOnly: true }
    if (game.rooms) {
      shown.rooms = Object.fromEntries(Object.entries(game.rooms).map(([roomId, room]) => [roomId, roomOf(room)]))
    }
    if (game.characters) {
      shown.characters = Object.fromEntries(Object.entries(game.characters)
        .map(([agentId, character]) => [agentId, { ...character, sessionId: aliasOf(character.sessionId) }]))
    }
    if (game.recent) {
      shown.recent = game.recent.map((event) => ('sessionId' in event ? { ...event, sessionId: aliasOf(event.sessionId) } : event))
    }
    return shown
  }

  return (state) => ({ ...state, game: gameOf(state.game) })
}

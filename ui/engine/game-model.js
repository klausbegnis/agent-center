// What the game part of the view state means for the screen: whether the game shows, which tab
// is open, and the facts each part draws, picked out of the state. Never touches the DOM.
import { clampShare } from './game-format.js'

/** The game's tabs, in the order they are shown. */
export const GAME_TABS = /** @type {const} */ (['rooms', 'arsenal', 'skills'])
const DEFAULT_TAB = 'rooms'

/**
 * How the game shows: not at all (`off`), in full (`running`), or as tabs that explain why it
 * cannot run (`unavailable`, for any other status, including ones this UI does not know).
 *
 * @param {{ status?: string } | undefined} game the view state's `game`, absent from older workers
 * @returns {'off' | 'running' | 'unavailable'}
 */
export function gameModeOf(game) {
  const status = game?.status ?? 'off'
  if (status === 'off') return 'off'
  if (status === 'running' && game.worlds && game.rooms) return 'running'
  return 'unavailable'
}

/** A saved or asked-for tab when it is one of GAME_TABS, otherwise the rooms. */
export function tabOrDefault(value) {
  return GAME_TABS.includes(value) ? value : DEFAULT_TAB
}

/** The tab a key press moves to in the tab list, or null for a key the tabs ignore. */
export function tabAfterKey(current, key) {
  const index = GAME_TABS.indexOf(current)
  if (key === 'ArrowRight') return GAME_TABS[(index + 1) % GAME_TABS.length]
  if (key === 'ArrowLeft') return GAME_TABS[(index - 1 + GAME_TABS.length) % GAME_TABS.length]
  if (key === 'Home') return GAME_TABS[0]
  if (key === 'End') return GAME_TABS[GAME_TABS.length - 1]
  return null
}

/** Whether progress is estimated from working time rather than measured in tokens. */
export function isEstimated(game) {
  return game?.tokenSource === 'estimated'
}

/**
 * The fight of a room that has joined the game, or null for a room that has not or is out of it.
 *
 * @param {object} game the view state's `game`
 * @param {string} roomId
 * @returns {null | { wave: number, waveKills: number, killsToPass: number, party: string,
 *   stamina: number, monster: object | null, health: number, isElite: boolean, isBoss: boolean }}
 */
export function roomFight(game, roomId) {
  const room = game?.rooms?.[roomId]
  if (!room?.joined) return null
  const monster = room.monster ?? null
  return {
    wave: room.wave,
    waveKills: room.waveKills,
    killsToPass: room.killsToPass,
    party: room.party,
    stamina: clampShare(room.stamina),
    monster,
    health: clampShare(monster?.healthShare),
    isElite: Boolean(monster?.affix),
    isBoss: monster?.kind === 'boss'
  }
}

/**
 * What the mark on a character shows: nothing, "guest", or its level and class, with its
 * gathering trade while its agent is idle.
 *
 * @param {object | undefined} character an entry of the view state's `game.characters`
 * @returns {null | { kind: 'guest' } | { kind: 'member', level: number, classId: string,
 *   trade: string | null, isGathering: boolean }}
 */
export function characterBadge(character) {
  if (!character) return null
  if (character.guest) return { kind: 'guest' }
  return {
    kind: 'member',
    level: character.level,
    classId: character.class,
    trade: character.trade ?? null,
    isGathering: character.state === 'idle' && Boolean(character.trade)
  }
}

/** A monster's accent colour when it is a plain hex colour, so nothing else reaches the page's CSS. */
const HEX_COLOUR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i
const DEFAULT_ACCENT = '#8a8f99'

/** The accent colour to draw a monster with. */
export function monsterAccent(monster) {
  const accent = monster?.sprite?.accent
  return typeof accent === 'string' && HEX_COLOUR.test(accent) ? accent : DEFAULT_ACCENT
}

/** The world with this id in the view state, or null. */
export function worldById(game, worldId) {
  return game?.worlds?.find((world) => world.id === worldId) ?? null
}

/**
 * The rooms that have joined the game, in the order the rooms are listed.
 *
 * @param {{ rooms: { id: string }[], game: object }} state
 * @returns {{ id: string, name: string, host: string | null }[]}
 */
export function joinedRooms(state) {
  return state.rooms.filter((room) => state.game?.rooms?.[room.id]?.joined)
}

/** The room asked for when it has joined, otherwise the first that has, or null. */
export function chosenRoomId(state, wanted) {
  const rooms = joinedRooms(state)
  return (rooms.find((room) => room.id === wanted) ?? rooms[0])?.id ?? null
}

/**
 * The characters of a room's agents, with the agent each belongs to. Guests are counted, not
 * listed: they keep nothing.
 *
 * @returns {{ members: { agent: object, character: object }[], guests: number }}
 */
export function roomCharacters(state, roomId) {
  const room = state.rooms.find((item) => item.id === roomId)
  const members = []
  let guests = 0
  for (const agent of room?.agents ?? []) {
    const character = state.game?.characters?.[agent.id]
    if (!character) continue
    if (character.guest) guests += 1
    else members.push({ agent, character })
  }
  return { members, guests }
}

/**
 * The name of the agent whose character holds an item, null for a free item, or '' for one held
 * by a character not on screen.
 */
export function holderName(item, state, roomId) {
  if (!item.heldBy) return null
  const { members } = roomCharacters(state, roomId)
  return members.find(({ character }) => character.sessionId === item.heldBy)?.agent.name ?? ''
}

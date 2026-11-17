// What the game part of the view state means for the screen: whether the game shows, which tab
// is open, and the facts each part draws, picked out of the state. Never touches the DOM.
import { clampShare } from './game-format.js'
import { monsterRank } from './monster-rank.js'

/** The game's tabs, in the order they are shown. */
export const GAME_TABS = /** @type {const} */ (['rooms', 'party', 'chest', 'camp', 'skills', 'market'])
const DEFAULT_TAB = 'rooms'
/** The tabs that show one room; the others show its whole world (or, Rooms, every room). */
export const ROOM_TABS = Object.freeze(['party', 'chest'])
export const WORLD_TABS = Object.freeze(['camp', 'skills', 'market'])
/**
 * The Arsenal's sections before they became tabs, by the section a saved preference or a link
 * names (`?tab=arsenal&section=party`). The Arsenal opened on its items when no section was named.
 */
const ARSENAL_SECTION_TABS = Object.freeze({ items: 'chest', party: 'party', camp: 'camp' })

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

/**
 * A saved or asked-for tab when it is one of GAME_TABS, otherwise the rooms. The Arsenal, which
 * held Chest, Party and Camp, maps to the tab of its section, so old preferences and links work.
 *
 * @param {unknown} value
 * @param {unknown} [section] the Arsenal section saved or asked for with it
 */
export function tabOrDefault(value, section) {
  if (value === 'arsenal') {
    return Object.hasOwn(ARSENAL_SECTION_TABS, section) ? ARSENAL_SECTION_TABS[section] : 'chest'
  }
  return GAME_TABS.includes(value) ? value : DEFAULT_TAB
}

/**
 * The room the Rooms tab is narrowed to: one that has joined the game, or null for all rooms.
 *
 * @param {{ rooms: { id: string }[], game: object }} state
 * @param {string | null} wanted
 */
export function roomFilterOf(state, wanted) {
  return wanted && joinedRooms(state).some((room) => room.id === wanted) ? wanted : null
}

/**
 * The rooms the Rooms tab draws: every visible room, or only the one it is narrowed to.
 *
 * @template {{ id: string }} Room
 * @param {Room[]} rooms
 * @param {string | null} filterId
 * @returns {Room[]}
 */
export function filteredRooms(rooms, filterId) {
  if (!filterId) return rooms
  const only = rooms.filter((room) => room.id === filterId)
  return only.length ? only : rooms
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
 * What a room's party is doing, as the band says it. A paused party says why: an agent `blocked`
 * or one `waiting` for the person. A party that works but has no monster yet is `starting`: it
 * has just formed and its first foe comes with the next round. A worker that does not say why a
 * party is paused, about a room that has no monster yet, is taken as starting too, so a room
 * that has just joined never reads as paused.
 *
 * @param {{ party?: string, pausedBy?: string | null, monster?: object | null }} room
 * @returns {'fighting' | 'resting' | 'idle' | 'starting' | 'waiting' | 'blocked'}
 */
export function partyStatusOf(room) {
  const hasMonster = Boolean(room.monster)
  if (room.party === 'paused') {
    if (room.pausedBy === 'blocked' || room.pausedBy === 'waiting') return room.pausedBy
    return hasMonster ? 'waiting' : 'starting'
  }
  if (room.party === 'fighting' || room.party === 'resting') return hasMonster ? room.party : 'starting'
  return 'idle'
}

/**
 * The fight of a room that has joined the game, or null for a room that has not or is out of it.
 *
 * @param {object} game the view state's `game`
 * @param {string} roomId
 * @returns {null | { wave: number, waveKills: number, killsToPass: number,
 *   party: ReturnType<typeof partyStatusOf>, stamina: number, monster: object | null,
 *   health: number, rank: string | null, isElite: boolean, isBoss: boolean }}
 */
export function roomFight(game, roomId) {
  const room = game?.rooms?.[roomId]
  if (!room?.joined) return null
  const monster = room.monster ?? null
  return {
    wave: room.wave,
    waveKills: room.waveKills,
    killsToPass: room.killsToPass,
    party: partyStatusOf(room),
    stamina: clampShare(room.stamina),
    monster,
    health: clampShare(monster?.healthShare),
    hp: Number.isFinite(monster?.hp) ? monster.hp : null,
    maxHp: Number.isFinite(monster?.maxHp) ? monster.maxHp : null,
    rank: monster ? monsterRank(monster) : null,
    isElite: Boolean(monster?.affix),
    isBoss: monster?.kind === 'boss'
  }
}

/** Party states in which the monster stands in the room: it fights, or waits with the party. */
const MONSTER_STAYS = new Set(['fighting', 'resting', 'waiting', 'blocked', 'idle'])

/**
 * What identifies the monster that should stand in a room now, or null when there is none yet.
 * It stays while nobody in the room works, standing still, so the room shows what waits for the
 * party. A new key is a new monster.
 *
 * @param {ReturnType<typeof roomFight>} fight
 */
export function standingMonsterKey(fight) {
  if (!fight?.monster || !MONSTER_STAYS.has(fight.party)) return null
  const { monster } = fight
  return `${fight.wave}|${fight.waveKills}|${monster.id}|${monster.level}`
}

/** Activities of an agent that is working, for a guest, whose character has no state. */
const WORKING_ACTIVITIES = new Set(['write', 'read', 'run', 'think', 'delegate'])

/**
 * The characters of a room that fight now: the working ones, while the party fights a monster.
 * A guest fights too; it has no class and strikes like a Fighter.
 *
 * @param {{ agents: { id: string, activity: string }[] }} room
 * @param {object} game the view state's `game`
 * @param {ReturnType<typeof roomFight>} fight
 * @returns {{ id: string, classId: string | null }[]}
 */
export function roomFighters(room, game, fight) {
  if (!fight?.monster || fight.party !== 'fighting') return []
  const fighters = []
  for (const agent of room.agents) {
    const character = game.characters?.[agent.id]
    if (!character) continue
    const isWorking = character.state ? character.state === 'working' : WORKING_ACTIVITIES.has(agent.activity)
    if (isWorking) fighters.push({ id: agent.id, classId: character.class ?? null })
  }
  return fighters
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

/** The accent colour to draw a monster with: a hand-made one's accent, a generated one's skin. */
export function monsterAccent(monster) {
  const accent = monster?.sprite?.accent ?? monster?.look?.colours?.skin
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

/** Orca keeps at most this many worlds; the worker refuses a ninth. */
export const MAX_WORLDS = 8
/** The longest world id the worker accepts. */
const WORLD_ID_MAX_LENGTH = 32

/**
 * The id of a new world from the name someone typed: lower case, words joined by dashes, as the
 * worker accepts it.
 *
 * @param {string} text
 * @param {string[]} existingIds
 * @returns {{ id: string } | { error: 'empty' | 'taken' | 'full' }}
 */
export function newWorldId(text, existingIds) {
  if (existingIds.length >= MAX_WORLDS) return { error: 'full' }
  const id = String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, WORLD_ID_MAX_LENGTH)
    .replace(/^-+|-+$/g, '')
  if (!id) return { error: 'empty' }
  if (existingIds.includes(id)) return { error: 'taken' }
  return { id }
}

/**
 * Every room the game knows of, in the order the rooms are listed, with its world (null when it
 * is out of the game).
 *
 * @returns {{ room: object, worldId: string | null }[]}
 */
export function roomWorlds(state) {
  return state.rooms
    .filter((room) => state.game?.rooms && Object.hasOwn(state.game.rooms, room.id))
    .map((room) => ({ room, worldId: state.game.rooms[room.id].worldId ?? null }))
}

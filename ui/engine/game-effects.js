// What the new events of a state look like over the rooms: a damage number or "Defeated!" by the
// monster, "Level 9!" by a character, and short lines about loot, drops, retirements, arrivals
// and purchases under the fight. Never touches the DOM.
import { formatAmount } from './game-format.js'
import { retireeName } from './game-names.js'
import { EFFECT, materialsText, nameFromId, UPGRADE_LABEL } from './labels.js'
import { BESTIARY_EVENT, prestigeTitle } from './bestiary-labels.js'
import { LEGENDARY_EVENT } from './legendary-labels.js'

/** At most this many lines play in one room at once; the newest win. */
export const MAX_ROOM_LINES = 3

/**
 * @typedef {object} Effect
 * @property {string} roomId
 * @property {'monster' | 'agent' | 'room'} target where it plays
 * @property {string} [agentId] for an effect on a character
 * @property {string} text
 * @property {'hit' | 'kill' | 'loot' | 'level' | 'retire' | 'arrive' | 'drop' | 'purchase' | 'legendary' |
 *   'bestiary'} tone
 * @property {string} [artId] a legendary entry whose picture plays with the line
 */

/** The name of a chest item or of a dropped entry, from what the room's chest shows. */
function itemName(room, id) {
  const chest = room?.chest ?? []
  const item = chest.find((entry) => entry.id === id) ?? chest.find((entry) => entry.id.startsWith(`${id}-`))
  return item?.name ?? nameFromId(id)
}

function addMaterials(total, materials) {
  for (const [id, amount] of Object.entries(materials ?? {})) total[id] = (total[id] ?? 0) + amount
}

/** Kills in a room are told once: how many, and everything they paid. */
function killEffects(events, rooms) {
  const byRoom = new Map()
  for (const event of events) {
    if (event.type !== 'kill' || !rooms[event.roomId]) continue
    const entry = byRoom.get(event.roomId) ?? { count: 0, materials: {} }
    entry.count += 1
    addMaterials(entry.materials, event.materials)
    byRoom.set(event.roomId, entry)
  }
  const effects = []
  for (const [roomId, { count, materials }] of byRoom) {
    effects.push({ roomId, target: 'monster', text: EFFECT.defeated(count), tone: 'kill' })
    const loot = Object.entries(materials).map(([id, amount]) => ({ id, amount }))
    if (loot.length) {
      const text = EFFECT.loot(materialsText(loot, formatAmount))
      effects.push({ roomId, target: 'room', text, tone: 'loot' })
    }
  }
  return effects
}

/** A character that went up several levels at once shows only the last. */
function levelEffects(events, rooms) {
  const levels = new Map()
  for (const event of events) {
    if (event.type !== 'level' || !event.agentId || !rooms[event.roomId]) continue
    const previous = levels.get(event.agentId)
    if (!previous || event.level > previous.level) levels.set(event.agentId, event)
  }
  return [...levels.values()].map(({ roomId, agentId, level }) =>
    ({ roomId, target: 'agent', agentId, text: EFFECT.level(level), tone: 'level' }))
}

function purchaseEffects(event, game) {
  if (event.kind === 'group') {
    const world = game.worlds?.find((item) => item.id === event.worldId)
    const level = event.level ?? world?.upgrades?.find((upgrade) => upgrade.id === event.upgradeId)?.level
    const text = EFFECT.built(UPGRADE_LABEL[event.upgradeId] ?? event.upgradeId, level ?? '')
    return (world?.roomIds ?? []).filter((roomId) => game.rooms[roomId]?.joined)
      .map((roomId) => ({ roomId, target: 'room', text, tone: 'purchase' }))
  }
  // The worker names the item and the level it reached; an older worker leaves them out.
  const roomId = event.roomId ?? event.projectId
  const room = game.rooms[roomId]
  if (!room) return []
  const item = room.chest?.find((entry) => entry.id === event.itemId)
  const text = EFFECT.upgraded(event.name ?? itemName(room, event.itemId), event.level ?? item?.level ?? '')
  return [{ roomId, target: 'room', text, tone: 'purchase' }]
}

/** One line for each retirement, drop and purchase. */
function lineEffects(events, game) {
  const effects = []
  for (const event of events) {
    const room = game.rooms[event.roomId]
    if (event.type === 'retire' && room) {
      const text = EFFECT.retired(retireeName(event.nameId), event.level)
      effects.push({ roomId: event.roomId, target: 'room', text, tone: 'retire' })
    } else if (event.type === 'drop' && room && event.item) {
      const text = EFFECT.found(event.name ?? itemName(room, event.item))
      effects.push({ roomId: event.roomId, target: 'room', text, tone: 'drop' })
    } else if (event.type === 'purchase') {
      effects.push(...purchaseEffects(event, game))
    } else if (event.type === 'legendary' && room && event.item) {
      // A legendary drop is celebrated: gold, its picture, and a moment longer on screen.
      const text = LEGENDARY_EVENT.found(event.name ?? nameFromId(event.item))
      effects.push({ roomId: event.roomId, target: 'room', text, tone: 'legendary', artId: event.item })
    } else if (event.type === 'bestiary' && room) {
      const text = bestiaryText(event)
      if (text) effects.push({ roomId: event.roomId, target: 'room', text, tone: 'bestiary' })
    }
  }
  return effects
}

/** What a bestiary event says over the room: a first kill, a level, a title, a hunter rank or level. */
function bestiaryText(event) {
  const name = event.name ?? nameFromId(event.creatureId ?? '')
  if (event.kind === 'hunter') return BESTIARY_EVENT.hunter(event.level)
  if (event.kind === 'rank') return BESTIARY_EVENT.rank(event.level)
  if (event.discovered) return event.kind === 'boss' ? BESTIARY_EVENT.boss(name) : BESTIARY_EVENT.race(name)
  if (event.prestige > 0 && event.title) return BESTIARY_EVENT.prestige(name, prestigeTitle(event.title, event.prestige))
  return event.level ? BESTIARY_EVENT.mastery(name, event.level) : ''
}

/** A new character: who arrived, in which room, and what it took from the chest. */
function arrivalEffects(arrivals, state) {
  const effects = []
  for (const agentId of arrivals) {
    const room = state.rooms.find((item) => item.agents.some((agent) => agent.id === agentId))
    if (!room || !state.game.rooms[room.id]?.joined) continue
    const agent = room.agents.find((item) => item.id === agentId)
    const equipment = state.game.characters[agentId]?.equipment ?? {}
    const items = Object.values(equipment).filter(Boolean).map((item) => item.name)
    effects.push({ roomId: room.id, target: 'room', text: EFFECT.arrived(agent.name, items), tone: 'arrive' })
  }
  return effects
}

/** Keeps the newest MAX_ROOM_LINES lines of each room; the monster and character effects stay. */
function capLines(effects) {
  const counts = new Map()
  const kept = []
  for (const effect of [...effects].reverse()) {
    if (effect.target === 'room') {
      const count = counts.get(effect.roomId) ?? 0
      if (count >= MAX_ROOM_LINES) continue
      counts.set(effect.roomId, count + 1)
    }
    kept.unshift(effect)
  }
  return kept
}

/**
 * The effects to play for what is new in a state.
 *
 * @param {{ events: object[], arrivals: string[], hits: { roomId: string, share: number }[] }} changes
 *   from game-events.js
 * @param {object} state the view state, with the game running
 * @returns {Effect[]}
 */
export function gameEffects(changes, state) {
  const game = state.game
  if (!game?.rooms) return []
  // Health lost between two states is not shown here: the fight in the room shows each blow's
  // damage on the monster itself, and a second number over the band's name only covered it.
  return capLines([
    ...killEffects(changes.events, game.rooms),
    ...levelEffects(changes.events, game.rooms),
    ...arrivalEffects(changes.arrivals, state),
    ...lineEffects(changes.events, game)
  ])
}

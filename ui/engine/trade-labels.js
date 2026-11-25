// The wording of the trade pickers in the Arsenal's Party section: what a room's idle characters
// gather, and what each one does.
import { skillLabel } from './labels.js'

export const TRADES_TEXT = {
  roomTrade: 'Everyone here gathers',
  roomTradeLabel: (room) => `What the characters of ${room} gather while idle, unless one has its own choice`,
  roomAuto: 'Auto: each their own',
  /** The choice that sends idle characters to the materials the world has least of. */
  scarcest: 'Auto: what is scarcest',
  followScarcest: 'Room\'s: what is scarcest',
  /** What a follower of the scarcest gathers now and why: "Gathering Hides: scarcest in the world now". */
  scarcestNow: (material) => `Gathering ${material}: scarcest in the world now`,
  scarcestSoon: 'Picks what is scarcest at the next round',
  characterTrade: (name) => `What ${name} gathers while idle`,
  followRoom: (trade) => `Room's: ${skillLabel(trade)}`,
  auto: (trade) => (trade ? `Auto: ${skillLabel(trade)}` : 'Auto'),
  note: 'Idle characters gather while their agent is done. A character\'s own choice wins over the ' +
    'room\'s; Auto is the trade the game gave it. "What is scarcest" spreads them over the materials ' +
    'the world has least of, against what its buildings cost next, and looks again every hour.'
}

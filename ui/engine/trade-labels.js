// The wording of the trade pickers in the Arsenal's Party section: what a room's idle characters
// gather, and what each one does.
import { skillLabel } from './labels.js'

export const TRADES_TEXT = {
  roomTrade: 'Everyone here gathers',
  roomTradeLabel: (room) => `What the characters of ${room} gather while idle, unless one has its own choice`,
  roomAuto: 'Auto: each their own',
  characterTrade: (name) => `What ${name} gathers while idle`,
  followRoom: (trade) => `Room's: ${skillLabel(trade)}`,
  auto: (trade) => (trade ? `Auto: ${skillLabel(trade)}` : 'Auto'),
  note: 'Idle characters gather while their agent is done. A character\'s own choice wins over the ' +
    'room\'s; Auto is the trade the game gave it.'
}

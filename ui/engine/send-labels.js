// The wording of sending an item or a relic to another room of the same world.

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`

/** "A", "A and B", "A, B and C". */
export function nameList(names) {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

export const SEND = {
  to: 'Send to',
  send: 'Send',
  sendHeld: 'Send…',
  relic: 'Send a relic',
  relicPicker: 'Relic to send',
  itemLabel: (name) => `Room to send ${name} to`,
  relicRoomLabel: 'Room to send the relic to',
  sendItem: (name) => `Send ${name} to the chosen room`,
  sendRelic: 'Send the chosen relic to the chosen room',
  confirm: 'Send it',
  noRoomPick: 'No other room',
  noRelicPick: 'No relic to send',
  /** Why the control cannot be used, said under it. */
  viewOnly: 'This page only watches: items are sent from the computer that runs Orca.',
  noRoom: 'No other room in this world plays yet: a room joins with its first tokens.',
  legendaryEverywhere: 'Every other room of this world already owns this legendary item.',
  ownsIt: (roomName) => `${roomName} (owns it already)`,
  noRelics: 'This room has no relic to send yet.',
  onlyActive: 'The active relic stays; make another one active first.',
  /** Asked once before taking an item from a character. */
  heldQuestion: (itemName, roomName, holder, slot) =>
    `Send ${itemName} to ${roomName}? ${holder || 'The character holding it'} will take the next best ${slot}.`,
  /** Said once the worker took it. */
  itemSent(name, roomName, { salvaged = 0, sentSalvaged = 0 } = {}) {
    if (sentSalvaged > 0) {
      return `${name} went to ${roomName}, whose chest already keeps as many better copies as it holds: ` +
        'it was salvaged into the world\'s materials.'
    }
    if (salvaged > 0) {
      return `${name} went to ${roomName}. Its chest was full of copies, so the lowest one was salvaged ` +
        'into the world\'s materials.'
    }
    return `${name} went to ${roomName}.`
  },
  /** Said for each character that lost a sent item. */
  repicked: (holder, itemName, slot = 'item') => (itemName ? `${holder} now holds ${itemName}.` : `${holder} now holds no ${slot}.`),
  relicSent: (name, roomName) => `${name} went to ${roomName}.`,
  hint: 'Gear stays in its room; sending it is free and only moves where the power sits.',
  /** Moving several items at once. */
  move: 'Move items',
  moveHint: 'Choose the items to send, then the room.',
  moveDone: 'Done',
  moveChosen: (count) => `${plural(count, 'item', 'items')} chosen`,
  moveSend: (count) => `Send ${count}`,
  moveSendLabel: (count) => `Send the ${plural(count, 'chosen item', 'chosen items')} to the chosen room`,
  moveRoomLabel: 'Room to send the chosen items to',
  /** Who loses an item, when its holder is not on screen. */
  someone: 'The characters holding them',
  moveQuestion: (count, roomName, holders) =>
    `Send ${plural(count, 'item', 'items')} to ${roomName}? ${nameList(holders)} will take the next best of what they lose.`,
  manySent(count, roomName, { salvaged = 0 } = {}) {
    const sent = `${plural(count, 'item', 'items')} went to ${roomName}.`
    return salvaged > 0 ? `${sent} ${plural(salvaged, 'copy', 'copies')} past its limit went to materials.` : sent
  }
}

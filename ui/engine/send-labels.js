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
  /** A relic in the picker that is the room's active one. */
  activeRelicOption: (name) => `${name} (active)`,
  /** Asked once before the active relic leaves. */
  activeRelicQuestion: (name, roomName) =>
    `Send ${name} to ${roomName}? It is this room's active relic: the room will have no active relic until you pick one.`,
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
  /**
   * Asked before a sending that the target's copies cap would turn partly into materials: what
   * would be salvaged, sent items first, and for how much.
   *
   * @param {string} roomName
   * @param {{ name: string, level: number, isSent: boolean }[]} salvaged
   * @param {number} materials
   */
  salvageQuestion(roomName, salvaged, materials) {
    const sent = salvaged.filter((item) => item.isSent).map((item) => `${item.name} +${item.level}`)
    const kept = salvaged.filter((item) => !item.isSent)
    const parts = []
    if (sent.length > 0) {
      parts.push(`${roomName} already keeps as many better copies as it holds of ${nameList(sent)}: ` +
        `${sent.length === 1 ? 'it' : 'they'} would be salvaged on arrival`)
    }
    if (kept.length > 0) {
      parts.push(`${plural(kept.length, 'lower copy', 'lower copies')} ${roomName} keeps ` +
        `(${nameList(kept.map((item) => `${item.name} +${item.level}`))}) would be salvaged to make room`)
    }
    return `${parts.join('; ')}, for ${plural(materials, 'material', 'materials')} in all. Send anyway?`
  },
  sendAnyway: 'Send anyway',
  /** Said where the person sent from when the worker would refuse the sending. */
  refused: (reason) => `This cannot be sent: ${reason.replace(/[.\s]+$/, '')}.`,
  /** Said after a sending that salvaged something, naming it. */
  salvagedAfter(salvaged) {
    const names = salvaged.map((item) => `${item.name} +${item.level}${item.isSent ? '' : ' (a copy it kept)'}`)
    return names.length ? `Salvaged into the world's materials: ${nameList(names)}.` : ''
  },
  /** Said for each character that lost a sent item. */
  repicked: (holder, itemName, slot = 'item') => (itemName ? `${holder} now holds ${itemName}.` : `${holder} now holds no ${slot}.`),
  relicSent: (name, roomName, wasActive = false) => (wasActive
    ? `${name} went to ${roomName}. It was the active relic here, so no relic is active now: pick one above.`
    : `${name} went to ${roomName}.`),
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

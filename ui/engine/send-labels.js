// The wording of sending an item or a relic to another room of the same world.

export const SEND = {
  to: 'Send to',
  send: 'Send',
  sending: 'Sending…',
  relic: 'Send a relic',
  relicPicker: 'Relic to send',
  itemLabel: (name) => `Room to send ${name} to`,
  relicRoomLabel: 'Room to send the relic to',
  sendItem: (name) => `Send ${name} to the chosen room`,
  sendRelic: 'Send the chosen relic to the chosen room',
  /** Said once the worker took it. */
  itemSent(name, roomName, { salvaged = 0, sentSalvaged = false } = {}) {
    if (sentSalvaged) {
      return `${name} went to ${roomName}, whose chest already keeps as many better copies as it holds: ` +
        'it was salvaged into the world\'s materials.'
    }
    if (salvaged > 0) {
      return `${name} went to ${roomName}. Its chest was full of copies, so the lowest one was salvaged ` +
        'into the world\'s materials.'
    }
    return `${name} went to ${roomName}.`
  },
  relicSent: (name, roomName) => `${name} went to ${roomName}.`,
  hint: 'Gear stays in its room; sending it is free and only moves where the power sits.'
}

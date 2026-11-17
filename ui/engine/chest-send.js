// Sending items of the Chest tab to another room: the control in an item's detail, the bar of the
// "Move items" mode, and the question asked before taking items from characters (after a drop on a
// room chip, too). It says what happened on the chest's status line, including what each character
// that lost an item took instead.
import { button, el } from './dom.js'
import { SEND } from './send-labels.js'
import { holdersOf, itemSending, repickedNames, sendTargets } from './send-model.js'
import { sendControl } from './send-view.js'

/**
 * @param {{
 *   actions: Record<string, (...args: unknown[]) => Promise<unknown>>,
 *   status: HTMLElement,
 *   ask: HTMLElement
 * }} options `status` is the line that says what happened; `ask` holds a question asked outside an
 *   item's detail (a drop, the move bar)
 */
export function createChestSender({ actions, status, ask }) {
  /** Per item: the room picked last and whether its question is open, so a redraw keeps them. */
  const picked = new Map()
  const openFor = new Set()
  let movePicked = null
  let isMoveAskOpen = false

  const canSend = (state) => typeof actions.sendItem === 'function' && state.game?.viewOnly !== true

  /** Sends, then says where the items went and what their holders took instead. */
  async function send(state, roomId, items, toRoomId, confirmHeld) {
    const answer = await actions.sendItem(roomId, toRoomId, items.map((item) => item.id), confirmHeld)
    if (!answer) return false
    const roomName = sendTargets(state, roomId).find((room) => room.id === toRoomId)?.name ?? toRoomId
    const head = items.length === 1
      ? SEND.itemSent(items[0].name, roomName, answer)
      : SEND.manySent(items.length, roomName, answer)
    const repicks = repickedNames(state, answer.repicks).map(({ name, slot, itemName }) => SEND.repicked(name, itemName, slot))
    status.textContent = [head, ...repicks].join(' ')
    for (const item of items) {
      openFor.delete(item.id)
      picked.delete(item.id)
    }
    return true
  }

  /** The control of an item's detail: always there, disabled with its reason when it cannot be used. */
  function itemPart(state, roomId, item) {
    const sending = itemSending(state, roomId, item, { canSend: canSend(state), words: SEND })
    const options = sending.targets.map((room) => ({
      value: room.id,
      label: room.owns ? SEND.ownsIt(room.name) : room.name,
      disabled: room.owns
    }))
    const nameOf = (toRoomId) => sending.targets.find((room) => room.id === toRoomId)?.name ?? ''
    return sendControl({
      key: `send:${item.id}`,
      prefix: SEND.to,
      pickers: [{
        label: SEND.itemLabel(item.name),
        key: 'send:item-room',
        options,
        value: picked.get(item.id) ?? null,
        emptyLabel: SEND.noRoomPick
      }],
      buttonLabel: SEND.send,
      ariaLabel: SEND.sendItem(item.name),
      reason: sending.reason,
      ask: sending.isHeld
        ? {
            question: ([toRoomId]) => SEND.heldQuestion(item.name, nameOf(toRoomId), sending.holder, item.slot),
            isOpen: openFor.has(item.id),
            onOpenChange: (isOpen) => (isOpen ? openFor.add(item.id) : openFor.delete(item.id))
          }
        : undefined,
      onPick: ([toRoomId]) => picked.set(item.id, toRoomId),
      onSend: ([toRoomId]) => send(state, roomId, [item], toRoomId, sending.isHeld)
    })
  }

  /**
   * Asks once before items held by characters leave, outside an item's detail; sends at once when
   * none is held.
   */
  function sendAsking(state, roomId, items, toRoomId, after = () => {}) {
    const holders = holdersOf(state, items)
    const isHeld = items.some((item) => item.heldBy)
    if (!isHeld) return send(state, roomId, items, toRoomId, false).then(after)
    const roomName = sendTargets(state, roomId).find((room) => room.id === toRoomId)?.name ?? toRoomId
    const question = items.length === 1
      ? SEND.heldQuestion(items[0].name, roomName, holders[0] ?? '', items[0].slot)
      : SEND.moveQuestion(items.length, roomName, holders.length ? holders : [SEND.someone])
    const yes = button(SEND.confirm, 'ac-button ac-primary', {
      onClick: async () => {
        clearAsk()
        await send(state, roomId, items, toRoomId, true)
        after()
      }
    })
    yes.dataset.key = 'send:ask:yes'
    const no = button('Cancel', 'ac-button', { onClick: () => clearAsk() })
    no.dataset.key = 'send:ask:no'
    const actionsRow = el('div', 'ac-game-row')
    actionsRow.append(yes, no)
    ask.replaceChildren(el('p', 'ac-game-card-line', question), actionsRow)
    ask.hidden = false
    no.focus()
    return Promise.resolve()
  }

  function clearAsk() {
    ask.replaceChildren()
    ask.hidden = true
  }

  /** The bar of the "Move items" mode: how many are chosen, the room, Send N, and Done. */
  function moveBar(state, roomId, items, { onDone, onSent }) {
    const bar = el('div', 'ac-game-move-bar')
    const count = el('span', 'ac-game-card-line', SEND.moveChosen(items.length))
    count.setAttribute('role', 'status')
    const sending = itemSending(state, roomId, {}, { canSend: canSend(state), words: SEND })
    const reason = sending.reason ?? (items.length === 0 ? SEND.moveHint : null)
    const holders = holdersOf(state, items)
    const control = sendControl({
      key: 'send:move',
      prefix: SEND.to,
      pickers: [{
        label: SEND.moveRoomLabel,
        key: 'send:move-room',
        options: sending.targets.map((room) => ({ value: room.id, label: room.name })),
        value: movePicked,
        emptyLabel: SEND.noRoomPick
      }],
      buttonLabel: SEND.moveSend(items.length),
      ariaLabel: SEND.moveSendLabel(items.length),
      reason,
      ask: items.some((item) => item.heldBy)
        ? {
            question: ([toRoomId]) => SEND.moveQuestion(items.length,
              sending.targets.find((room) => room.id === toRoomId)?.name ?? '', holders.length ? holders : [SEND.someone]),
            isOpen: isMoveAskOpen,
            onOpenChange: (isOpen) => {
              isMoveAskOpen = isOpen
            }
          }
        : undefined,
      onPick: ([toRoomId]) => {
        movePicked = toRoomId
      },
      onSend: async ([toRoomId]) => {
        isMoveAskOpen = false
        if (await send(state, roomId, items, toRoomId, items.some((item) => item.heldBy))) onSent()
      }
    })
    const done = button(SEND.moveDone, 'ac-button', { onClick: onDone })
    done.dataset.key = 'send:move-done'
    bar.append(count, control, done)
    return bar
  }

  return {
    itemPart,
    moveBar,
    sendAsking,
    clearAsk,
    /** Forgets what was said and asked, when another room is shown. */
    reset() {
      status.textContent = ''
      clearAsk()
      isMoveAskOpen = false
    }
  }
}

// Sending items of the Chest tab to another room: the control in an item's detail, the bar of the
// "Move items" mode, and the questions asked before taking items from characters (after a drop on a
// room chip, too) and before the target's copies cap would salvage any of them: the worker is asked
// first what the sending would do, so an item never turns into materials unannounced, and one it
// would refuse (a legendary item the target owns) is refused where the person sent it. It says
// what happened on the chest's status line, including what was salvaged and what each character
// that lost an item took instead.
import { button, el } from './dom.js'
import { SEND } from './send-labels.js'
import { holdersOf, itemSending, repickedNames, sendTargets } from './send-model.js'
import { sendControl } from './send-view.js'

/** The id of the ask box's question, which its focused button is described by; one chest per page. */
const ASK_WORDS_ID = 'ac-send-ask-words'

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
    // A worker that names what it salvaged says so in one sentence of its own; an older one only counts.
    const named = Array.isArray(answer.salvagedItems)
    const counts = named ? {} : answer
    const head = items.length === 1
      ? SEND.itemSent(items[0].name, roomName, counts)
      : SEND.manySent(items.length, roomName, counts)
    const repicks = repickedNames(state, answer.repicks).map(({ name, slot, itemName }) => SEND.repicked(name, itemName, slot))
    status.textContent = [head, named ? SEND.salvagedAfter(answer.salvagedItems) : '', ...repicks].filter(Boolean).join(' ')
    for (const item of items) {
      openFor.delete(item.id)
      picked.delete(item.id)
    }
    return true
  }

  const roomNameOf = (state, roomId, toRoomId) =>
    sendTargets(state, roomId).find((room) => room.id === toRoomId)?.name ?? toRoomId

  /** Asks the worker what the sending would do; null when it cannot say (the send then decides). */
  async function forecast(roomId, items, toRoomId) {
    if (typeof actions.previewSendItem !== 'function') return null
    const answer = await actions.previewSendItem(roomId, toRoomId, items.map((item) => item.id))
    return answer && typeof answer === 'object' ? answer : null
  }

  /** A question with a primary answer and Cancel, in the ask box, with the focus on Cancel. */
  function showAsk(question, yesLabel, onYes) {
    const words = el('p', 'ac-game-card-line', question)
    words.id = ASK_WORDS_ID
    const nodes = [words]
    const row = el('div', 'ac-game-row')
    if (onYes) {
      const yes = button(yesLabel, 'ac-button ac-primary', {
        onClick: () => {
          clearAsk()
          onYes()
        }
      })
      yes.dataset.key = 'send:ask:yes'
      row.append(yes)
    }
    const no = button(onYes ? 'Cancel' : 'OK', 'ac-button', { onClick: () => clearAsk() })
    no.dataset.key = 'send:ask:no'
    // The focus lands here: a screen reader reads the question with it.
    no.setAttribute('aria-describedby', ASK_WORDS_ID)
    row.append(no)
    ask.replaceChildren(...nodes, row)
    ask.hidden = false
    ask.scrollIntoView?.({ block: 'nearest' })
    no.focus()
  }

  /**
   * Sends after asking the worker what would happen: a refusal is said in the ask box, a salvage
   * is asked about (with the held question's words in front when `heldQuestion` is given), and
   * otherwise the items go at once. `after` runs once they went.
   */
  async function sendChecked(state, roomId, items, toRoomId, { confirmHeld, heldQuestion = '', after = () => {} }) {
    const outlook = await forecast(roomId, items, toRoomId)
    if (outlook?.problem) {
      // Said once, in the ask box where the person sent it from.
      showAsk(SEND.refused(outlook.problem), '', null)
      status.textContent = ''
      return false
    }
    const salvaged = outlook?.salvaged ?? []
    const salvage = salvaged.length > 0 ? SEND.salvageQuestion(roomNameOf(state, roomId, toRoomId), salvaged, outlook.materials) : ''
    const question = [heldQuestion, salvage].filter(Boolean).join(' ')
    const go = async () => {
      if (await send(state, roomId, items, toRoomId, confirmHeld)) after()
    }
    if (!question) return go()
    showAsk(question, salvage ? SEND.sendAnyway : SEND.confirm, go)
    return false
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
      onSend: ([toRoomId]) => {
        openFor.delete(item.id)
        return sendChecked(state, roomId, [item], toRoomId, { confirmHeld: sending.isHeld })
      }
    })
  }

  /**
   * Asks once before items held by characters leave, outside an item's detail; sends at once when
   * none is held.
   */
  function sendAsking(state, roomId, items, toRoomId, after = () => {}) {
    const holders = holdersOf(state, items)
    const isHeld = items.some((item) => item.heldBy)
    const roomName = roomNameOf(state, roomId, toRoomId)
    const heldQuestion = !isHeld
      ? ''
      : items.length === 1
        ? SEND.heldQuestion(items[0].name, roomName, holders[0] ?? '', items[0].slot)
        : SEND.moveQuestion(items.length, roomName, holders.length ? holders : [SEND.someone])
    return sendChecked(state, roomId, items, toRoomId, { confirmHeld: isHeld, heldQuestion, after })
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
        await sendChecked(state, roomId, items, toRoomId, { confirmHeld: items.some((item) => item.heldBy), after: onSent })
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

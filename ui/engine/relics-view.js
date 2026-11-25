// The Relics card of the Arsenal's Items section: the room's active relic large in its frame with
// its name, buff and flavour line, then every relic the room owns as a slot (a single click makes
// one active, and a "No active relic" button puts the active one away), empty slots saying how
// relics are found, and a short teaser while it owns none. Under them, the control that sends a
// relic to another room of the world, always there and disabled with its reason when it cannot be
// used; sending the active relic asks first, since it leaves the room with none active. On a page that cannot play
// (view only) the slots are pictures, not buttons, and a line says nothing can be sent.
import { button, el } from './dom.js'
import { replaceKeepingFocus } from './game-controls.js'
import { framedPicture } from './legendary-art.js'
import { RELICS } from './legendary-labels.js'
import { relicsCard } from './legendary-model.js'
import { SEND } from './send-labels.js'
import { relicSending, sendTargets } from './send-model.js'
import { sendControl } from './send-view.js'

/**
 * @param {{ actions: Record<string, (...args: unknown[]) => Promise<boolean>>, base: string }} options
 */
export function createRelicsCard({ actions, base }) {
  const element = el('section', 'ac-game-card ac-legendary-relics')
  const head = el('div', 'ac-legendary-relics-head')
  const count = el('span', 'ac-muted ac-legendary-count')
  head.append(el('h2', 'ac-game-card-title', RELICS.title), count)
  const body = el('div', 'ac-legendary-relics-body')
  // Says which relic became active, so a click is answered even before the state comes back.
  const status = el('p', 'ac-legendary-status')
  status.setAttribute('role', 'status')
  element.append(head, body, status)
  element.hidden = true
  let drawn = null
  let current = null
  /** The relic asked for and not yet shown active, so its slot says it is on its way. */
  let pendingId = null
  /** The relic picked in the send row, kept across redraws; whether its question is open. */
  let pickedRelicId = null
  let isAskOpen = false

  async function makeActive(roomId, relic) {
    if (relic.isActive || pendingId) return
    pendingId = relic.id
    status.textContent = ''
    draw()
    const went = await actions.setActiveRelic(roomId, relic.id)
    pendingId = null
    if (went) status.textContent = RELICS.nowActive(relic.name)
    draw()
  }

  /** Leaves the room with no active relic. */
  async function putAway(roomId) {
    if (pendingId) return
    pendingId = 'none'
    status.textContent = ''
    draw()
    const went = await actions.setActiveRelic(roomId, null)
    pendingId = null
    if (went) status.textContent = RELICS.noneNow
    draw()
    // The button is gone with the active relic: keep a keyboard user in the card, on the first slot.
    if (!element.contains(element.ownerDocument.activeElement)) element.querySelector('button.ac-legendary-slot')?.focus()
  }

  /** The "No active relic" button, on a page that can pick. */
  function deactivateButton(roomId, active) {
    if (!actions.setActiveRelic) return []
    const node = button(RELICS.deactivate, 'ac-button ac-legendary-deactivate', { onClick: () => putAway(roomId) })
    node.dataset.key = 'relic:none'
    node.setAttribute('aria-label', RELICS.deactivateLabel(active.name))
    node.title = RELICS.deactivateLabel(active.name)
    node.disabled = pendingId !== null
    return [node]
  }

  function activePart(card, roomId) {
    if (!card.active) return [el('p', 'ac-game-card-line', RELICS.noneActive)]
    const { active } = card
    const part = el('div', 'ac-legendary-active')
    const words = el('div', 'ac-legendary-active-words')
    words.append(
      el('span', 'ac-legendary-kicker', RELICS.active),
      el('h3', 'ac-legendary-name', active.name),
      el('p', 'ac-legendary-buff', active.text),
      el('p', 'ac-legendary-flavour', active.flavour),
      ...deactivateButton(roomId, active)
    )
    part.append(framedPicture(base, active.id, { frame: 'active-relic', alt: active.name, className: 'ac-legendary-active-picture' }), words)
    return [part]
  }

  function slot(relic, roomId) {
    const label = RELICS.slotLabel(relic.name, relic.text, relic.isActive)
    const canPick = Boolean(actions.setActiveRelic)
    const node = el(canPick ? 'button' : 'span', 'ac-legendary-slot')
    if (canPick) {
      node.type = 'button'
      node.setAttribute('aria-pressed', String(relic.isActive))
      node.dataset.key = `relic:${relic.id}`
      node.addEventListener('click', () => makeActive(roomId, relic))
    } else {
      node.setAttribute('role', 'img')
    }
    node.classList.toggle('ac-legendary-slot-active', relic.isActive)
    node.classList.toggle('ac-legendary-slot-pending', relic.id === pendingId)
    node.setAttribute('aria-label', label)
    node.title = label
    node.append(framedPicture(base, relic.id, { frame: 'slot' }))
    return node
  }

  function emptySlot() {
    const node = el('span', 'ac-legendary-slot ac-legendary-slot-empty')
    node.title = RELICS.emptySlot
    node.setAttribute('aria-hidden', 'true')
    return node
  }

  function grid(card, roomId) {
    const node = el('div', 'ac-legendary-relic-grid')
    node.setAttribute('role', 'group')
    node.setAttribute('aria-label', RELICS.slots)
    node.append(...card.owned.map((relic) => slot(relic, roomId)))
    for (let index = 0; index < card.emptySlots; index += 1) node.append(emptySlot())
    return node
  }

  /**
   * "Send a relic: [relic] to [room] Send", always there: disabled with the reason when no relic can
   * go or no other room of the world plays; on a page that only watches, a line saying so.
   */
  function sendPart(card, roomId) {
    if (!current.state) return []
    if (typeof actions.sendRelic !== 'function') return [el('p', 'ac-game-card-line ac-muted', SEND.viewOnly)]
    const sending = relicSending(current.state, roomId, { canSend: current.state.game?.viewOnly !== true, words: SEND })
    const relics = sending.relicIds.map((id) => card.owned.find((relic) => relic.id === id)).filter(Boolean)
    const picked = relics.find((relic) => relic.id === pickedRelicId) ?? relics[0] ?? null
    const isActivePicked = Boolean(picked) && picked.id === sending.activeId
    const roomName = (toRoomId) => sending.targets.find((room) => room.id === toRoomId)?.name ?? ''
    return [sendControl({
      key: 'send:relic',
      prefix: SEND.relic,
      pickers: [
        {
          label: SEND.relicPicker,
          key: 'send:relic-which',
          options: relics.map((relic) => ({
            value: relic.id,
            label: relic.id === sending.activeId ? SEND.activeRelicOption(relic.name) : relic.name
          })),
          value: picked?.id ?? null,
          emptyLabel: SEND.noRelicPick
        },
        {
          label: SEND.relicRoomLabel,
          key: 'send:relic-room',
          options: sending.targets.map((room) => ({ value: room.id, label: room.name })),
          emptyLabel: SEND.noRoomPick
        }
      ],
      buttonLabel: SEND.send,
      ariaLabel: SEND.sendRelic,
      reason: sending.reason,
      ask: isActivePicked
        ? {
            question: ([, toRoomId]) => SEND.activeRelicQuestion(picked.name, roomName(toRoomId)),
            isOpen: isAskOpen,
            onOpenChange: (isOpen) => {
              isAskOpen = isOpen
            }
          }
        : undefined,
      onPick: ([relicId]) => {
        if (relicId === pickedRelicId) return
        pickedRelicId = relicId
        isAskOpen = false
        draw()
      },
      onSend: async ([relicId, toRoomId]) => {
        isAskOpen = false
        const wasActive = relicId === sending.activeId
        const went = await actions.sendRelic(roomId, toRoomId, relicId)
        if (!went) return
        const relic = relics.find((entry) => entry.id === relicId)
        status.textContent = SEND.relicSent(relic?.name ?? relicId, roomName(toRoomId) || toRoomId, wasActive)
      }
    })]
  }

  function draw() {
    if (!current) return
    const { game, roomId } = current
    const card = relicsCard(game, roomId)
    element.hidden = !card
    if (!card) return
    const targets = current.state ? sendTargets(current.state, roomId) : []
    const signature = JSON.stringify([roomId, card, pendingId, Boolean(actions.setActiveRelic), targets, pickedRelicId, isAskOpen])
    if (signature === drawn) return
    if (drawn && JSON.parse(drawn)[0] !== roomId) {
      status.textContent = ''
      pickedRelicId = null
      isAskOpen = false
    }
    drawn = signature
    count.textContent = RELICS.owned(card.count, card.total)
    if (card.count === 0) {
      replaceKeepingFocus(body, [el('p', 'ac-game-card-line ac-legendary-teaser', RELICS.teaser), grid(card, roomId),
        ...sendPart(card, roomId)])
      return
    }
    const hint = actions.setActiveRelic ? [el('p', 'ac-game-card-line ac-muted', RELICS.hint)] : []
    replaceKeepingFocus(body, [...activePart(card, roomId), grid(card, roomId), ...hint, ...sendPart(card, roomId)])
  }

  return {
    element,
    /**
     * @param {{ game: object, roomId: string, state?: object }} next `state` lists the rooms a
     *   relic can be sent to
     */
    update(next) {
      current = next
      draw()
    }
  }
}

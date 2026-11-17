// The Relics card of the Arsenal's Items section: the room's active relic large in its frame with
// its name, buff and flavour line, then every relic the room owns as a slot (a single click makes
// one active), empty slots saying how relics are found, and a short teaser while it owns none.
// Under them, a relic that is not active can be sent to another room of the world. On a page
// that cannot play (view only) the slots are pictures, not buttons, and nothing can be sent.
import { el } from './dom.js'
import { replaceKeepingFocus } from './game-controls.js'
import { framedPicture } from './legendary-art.js'
import { RELICS } from './legendary-labels.js'
import { relicsCard } from './legendary-model.js'
import { SEND } from './send-labels.js'
import { sendTargets, sendableRelics } from './send-model.js'
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

  function activePart(card) {
    if (!card.active) return [el('p', 'ac-game-card-line', RELICS.noneActive)]
    const { active } = card
    const part = el('div', 'ac-legendary-active')
    const words = el('div', 'ac-legendary-active-words')
    words.append(
      el('span', 'ac-legendary-kicker', RELICS.active),
      el('h3', 'ac-legendary-name', active.name),
      el('p', 'ac-legendary-buff', active.text),
      el('p', 'ac-legendary-flavour', active.flavour)
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

  /** "Send a relic: [relic] to [room] Send", when a relic can go and the world has another room. */
  function sendPart(card, roomId) {
    if (!actions.sendRelic || !current.state) return []
    const targets = sendTargets(current.state, roomId)
    const relics = sendableRelics(current.game, roomId)
      .map((id) => card.owned.find((relic) => relic.id === id))
      .filter(Boolean)
    if (targets.length === 0 || relics.length === 0) return []
    return [sendControl({
      key: 'send:relic',
      prefix: SEND.relic,
      pickers: [
        { label: SEND.relicPicker, key: 'send:relic-which', options: relics.map((relic) => [relic.id, relic.name]) },
        { label: SEND.relicRoomLabel, key: 'send:relic-room', options: targets.map((room) => [room.id, room.name]) }
      ],
      buttonLabel: SEND.send,
      ariaLabel: SEND.sendRelic,
      onSend: async ([relicId, toRoomId]) => {
        const went = await actions.sendRelic(roomId, toRoomId, relicId)
        if (!went) return
        const relic = relics.find((entry) => entry.id === relicId)
        const target = targets.find((room) => room.id === toRoomId)
        status.textContent = SEND.relicSent(relic?.name ?? relicId, target?.name ?? toRoomId)
      }
    })]
  }

  function draw() {
    if (!current) return
    const { game, roomId } = current
    const card = relicsCard(game, roomId)
    element.hidden = !card
    if (!card) return
    const targets = current.state && actions.sendRelic ? sendTargets(current.state, roomId) : []
    const signature = JSON.stringify([roomId, card, pendingId, Boolean(actions.setActiveRelic), targets])
    if (signature === drawn) return
    if (drawn && JSON.parse(drawn)[0] !== roomId) status.textContent = ''
    drawn = signature
    count.textContent = RELICS.owned(card.count, card.total)
    if (card.count === 0) {
      replaceKeepingFocus(body, [el('p', 'ac-game-card-line ac-legendary-teaser', RELICS.teaser), grid(card, roomId)])
      return
    }
    const hint = actions.setActiveRelic ? [el('p', 'ac-game-card-line ac-muted', RELICS.hint)] : []
    replaceKeepingFocus(body, [...activePart(card), grid(card, roomId), ...hint, ...sendPart(card, roomId)])
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

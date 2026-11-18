// How traits are drawn: a trait as a badge in its tier's colour with its effect on hover and focus,
// a character's trait slots in the Party tab (a free slot teaches a scroll, a trait can be swapped
// for one), the agent card's list, and the Chest tab's Trait scrolls card with its send control.
import { button, el } from './dom.js'
import { replaceKeepingFocus } from './game-controls.js'
import { worldById } from './game-model.js'
import { sendTargets } from './send-model.js'
import { sendControl } from './send-view.js'
import { SCROLLS, TRAITS, traitEffectText, traitSummary } from './trait-labels.js'
import { collection, roomScrolls, scrollChoices, swapCost, traitEntries, traitSlotsOf } from './trait-model.js'

/** The tooltip of a trait: tier, what it does and its flavour line. Hidden from screen readers, who get the label. */
function tooltip(entry, isBorn) {
  const tip = el('span', 'ac-trait-tip')
  tip.setAttribute('aria-hidden', 'true')
  const kicker = [entry.tierName, entry.drawback ? TRAITS.doubleEdged : null, isBorn ? TRAITS.born : null].filter(Boolean).join(' · ')
  tip.append(el('span', 'ac-trait-tip-tier', kicker), el('span', 'ac-trait-tip-text', traitEffectText(entry)),
    el('span', 'ac-trait-tip-flavour', entry.flavour))
  return tip
}

/**
 * A trait as a badge: its tier's gem and its name, with its effect shown on hover and focus. A
 * button when it does something, otherwise a focusable mark.
 *
 * @param {object} entry a trait of `traitEntries`
 * @param {{ isBorn?: boolean, onClick?: () => void, key?: string, label?: string, expanded?: boolean,
 *   className?: string }} [options]
 */
export function traitBadge(entry, { isBorn = false, onClick, key, label, expanded, className = '' } = {}) {
  const node = onClick ? button('', `ac-trait-badge ${className}`.trim(), { onClick }) : el('span', `ac-trait-badge ${className}`.trim())
  if (!onClick) {
    node.tabIndex = 0
    node.setAttribute('role', 'note')
  }
  node.dataset.tier = entry.tier
  if (entry.colour) node.style.setProperty('--ac-trait-colour', entry.colour)
  if (key) node.dataset.key = key
  if (expanded !== undefined) node.setAttribute('aria-expanded', String(expanded))
  node.setAttribute('aria-label', label ?? traitSummary(entry, entry.tierName))
  const gem = el('span', 'ac-trait-gem')
  gem.setAttribute('aria-hidden', 'true')
  node.append(gem, el('span', 'ac-trait-name', entry.name), tooltip(entry, isBorn))
  return node
}

/** The agent card's traits: a row of badges, or nothing. */
export function traitRow(traits) {
  if (!traits?.length) return []
  const list = el('div', 'ac-trait-row ac-detail-traits')
  list.setAttribute('aria-label', TRAITS.title)
  list.append(...traits.map((entry) => traitBadge(entry, { className: 'ac-trait-badge-small' })))
  return [list]
}

/** One choice of a picker: the scroll's badge and the button that takes it. */
function choiceRow(scroll, { label, ariaLabel, key, disabled, onChoose }) {
  const row = el('li', 'ac-trait-choice')
  const take = button(label, 'ac-button', { onClick: onChoose })
  take.dataset.key = key
  take.setAttribute('aria-label', ariaLabel)
  take.disabled = disabled
  const count = el('span', 'ac-muted ac-trait-count', SCROLLS.count(scroll.count))
  row.append(traitBadge(scroll.entry), count, el('span', 'ac-trait-choice-text', traitEffectText(scroll.entry)), take)
  return row
}

/**
 * A character's trait slots in its Party card. A free slot opens the scrolls it can be taught; a
 * trait opens the scrolls it can be swapped for, with the fee. One picker is open at a time.
 *
 * @param {{ getRoomId: () => string, sessionId: string, name: string,
 *   actions: Record<string, (...args: unknown[]) => Promise<boolean>> }} options
 */
export function createTraitSlots({ getRoomId, sessionId, name, actions }) {
  const element = el('div', 'ac-trait-slots')
  const head = el('div', 'ac-trait-head')
  const slots = el('div', 'ac-trait-row')
  slots.setAttribute('role', 'group')
  slots.setAttribute('aria-label', TRAITS.slotsLabel(name))
  const picker = el('div', 'ac-trait-picker')
  const status = el('p', 'ac-game-card-line ac-trait-status')
  status.setAttribute('role', 'status')
  head.append(el('span', 'ac-game-field-label', TRAITS.title))
  element.append(head, slots, picker, status)
  element.hidden = true
  /** The open slot: its index among the slots, or null. */
  let open = null
  let drawn = null
  let current = null

  const toggle = (index) => {
    open = open === index ? null : index
    drawn = null
    draw()
    // An open picker gives the keyboard to its first choice (or Close); a closed one to its slot.
    if (open !== null) element.querySelector('.ac-trait-picker-box button')?.focus()
    else element.querySelector(`[data-key="${CSS.escape(`trait:${sessionId}:${index}`)}"]`)?.focus()
  }

  async function act(input, said) {
    const went = await actions.traitAction({ ...input, roomId: getRoomId(), sessionId })
    if (!went) return
    const closed = open
    open = null
    status.textContent = said
    drawn = null
    draw()
    element.querySelector(`[data-key="${CSS.escape(`trait:${sessionId}:${closed}`)}"]`)?.focus()
  }

  function pickerFor(slot, index) {
    const node = el('div', 'ac-trait-picker-box')
    node.setAttribute('role', 'group')
    const close = button(TRAITS.close, 'ac-button ac-trait-close', { onClick: () => toggle(index) })
    close.dataset.key = `trait:${sessionId}:close`
    const choices = scrollChoices(current.character, current.scrolls)
    const list = el('ul', 'ac-trait-choices')
    let line
    if (slot.kind === 'free') {
      node.setAttribute('aria-label', TRAITS.teachTitle(name))
      line = TRAITS.teachTitle(name)
      list.append(...choices.map((scroll) => choiceRow(scroll, {
        label: TRAITS.teach(scroll.entry.name),
        ariaLabel: TRAITS.teachLabel(scroll.entry.name, traitEffectText(scroll.entry)),
        key: `trait:${sessionId}:teach:${scroll.entry.id}`,
        disabled: false,
        onChoose: () => act({ action: 'teach', traitId: scroll.entry.id }, TRAITS.taught(name, scroll.entry.name))
      })))
    } else {
      const { fee, canPay } = swapCost(current.world, slot.entry)
      node.setAttribute('aria-label', TRAITS.swapTitle(slot.entry.name, fee))
      line = TRAITS.swapTitle(slot.entry.name, fee)
      list.append(...choices.map((scroll) => choiceRow(scroll, {
        label: TRAITS.swap(scroll.entry.name),
        ariaLabel: TRAITS.swapLabel(slot.entry.name, scroll.entry.name, traitEffectText(scroll.entry), fee),
        key: `trait:${sessionId}:swap:${scroll.entry.id}`,
        disabled: !canPay,
        onChoose: () => act({ action: 'swap', oldTraitId: slot.entry.id, traitId: scroll.entry.id },
          TRAITS.swapped(name, scroll.entry.name, slot.entry.name))
      })))
      if (!canPay && choices.length) node.append(el('p', 'ac-game-card-line ac-muted', TRAITS.cannotPay(fee)))
    }
    const empty = current.scrolls.length === 0 ? TRAITS.noScrolls : choices.length === 0 ? TRAITS.noNewScrolls : null
    node.prepend(el('p', 'ac-game-card-line', line))
    node.append(empty ? el('p', 'ac-game-card-line ac-muted', empty) : list, close)
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') toggle(index)
    })
    return node
  }

  function slotNode(slot, index) {
    const key = `trait:${sessionId}:${index}`
    const canChange = current.canChoose
    if (slot.kind === 'trait') {
      const summary = traitSummary(slot.entry, slot.entry.tierName)
      return traitBadge(slot.entry, {
        isBorn: slot.isBorn,
        key,
        label: TRAITS.badgeLabel(summary, canChange),
        expanded: canChange ? open === index : undefined,
        onClick: canChange ? () => toggle(index) : undefined
      })
    }
    if (slot.kind === 'free') {
      if (!canChange) return el('span', 'ac-trait-slot-free', TRAITS.freeSlot)
      const node = button(`+ ${TRAITS.freeSlot}`, 'ac-trait-slot-free', { onClick: () => toggle(index) })
      node.dataset.key = key
      node.setAttribute('aria-expanded', String(open === index))
      node.setAttribute('aria-label', TRAITS.freeSlotLabel(name))
      return node
    }
    const locked = el('span', 'ac-trait-slot-locked', TRAITS.lockedSlot(slot.level))
    locked.title = TRAITS.lockedSlotLabel(slot.level)
    locked.setAttribute('aria-label', TRAITS.lockedSlotLabel(slot.level))
    locked.setAttribute('role', 'note')
    return locked
  }

  function draw() {
    if (!current) return
    const all = traitSlotsOf(current.character, current.entries, current.slotLevels)
    element.hidden = all.length === 0
    if (open !== null && (!all[open] || all[open].kind === 'locked' || !current.canChoose)) open = null
    const scrolls = current.scrolls.map((scroll) => [scroll.entry.id, scroll.count])
    const signature = JSON.stringify([getRoomId(), current.character.traits, scrolls, open, current.canChoose,
      current.world?.coins ?? 0, current.world?.traits?.swapFees ?? null])
    if (signature === drawn) return
    drawn = signature
    replaceKeepingFocus(slots, all.map(slotNode))
    replaceKeepingFocus(picker, open === null ? [] : [pickerFor(all[open], open)])
  }

  return {
    element,
    /**
     * @param {{ state: object, character: object, canChoose: boolean }} next `canChoose` is false on a
     *   page that only watches
     */
    update({ state, character, canChoose }) {
      const game = state.game
      const roomId = getRoomId()
      const entries = traitEntries(game)
      const world = worldById(game, game?.rooms?.[roomId]?.worldId) ?? null
      current = {
        character,
        entries,
        world,
        canChoose: canChoose && typeof actions.traitAction === 'function',
        scrolls: roomScrolls(game, roomId, entries),
        slotLevels: game?.traits?.slotLevels ?? []
      }
      draw()
    }
  }
}

/**
 * The Chest tab's Trait scrolls card: the room's scrolls with their count, the world's collection,
 * and the control that sends a scroll to another room of the world.
 *
 * @param {{ actions: Record<string, (...args: unknown[]) => Promise<boolean>> }} options
 */
export function createScrollsCard({ actions }) {
  const element = el('section', 'ac-game-card ac-trait-scrolls')
  const head = el('div', 'ac-trait-scrolls-head')
  const count = el('span', 'ac-muted')
  head.append(el('h2', 'ac-game-card-title', SCROLLS.title), count)
  const body = el('div', 'ac-trait-scrolls-body')
  const status = el('p', 'ac-game-card-line ac-trait-status')
  status.setAttribute('role', 'status')
  element.append(head, body, status)
  element.hidden = true
  let drawn = null

  function sendPart(state, roomId, scrolls) {
    if (typeof actions.traitAction !== 'function' || state.game?.viewOnly === true) {
      return [el('p', 'ac-game-card-line ac-muted', TRAITS.viewOnly)]
    }
    const targets = sendTargets(state, roomId)
    return [sendControl({
      key: 'send:scroll',
      prefix: SCROLLS.send,
      pickers: [
        { label: SCROLLS.scrollPicker, key: 'send:scroll-which', emptyLabel: SCROLLS.noScrollPick,
          options: scrolls.map((scroll) => ({ value: scroll.entry.id, label: `${scroll.entry.name} ${SCROLLS.count(scroll.count)}` })) },
        { label: SCROLLS.roomPicker, key: 'send:scroll-room', emptyLabel: SCROLLS.noRoomPick,
          options: targets.map((room) => ({ value: room.id, label: room.name })) }
      ],
      buttonLabel: SCROLLS.sendButton,
      ariaLabel: SCROLLS.sendLabel,
      reason: targets.length ? null : SCROLLS.noRoom,
      onSend: async ([traitId, toRoomId]) => {
        const went = await actions.traitAction({ action: 'send', roomId, toRoomId, traitId })
        if (!went) return
        const scroll = scrolls.find((entry) => entry.entry.id === traitId)
        status.textContent = SCROLLS.sent(scroll?.entry.name ?? traitId, targets.find((room) => room.id === toRoomId)?.name ?? toRoomId)
      }
    })]
  }

  return {
    element,
    /** @param {{ state: object, roomId: string, world: object | null }} next */
    update({ state, roomId, world }) {
      const game = state.game
      const entries = traitEntries(game)
      element.hidden = entries.size === 0
      if (entries.size === 0) return
      const scrolls = roomScrolls(game, roomId, entries)
      const targets = sendTargets(state, roomId)
      const progress = collection(world, game)
      const signature = JSON.stringify([roomId, scrolls.map((scroll) => [scroll.entry.id, scroll.count]), targets, progress,
        Boolean(actions.traitAction), game?.viewOnly === true])
      if (signature === drawn) return
      if (drawn && JSON.parse(drawn)[0] !== roomId) status.textContent = ''
      drawn = signature
      count.textContent = progress ? TRAITS.collection(progress.known, progress.total) : ''
      if (scrolls.length === 0) {
        replaceKeepingFocus(body, [el('p', 'ac-game-card-line ac-muted', SCROLLS.none)])
        return
      }
      const list = el('ul', 'ac-trait-scroll-list')
      for (const scroll of scrolls) {
        const item = el('li', 'ac-trait-scroll')
        const summary = traitSummary(scroll.entry, scroll.entry.tierName)
        item.append(traitBadge(scroll.entry, { label: SCROLLS.scrollLabel(summary, scroll.count) }),
          el('span', 'ac-muted ac-trait-count', SCROLLS.count(scroll.count)),
          el('span', 'ac-trait-choice-text', traitEffectText(scroll.entry)))
        list.append(item)
      }
      replaceKeepingFocus(body, [list, el('p', 'ac-game-card-line ac-muted', SCROLLS.hint), ...sendPart(state, roomId, scrolls)])
    }
  }
}

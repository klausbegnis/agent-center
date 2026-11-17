// A character's three equipment slots on the Party tab, and the picker one of them opens in place
// under them: Auto, Nothing, then the room's chest items that fit, best first, each with what it
// changes and whether it is free, a swap or refused. One picker is open at a time in the whole
// tab; it stays open, with the keyboard where it was, across redraws. A page that cannot choose
// shows the slots only.
import { button, el } from './dom.js'
import { replaceKeepingFocus } from './game-controls.js'
import { EQUIP, choiceLabel, pickerTitle, powerChange, slotButtonLabel, takeText } from './equip-labels.js'
import { AUTO_CHOICE, EQUIP_SLOTS, isPinned, optionAfter, slotChoices, weaponTypeOf } from './equip-model.js'
import { itemSlot } from './item-slot-view.js'
import { ARSENAL, equipmentSlotLabel } from './labels.js'

/**
 * @param {{ roomId: () => string, sessionId: string, name: string,
 *   actions: Record<string, (...args: unknown[]) => Promise<boolean>>,
 *   open: { key: string | null, set: (key: string | null) => void } }} options `open` is shared
 *   by every character's slots, so opening one picker closes the other
 */
export function createEquipSlots({ roomId, sessionId, name, actions, open }) {
  const element = el('div', 'ac-game-equip')
  const list = el('ul', 'ac-game-slots')
  list.setAttribute('aria-label', ARSENAL.equipment)
  const picker = el('div', 'ac-game-equip-picker')
  picker.setAttribute('role', 'group')
  picker.id = `ac-game-equip-${sessionId.replace(/[^\w-]/g, '_')}`
  element.append(list, picker)
  let last = null
  let drawn = null

  const keyOf = (slot) => `equip:${sessionId}:${slot}`
  const slotButton = (slot) => list.querySelector(`[data-key="${CSS.escape(keyOf(slot))}"]`)

  function close(slot) {
    open.set(null)
    slotButton(slot)?.focus()
  }

  async function choose(slot, itemId) {
    const isDone = await actions.setEquipment(roomId(), sessionId, slot, itemId)
    if (isDone) close(slot)
  }

  function option({ key, label, ariaLabel, hint, isPressed = false, disabled = false, onPick, item, slot }) {
    const node = button('', 'ac-game-equip-option', { onClick: onPick })
    node.dataset.key = key
    node.setAttribute('aria-pressed', String(isPressed))
    node.setAttribute('aria-label', ariaLabel ?? label)
    node.disabled = disabled
    if (item) node.append(itemSlot({ item, slot, damageType: item.damageType, label: item.name, isSmall: true }))
    const text = el('span', 'ac-game-equip-option-text')
    text.append(el('span', 'ac-game-equip-option-name', label))
    if (hint) text.append(el('span', 'ac-game-equip-option-hint', hint))
    node.append(text)
    return node
  }

  function pickerContent(slot, { state, room, character }) {
    const choices = slotChoices({ state, roomId: roomId(), room, character, slot })
    const options = [
      option({ key: `${keyOf(slot)}:auto`, label: EQUIP.auto, hint: EQUIP.autoHint,
        isPressed: !isPinned(character, slot), onPick: () => choose(slot, AUTO_CHOICE) }),
      option({ key: `${keyOf(slot)}:none`, label: EQUIP.nothing, hint: EQUIP.nothingHint,
        isPressed: isPinned(character, slot) && !character.equipment?.[slot],
        onPick: () => choose(slot, null) }),
      ...choices.map((choice) => option({
        key: `${keyOf(slot)}:${choice.item.id}`,
        label: `${choice.item.name} · ${powerChange(choice.change)}`,
        ariaLabel: choiceLabel(choice),
        hint: takeText(choice),
        isPressed: choice.isCurrent,
        disabled: choice.take === 'refused',
        item: choice.item,
        slot,
        onPick: () => choose(slot, choice.item.id)
      }))
    ]
    const head = el('div', 'ac-game-equip-head')
    head.append(el('strong', '', pickerTitle(slot, name)),
      button(EQUIP.close, 'ac-button', { onClick: () => close(slot) }))
    head.lastChild.dataset.key = `${keyOf(slot)}:close`
    const optionList = el('div', 'ac-game-equip-options')
    optionList.append(...options)
    if (choices.length === 0) optionList.append(el('p', 'ac-game-card-line', EQUIP.noChoices))
    optionList.addEventListener('keydown', (event) => {
      const buttons = [...optionList.querySelectorAll('button:not(:disabled)')]
      const next = optionAfter(buttons.indexOf(event.target), event.key, buttons.length)
      if (next === null) return
      event.preventDefault()
      buttons[next].focus()
    })
    picker.setAttribute('aria-label', pickerTitle(slot, name))
    return [head, optionList]
  }

  picker.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !last) return
    event.preventDefault()
    close(last.openSlot)
  })

  function draw() {
    const { state, room, character, canChoose } = last
    const openSlot = open.key?.startsWith(`${sessionId}|`) ? open.key.slice(sessionId.length + 1) : null
    last.openSlot = openSlot
    const signature = JSON.stringify([character.equipment, character.pinned, character.class, room.chest, canChoose,
      openSlot])
    if (signature === drawn) return
    drawn = signature
    const rows = EQUIP_SLOTS.map((slot) => {
      const item = character.equipment?.[slot] ?? null
      const row = el('li', 'ac-game-slot')
      const box = itemSlot({
        item,
        slot,
        damageType: slot === 'weapon' ? weaponTypeOf(character.class) : null,
        label: canChoose ? slotButtonLabel(slot, item, isPinned(character, slot)) : equipmentSlotLabel(slot, item),
        isSmall: true,
        isButton: canChoose
      })
      if (canChoose) {
        box.dataset.key = keyOf(slot)
        box.setAttribute('aria-expanded', String(openSlot === slot))
        box.setAttribute('aria-controls', picker.id)
        box.addEventListener('click', () => open.set(openSlot === slot ? null : `${sessionId}|${slot}`))
        if (isPinned(character, slot)) box.classList.add('ac-game-slotbox-pinned')
      }
      const text = item
        ? el('span', 'ac-game-slot-text', item.name)
        : el('span', 'ac-game-slot-text ac-muted', ARSENAL.emptySlot)
      text.setAttribute('aria-hidden', 'true')
      row.append(box, text)
      return row
    })
    replaceKeepingFocus(list, rows)
    picker.hidden = !openSlot
    if (openSlot) replaceKeepingFocus(picker, pickerContent(openSlot, last))
    else picker.replaceChildren()
  }

  return {
    element,
    /**
     * @param {{ state: object, room: object, character: object, canChoose: boolean }} next
     *   `canChoose` is false on a page that cannot play: the slots are shown, not buttons
     */
    update(next) {
      last = { ...next, openSlot: null }
      draw()
    },
    /** Opens or closes this character's picker after another one was opened somewhere. */
    redraw() {
      if (last) draw()
    },
    /** Moves the keyboard into the open picker, on the item equipped now or its first choice. */
    focusPicker() {
      const target = picker.querySelector('button[aria-pressed="true"]:not(:disabled)') ??
        picker.querySelector('.ac-game-equip-options button:not(:disabled)')
      target?.focus()
    }
  }
}

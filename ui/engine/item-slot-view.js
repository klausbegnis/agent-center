// One item in a square slot, as the chest and a character's equipment both draw it: the slot's
// pixel icon turned to the item's own ink, the tier as the frame's colour and in a corner, the
// upgrade level as a "+N" badge, a mark when a character holds it and one when it can be upgraded.
import { itemHueTurn, tierStep } from './arsenal-model.js'
import { el } from './dom.js'
import { slotIconId } from './game-icons.js'
import { gameIcon } from './icon-view.js'
import { legendaryPicture } from './legendary-art.js'
import { levelPlus, tierShort } from './labels.js'

/**
 * @param {{
 *   item: { id: string, name: string, tier: number, level: number } | null,
 *   slot: string,
 *   damageType?: string | null,
 *   label: string,
 *   isHeld?: boolean,
 *   canUpgrade?: boolean,
 *   isButton?: boolean,
 *   isSmall?: boolean,
 *   base?: string
 * }} options `label` is what a screen reader hears and the tooltip shows; with `base`, a legendary
 *   item shows its own picture in a gold frame instead of the slot's icon
 * @returns {HTMLElement}
 */
export function itemSlot({ item, slot, damageType, label, isHeld, canUpgrade, isButton, isSmall, base }) {
  const node = el(isButton ? 'button' : 'span', `ac-game-slotbox${isSmall ? ' ac-game-slotbox-small' : ''}`)
  if (isButton) node.type = 'button'
  else node.setAttribute('role', 'img')
  node.setAttribute('aria-label', label)
  node.title = label
  if (!item) {
    node.classList.add('ac-game-slotbox-empty')
    node.append(gameIcon(slotIconId(slot, damageType ?? undefined), 'ac-game-slotbox-icon'))
    return node
  }
  node.dataset.tier = String(tierStep(item.tier))
  node.style.setProperty('--ac-item-turn', `${itemHueTurn(item.id)}deg`)
  if (item.legendary && base !== undefined) {
    node.classList.add('ac-game-slotbox-legendary')
    node.append(legendaryPicture(base, item.entryId, { glow: true, className: 'ac-game-slotbox-art' }))
  } else {
    node.append(gameIcon(slotIconId(slot, damageType ?? undefined), 'ac-game-slotbox-icon'))
  }
  const marks = [
    el('span', 'ac-game-slotbox-tier', tierShort(item.tier)),
    el('span', 'ac-game-slotbox-level', levelPlus(item.level))
  ]
  if (isHeld) marks.push(el('span', 'ac-game-slotbox-held', '●'))
  if (canUpgrade) {
    node.classList.add('ac-game-slotbox-ready')
    marks.push(el('span', 'ac-game-slotbox-ready-mark', '▲'))
  }
  for (const mark of marks) mark.setAttribute('aria-hidden', 'true')
  node.append(...marks)
  return node
}

/** A chest slot with nothing in it, drawn so the chest reads as a container with room left. */
export function emptyChestSlot() {
  const node = el('span', 'ac-game-slotbox ac-game-slotbox-free')
  node.setAttribute('aria-hidden', 'true')
  return node
}

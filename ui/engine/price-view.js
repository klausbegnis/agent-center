// A price as the Arsenal draws it, material icons and amounts with the missing ones marked, and
// the button that pays it, off and saying why while the world cannot pay.
import { button, el } from './dom.js'
import { costEntries, formatAmount, missingMaterials } from './game-format.js'
import { gameIcon } from './icon-view.js'
import { ARSENAL, materialLabel, missingText } from './labels.js'

/**
 * A price as material icons and amounts; each material it is short of says how much is missing,
 * in words and with a mark, not by colour alone.
 *
 * @param {Record<string, number> | null | undefined} cost
 * @param {Record<string, number>} materials what the world has
 */
export function priceList(cost, materials) {
  const missing = new Map(missingMaterials(cost, materials).map(({ id, amount }) => [id, amount]))
  const list = el('ul', 'ac-game-price')
  list.setAttribute('aria-label', ARSENAL.cost)
  for (const { id, amount } of costEntries(cost)) {
    const entry = el('li', 'ac-game-price-entry')
    entry.title = materialLabel(id)
    entry.append(
      gameIcon(id),
      el('span', 'ac-game-amount', formatAmount(amount)),
      el('span', 'ac-visually-hidden', ` ${materialLabel(id)}`)
    )
    if (missing.has(id)) {
      entry.classList.add('ac-game-price-short')
      const mark = el('span', 'ac-game-missing-mark', '!')
      mark.setAttribute('aria-hidden', 'true')
      entry.append(mark, el('span', 'ac-game-missing', ARSENAL.short(formatAmount(missing.get(id)))))
    }
    list.append(entry)
  }
  return list
}

/**
 * The price of a purchase and its button; the button is off and says why while it cannot be paid.
 *
 * @param {{ cost: Record<string, number>, affordable: boolean, materials: Record<string, number>,
 *   label: string, ariaLabel: string, key: string, onBuy?: () => unknown }} options `key` names
 *   the button for replaceKeepingFocus
 */
export function purchase({ cost, affordable, materials, label, ariaLabel, key, onBuy }) {
  const node = el('div', 'ac-game-buy')
  node.append(el('span', 'ac-game-cost', ARSENAL.cost), priceList(cost, materials))
  if (!onBuy) return node
  const action = button(label, 'ac-button ac-game-buy-button', { onClick: onBuy })
  action.dataset.key = key
  action.setAttribute('aria-label', ariaLabel)
  const missing = missingMaterials(cost, materials)
  if (!affordable && missing.length) {
    action.disabled = true
    const reason = el('span', 'ac-visually-hidden', missingText(missing, formatAmount))
    reason.id = `ac-game-missing-${key.replace(/[^a-z0-9-]/gi, '-')}`
    action.setAttribute('aria-describedby', reason.id)
    node.append(reason)
  }
  node.append(action)
  return node
}

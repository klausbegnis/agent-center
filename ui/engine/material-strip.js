// The world's materials as one tight strip of icon and amount tiles, above every Arsenal section
// as the context for its prices. A tile's name shows on hover and while the strip has the focus;
// a material that a price on screen is short of is marked with a sign as well as a colour.
import { el } from './dom.js'
import { formatAmount } from './game-format.js'
import { iconColor } from './game-icons.js'
import { gameIcon } from './icon-view.js'
import { ARSENAL, MATERIAL_LABEL, materialLabel, materialTileLabel } from './labels.js'

export function createMaterialStrip() {
  const element = el('ul', 'ac-game-strip')
  // One stop in the tab order for the whole strip; focusing it writes every name out.
  element.tabIndex = 0
  let drawn = null

  function tile(id, amount, short) {
    const amountText = formatAmount(amount)
    const node = el('li', 'ac-game-strip-tile')
    node.style.setProperty('--ac-tile-color', iconColor(id))
    const shortText = short ? { prices: short.prices, mostText: formatAmount(short.most) } : null
    node.title = materialTileLabel(id, amountText, shortText)
    const spoken = el('span', 'ac-visually-hidden', materialTileLabel(id, amountText, shortText))
    const shown = el('span', 'ac-game-strip-shown')
    shown.setAttribute('aria-hidden', 'true')
    shown.append(gameIcon(id, 'ac-game-strip-icon'), el('span', 'ac-game-amount', amountText))
    if (short) {
      node.classList.add('ac-game-strip-short')
      shown.append(el('span', 'ac-game-strip-mark', '!'))
    }
    node.append(spoken, shown, el('span', 'ac-game-strip-name', materialLabel(id)))
    node.lastChild.setAttribute('aria-hidden', 'true')
    return node
  }

  return {
    element,
    /**
     * @param {{ id: string, level: number, materials: Record<string, number> }} world
     * @param {Map<string, { prices: number, most: number }>} short what the prices on screen lack
     */
    update(world, short) {
      const signature = JSON.stringify([world.id, world.level, world.materials, [...short]])
      if (signature === drawn) return
      drawn = signature
      element.setAttribute('aria-label', ARSENAL.materials(world.id, world.level))
      element.replaceChildren(
        ...Object.keys(MATERIAL_LABEL).map((id) => tile(id, world.materials?.[id], short.get(id) ?? null))
      )
    }
  }
}

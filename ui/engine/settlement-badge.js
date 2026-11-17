// The settlement's badge above the game's tabs: the stage's picture, small, and its name. It sits
// in the row of room chips on every tab, so the tabs under it never move, and opens the Camp tab.
import { el } from './dom.js'
import { SETTLEMENT } from './settlement-labels.js'
import { badgeModel, settlementArtUrl } from './settlement-model.js'

/** @param {{ onOpen?: () => void, base: string }} options */
export function createSettlementBadge({ onOpen, base }) {
  const element = el('button', 'ac-settlement-badge')
  element.type = 'button'
  element.dataset.key = 'settlement-badge'
  const image = el('img', 'ac-settlement-badge-art')
  image.alt = ''
  image.setAttribute('aria-hidden', 'true')
  image.width = 28
  image.height = 14
  image.decoding = 'async'
  const name = el('span', 'ac-settlement-badge-name')
  name.setAttribute('aria-hidden', 'true')
  element.append(image, name)
  if (onOpen) element.addEventListener('click', onOpen)
  else element.disabled = true
  element.hidden = true
  let drawn = null

  return {
    element,
    /** @param {object | null} world */
    update(world) {
      const model = badgeModel(world)
      element.hidden = !model
      if (!model) return
      const signature = JSON.stringify(model)
      if (signature === drawn) return
      drawn = signature
      image.src = settlementArtUrl(base, model.art)
      name.textContent = model.stars ? `${model.name} ${SETTLEMENT.starsShort(model.stars)}` : model.name
      element.setAttribute('aria-label', model.label)
      element.title = model.label
    }
  }
}

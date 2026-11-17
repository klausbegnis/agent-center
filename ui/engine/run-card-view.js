// A run's card: the six rooms as a row of icons (cleared ones checked, the current one marked, the
// ones ahead dim), the route's picture for instances that have one, the progress, tries and time
// left, the boon and the tier's modifier, the vault's two boons with a Choose button each, and
// "Recall the party", which asks first. Made once and updated, so focus and an open question stay.
import { button, el } from './dom.js'
import { confirmButton, meter, replaceKeepingFocus } from './game-controls.js'
import { INSTANCES } from './instance-labels.js'

/** Room icons are 16×16 pixel art, drawn at twice that. */
const ICON_SIZE = 32

/** A pixel picture, decoration unless it has alt text. */
function picture(src, className, { alt = '', width, height } = {}) {
  const image = el('img', className)
  image.src = src
  image.alt = alt
  if (width) image.width = width
  if (height) image.height = height
  image.decoding = 'async'
  image.draggable = false
  if (!alt) image.setAttribute('aria-hidden', 'true')
  return image
}

/**
 * @param {{ actions: Record<string, (...args: unknown[]) => Promise<unknown>> }} options
 */
export function createRunCard({ actions }) {
  const element = el('div', 'ac-run-card')
  const title = el('h3', 'ac-run-title')
  const roomLine = el('p', 'ac-game-card-line ac-run-room')
  const icons = el('ol', 'ac-run-icons')
  icons.setAttribute('aria-label', INSTANCES.roomsName)
  const route = picture('', 'ac-run-route', { width: 256, height: 64 })
  const progress = meter('ac-run-progress', INSTANCES.progress)
  const time = meter('ac-run-time', INSTANCES.time)
  const tries = el('p', 'ac-game-card-line ac-run-tries')
  const boon = el('p', 'ac-game-card-line ac-run-boon')
  const modifier = el('p', 'ac-game-card-line ac-run-modifier')
  const worked = el('p', 'ac-game-card-line ac-muted ac-run-worked')
  const vault = el('div', 'ac-run-vault')
  const recall = el('div', 'ac-run-recall')
  element.append(title, roomLine, route, icons, progress.element, time.element, tries, boon, modifier, worked, vault, recall)
  let iconsDrawn = ''
  let vaultDrawn = ''
  let recallDrawn = ''
  let recallOpen = false

  function drawIcons(model) {
    const signature = JSON.stringify(model.icons.map((icon) => icon.stage))
    if (signature === iconsDrawn) return
    iconsDrawn = signature
    icons.replaceChildren(...model.icons.map((icon) => {
      const item = el('li', `ac-run-icon ac-run-icon-${icon.stage}`)
      item.setAttribute('aria-label', icon.label)
      item.title = icon.label
      item.append(picture(icon.icon, 'ac-run-icon-art', { width: ICON_SIZE, height: ICON_SIZE }))
      if (icon.overlay) item.append(picture(icon.overlay, 'ac-run-icon-overlay', { width: ICON_SIZE / 2, height: ICON_SIZE / 2 }))
      if (icon.stage === 'current') item.setAttribute('aria-current', 'step')
      return item
    }))
  }

  function drawVault(model) {
    const offered = actions.chooseBoon ? model.offered : null
    const signature = JSON.stringify([model.roomId, offered?.map((boon) => boon.id) ?? null])
    if (signature !== vaultDrawn) {
      vaultDrawn = signature
      const rows = (offered ?? []).map((boon) => {
        const row = el('div', 'ac-run-boon-choice')
        const words = el('div', 'ac-run-boon-words')
        words.append(el('strong', '', boon.name), el('span', 'ac-muted', boon.text))
        const choose = button(INSTANCES.choose, 'ac-button ac-primary', { onClick: () => actions.chooseBoon(model.roomId, boon.id) })
        choose.dataset.key = boon.key
        choose.setAttribute('aria-label', INSTANCES.chooseLabel(boon.name))
        row.append(words, choose)
        return row
      })
      const parts = offered ? [el('h4', 'ac-run-vault-title', INSTANCES.vaultTitle), ...rows, el('p', 'ac-game-card-line ac-muted ac-run-vault-wait')] : []
      replaceKeepingFocus(vault, parts)
    }
    vault.hidden = !offered
    const wait = vault.querySelector('.ac-run-vault-wait')
    if (wait) wait.textContent = model.vaultWaitText
  }

  function drawRecall(model) {
    const signature = `${model.roomId}|${Boolean(actions.recallParty)}`
    if (signature === recallDrawn) return
    recallDrawn = signature
    recallOpen = false
    replaceKeepingFocus(recall, actions.recallParty ? [confirmButton({
      label: INSTANCES.recall,
      question: INSTANCES.recallQuestion,
      confirm: INSTANCES.recallConfirm,
      key: model.recallKey,
      isOpen: recallOpen,
      onOpenChange: (isOpen) => { recallOpen = isOpen },
      onConfirm: () => actions.recallParty(model.roomId)
    })] : [])
  }

  return {
    element,
    /** @param {ReturnType<typeof import('./instance-model.js').runCardModel>} model */
    update(model) {
      title.textContent = model.title
      roomLine.textContent = model.roomLine
      route.hidden = !model.route
      if (model.route && route.getAttribute('src') !== model.route.src) {
        route.src = model.route.src
        route.alt = model.route.alt
        route.removeAttribute('aria-hidden')
      }
      drawIcons(model)
      progress.set(model.progress, model.progressText)
      time.element.hidden = !model.hasTime
      time.set(model.timeShare, model.timeText)
      tries.textContent = model.triesText
      boon.textContent = model.boonText
      modifier.textContent = model.modifierText
      worked.textContent = `${model.workedText} · ${model.foundText}`
      drawVault(model)
      drawRecall(model)
    }
  }
}

// The Camp tab: the room's world's settlement. On top the stage's picture with its name, the bar to
// the next stage and the settlement's bonus; then a card per building with its sprite at its tier,
// what it does now and at the next level, its price and the Build button (and, from the tier that
// takes them, the price with coins); then the auto-spend switch. A new stage cross-fades the
// picture. Without a settlement in the view state it shows nothing but the switch.
import { button, el } from './dom.js'
import { replaceKeepingFocus, section, settingSwitch } from './game-controls.js'
import { formatAmount, missingMaterials } from './game-format.js'
import { gameIcon } from './icon-view.js'
import { ARSENAL, missingText } from './labels.js'
import { effectText } from './legendary-labels.js'
import { priceList, purchase } from './price-view.js'
import { SETTLEMENT } from './settlement-labels.js'
import { buildingModel, heroModel, settlementArtUrl } from './settlement-model.js'

/** The stage pictures' native size; drawn scaled up pixel for pixel. */
const HERO_WIDTH = 224
const HERO_HEIGHT = 112

/** A picture that says nothing its card does not: hidden from screen readers. */
function sprite(base, path, className) {
  const image = el('img', className)
  image.src = settlementArtUrl(base, path)
  image.alt = ''
  image.decoding = 'async'
  image.draggable = false
  image.setAttribute('aria-hidden', 'true')
  return image
}

/** The hero: the stage picture (a second one while a new stage fades in) and the name over it. */
function createHero(base) {
  const element = el('figure', 'ac-settlement-hero')
  const frame = el('div', 'ac-settlement-hero-frame')
  const caption = el('figcaption', 'ac-settlement-hero-caption')
  const name = el('span', 'ac-settlement-hero-name')
  const stage = el('span', 'ac-settlement-hero-stage')
  const stars = el('span', 'ac-settlement-hero-stars')
  caption.append(name, stage, stars)
  element.append(frame, caption)
  let shownArt = null

  function picture(model) {
    const image = el('img', 'ac-settlement-hero-image')
    image.src = settlementArtUrl(base, model.art)
    image.alt = model.alt
    image.width = HERO_WIDTH
    image.height = HERO_HEIGHT
    image.decoding = 'async'
    image.draggable = false
    return image
  }

  return {
    element,
    update(model) {
      name.textContent = model.name
      stage.textContent = model.stageText
      stars.textContent = model.stars ? SETTLEMENT.starsShort(model.stars) : ''
      stars.hidden = !model.stars
      stars.title = model.stars ? SETTLEMENT.stars(model.stars) : ''
      if (model.art === shownArt) {
        frame.lastChild.alt = model.alt
        return
      }
      const image = picture(model)
      // The first picture just appears; a new stage fades in over the old one, which then goes.
      if (shownArt !== null) {
        const old = [...frame.children]
        const settle = () => old.forEach((node) => node.remove())
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) settle()
        else {
          image.classList.add('ac-settlement-hero-arriving')
          image.addEventListener('animationend', settle, { once: true })
        }
      }
      frame.append(image)
      shownArt = model.art
    }
  }
}

/** The bar to the next stage, with its words under it. */
function createProgress() {
  const element = el('div', 'ac-settlement-progress')
  const track = el('div', 'ac-settlement-progress-track')
  const fill = el('div', 'ac-settlement-progress-fill')
  track.append(fill)
  track.setAttribute('role', 'progressbar')
  track.setAttribute('aria-label', SETTLEMENT.progressName)
  track.setAttribute('aria-valuemin', '0')
  track.setAttribute('aria-valuemax', '100')
  const text = el('p', 'ac-settlement-progress-text')
  text.setAttribute('aria-hidden', 'true')
  element.append(track, text)
  return {
    element,
    update(model) {
      const percent = Math.round(model.share * 100)
      fill.style.width = `${percent}%`
      track.setAttribute('aria-valuenow', String(percent))
      track.setAttribute('aria-valuetext', model.progressText)
      text.textContent = model.progressText
    }
  }
}

/** The coins of a price as one more entry of its list, marked when the world has too few. */
function coinEntry(coins, held) {
  const entry = el('li', 'ac-game-price-entry')
  entry.title = SETTLEMENT.coins
  entry.append(gameIcon('coin'), el('span', 'ac-game-amount', formatAmount(coins)),
    el('span', 'ac-visually-hidden', ` ${SETTLEMENT.coins}`))
  const short = Math.max(0, coins - held)
  if (short > 0) {
    entry.classList.add('ac-game-price-short')
    const mark = el('span', 'ac-game-missing-mark', '!')
    mark.setAttribute('aria-hidden', 'true')
    entry.append(mark, el('span', 'ac-game-missing', ARSENAL.short(formatAmount(short))))
  }
  return { entry, short }
}

/** The price with coins: the materials left, the coins, and its own button. */
function coinPurchase(world, building, { name, onBuy }) {
  const price = building.coinPrice
  const node = el('div', 'ac-game-buy ac-settlement-coins')
  const list = priceList(price.cost, world.materials)
  const coins = coinEntry(price.coins, world.coins ?? 0)
  list.append(coins.entry)
  const lead = el('span', 'ac-game-cost', SETTLEMENT.withCoins)
  lead.title = SETTLEMENT.withCoinsHint
  node.append(lead, list)
  if (!onBuy) return node
  const action = button(SETTLEMENT.buildWithCoins, 'ac-button ac-game-buy-button', { onClick: onBuy })
  action.dataset.key = `settlement-coins:${building.upgradeId}`
  action.setAttribute('aria-label', SETTLEMENT.buildWithCoinsAria(name, building.level + 1))
  if (!price.affordable) {
    action.disabled = true
    const missing = missingMaterials(price.cost, world.materials)
    const reasons = [
      missing.length ? missingText(missing, formatAmount) : '',
      coins.short ? SETTLEMENT.needsCoins(formatAmount(coins.short)) : ''
    ]
    const reason = el('span', 'ac-visually-hidden', reasons.filter(Boolean).join('. '))
    reason.id = `ac-settlement-coins-why-${building.upgradeId}`
    action.setAttribute('aria-describedby', reason.id)
    node.append(reason)
  }
  node.append(action)
  return node
}

/** The building's pictures: its tier now, and the next one faded as a teaser when it is near. */
function buildingPictures(base, model) {
  const node = el('div', 'ac-settlement-building-art')
  const now = sprite(base, model.sprite, 'ac-settlement-sprite')
  if (!model.isBuilt) now.classList.add('ac-settlement-sprite-unbuilt')
  node.append(now)
  if (model.teaser) {
    const teaser = sprite(base, model.teaser.art, 'ac-settlement-sprite ac-settlement-sprite-teaser')
    teaser.title = SETTLEMENT.nextTierPicture(model.teaser.name)
    node.append(teaser)
  }
  return node
}

function effectRows(model) {
  const facts = el('dl', 'ac-game-item-facts')
  for (const [term, value] of [[SETTLEMENT.now, model.nowText], [SETTLEMENT.next, model.nextText]]) {
    const pair = el('div', 'ac-game-item-fact')
    pair.append(el('dt', '', term), el('dd', '', value))
    facts.append(pair)
  }
  return facts
}

/**
 * @param {{ actions: Record<string, (...args: unknown[]) => Promise<boolean>>, base?: string }} options
 *   `base` is where the plugin's files are reached, for the pictures
 */
export function createCampView({ actions, base = '' }) {
  const element = el('div', 'ac-game-camp-section')
  const top = el('section', 'ac-game-card ac-settlement')
  const hero = createHero(base)
  const progress = createProgress()
  const bonus = el('div', 'ac-settlement-bonus')
  top.setAttribute('aria-label', SETTLEMENT.title)
  top.append(hero.element, progress.element, bonus)
  const buildings = el('div', 'ac-settlement-buildings')
  buildings.setAttribute('role', 'list')
  buildings.setAttribute('aria-label', SETTLEMENT.buildings)
  element.append(top, buildings)
  const autoSpend = actions.setAutoSpend
    ? settingSwitch(ARSENAL.autoSpend, ARSENAL.autoSpendHint, actions.setAutoSpend)
    : null
  if (autoSpend) element.append(section(ARSENAL.spending, [autoSpend.element], 'ac-game-camp-spending'))
  let drawn = null

  function drawBonus(settlement) {
    const list = el('ul', 'ac-settlement-bonus-list')
    for (const effect of settlement.bonuses) list.append(el('li', '', effectText(effect)))
    if (!settlement.bonuses.length) list.append(el('li', 'ac-muted', SETTLEMENT.noBonus))
    bonus.replaceChildren(el('h3', 'ac-settlement-bonus-title', SETTLEMENT.bonusTitle), list)
  }

  function buildingCard(world, building) {
    const model = buildingModel(building)
    const node = el('article', 'ac-game-card ac-settlement-building')
    if (!model.isOpen) node.classList.add('ac-settlement-building-locked')
    node.setAttribute('role', 'listitem')
    // Where the focus goes when the button that had it is off after a purchase.
    node.dataset.card = building.upgradeId
    node.tabIndex = -1
    const head = el('div', 'ac-settlement-building-head')
    const what = el('div', 'ac-settlement-building-what')
    const facts = el('p', 'ac-settlement-building-facts')
    facts.append(el('span', 'ac-settlement-tier-name', model.tierName), el('span', 'ac-muted', model.levelText))
    if (model.tierText) facts.append(el('span', 'ac-muted', model.tierText))
    what.append(el('h3', 'ac-game-item-name', model.name), facts)
    if (model.nextTierText) what.append(el('p', 'ac-settlement-next-tier', model.nextTierText))
    head.append(buildingPictures(base, model), what)
    node.append(head)
    if (!model.isOpen) {
      node.append(el('p', 'ac-settlement-locked', model.lockedText))
      return node
    }
    node.append(effectRows(model), purchase({
      cost: building.cost,
      affordable: building.affordable,
      materials: world.materials,
      label: SETTLEMENT.build,
      ariaLabel: SETTLEMENT.buildAria(model.name, building.level + 1),
      key: `settlement:${building.upgradeId}`,
      onBuy: actions.buyGroupUpgrade && (() => actions.buyGroupUpgrade(world.id, building.upgradeId))
    }))
    if (building.coinPrice) {
      const onBuy = actions.buyGroupUpgrade && (() => actions.buyGroupUpgrade(world.id, building.upgradeId, true))
      node.append(coinPurchase(world, building, { name: model.name, onBuy }))
    }
    return node
  }

  /** Redraws the cards; a button that had the focus and is now off hands it to its card. */
  function redrawBuildings(world, settlement) {
    const active = element.ownerDocument.activeElement
    const card = buildings.contains(active) ? active.closest('[data-card]')?.dataset.card : null
    replaceKeepingFocus(buildings, settlement.buildings.map((building) => buildingCard(world, building)))
    if (card && !buildings.contains(element.ownerDocument.activeElement)) {
      buildings.querySelector(`[data-card="${CSS.escape(card)}"]`)?.focus()
    }
  }

  return {
    element,
    /** @param {{ game: object, world: object }} next */
    update({ game, world }) {
      autoSpend?.set(game.autoSpend === true)
      const settlement = world.settlement
      top.hidden = !settlement
      buildings.hidden = !settlement
      if (!settlement) return
      const signature = JSON.stringify([world.id, settlement, world.materials, world.coins])
      if (signature === drawn) return
      drawn = signature
      const model = heroModel(settlement)
      hero.update(model)
      progress.update(model)
      drawBonus(settlement)
      redrawBuildings(world, settlement)
    }
  }
}

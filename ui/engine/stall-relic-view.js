// A relic on a city's stall: its picture in a gold frame with its glow, its name in gold, its buff
// and flavour line, the price, and Buy with the same reasons as the stall's gear when it cannot
// be bought. It goes to the room picked in "Goes to", and is the one that room lacks.
import { button, el } from './dom.js'
import { gameIcon } from './icon-view.js'
import { framedPicture } from './legendary-art.js'
import { STALL_RELIC } from './legendary-labels.js'
import { stallRelic } from './legendary-model.js'
import { MARKET, coinsText, offerBlockText } from './market-labels.js'

/**
 * @param {{ game: object, world: object, city: object, roomId: string | null, actions: object, base: string }} options
 * @returns {HTMLElement | null} null when the stall has no relic today
 */
export function stallRelicRow({ game, world, city, roomId, actions, base }) {
  const offer = stallRelic(game, city, { roomId, coins: world.coins, canBuy: Boolean(actions.buyStallOffer) })
  if (!offer) return null
  const row = el('article', 'ac-market-row ac-market-offer ac-legendary-offer')
  const head = el('div', 'ac-market-offer-head')
  const facts = el('div', 'ac-market-offer-facts')
  if (offer.entry) {
    head.append(framedPicture(base, offer.entry.id, { frame: 'slot', alt: offer.entry.name, className: 'ac-legendary-offer-picture' }))
    facts.append(el('span', 'ac-legendary-kicker', STALL_RELIC.kicker), el('strong', 'ac-legendary-name', offer.entry.name),
      el('span', 'ac-legendary-buff', offer.entry.text), el('span', 'ac-legendary-flavour', offer.entry.flavour))
  } else {
    const why = offer.block === 'sold' ? STALL_RELIC.soldToday : STALL_RELIC.ownsAll
    facts.append(el('span', 'ac-legendary-kicker', STALL_RELIC.kicker), el('span', 'ac-game-card-line', why))
  }
  head.append(facts)
  const price = el('span', 'ac-market-offer-price')
  price.append(gameIcon('coin', 'ac-market-coin'), el('span', 'ac-game-amount', coinsText(offer.price)))
  const controls = el('div', 'ac-market-row-controls')
  if (offer.entry) controls.append(price)
  if (offer.block !== 'viewOnly' && offer.entry) {
    const buy = button(MARKET.buy, 'ac-button ac-primary ac-market-go', {
      onClick: () => actions.buyStallOffer(world.id, city.id, offer.index, offer.entry.id, roomId)
    })
    buy.dataset.key = `buy:${city.id}:${offer.index}`
    buy.setAttribute('aria-label', STALL_RELIC.buyLabel(offer.entry.name, coinsText(offer.price)))
    buy.disabled = offer.block !== null
    controls.append(buy)
    const why = offerBlockText(offer.block, { price: offer.price, coins: world.coins })
    if (why) {
      const note = el('span', 'ac-game-missing', why)
      note.id = `ac-market-why-${city.id}-${offer.index}`
      buy.setAttribute('aria-describedby', note.id)
      controls.append(note)
    }
  }
  row.append(head, controls)
  return row
}

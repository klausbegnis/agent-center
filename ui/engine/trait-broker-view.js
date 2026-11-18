// A city's Trait broker card in the Market tab: the day's scrolls of the city's traits with their
// prices, each bought into the room the stall's pieces go to, and a form that sells a scroll of
// that room's chest. Swapping a trait is done from the trait itself in the Party tab; the card says
// so. Built once; `render` gives the card for the city on screen.
import { button, el, select, setOptions } from './dom.js'
import { section } from './game-controls.js'
import { gameIcon } from './icon-view.js'
import { coinsText } from './market-labels.js'
import { BROKER, traitEffectText } from './trait-labels.js'
import { roomScrolls, traitEntries } from './trait-model.js'
import { traitBadge } from './trait-view.js'

/**
 * @param {{ actions: Record<string, (...args: unknown[]) => Promise<boolean>> }} options
 */
export function createBrokerCard({ actions }) {
  /** The scroll chosen in the sell form, by room, so a redraw keeps it. */
  const chosenSale = new Map()
  const canTrade = (game) => typeof actions.traitAction === 'function' && game?.viewOnly !== true

  function offerRow({ world, city, offer, entry, roomId, game }) {
    const row = el('article', 'ac-market-row ac-trait-offer')
    const head = el('div', 'ac-market-offer-head')
    head.append(traitBadge(entry), el('span', 'ac-game-card-line ac-trait-choice-text', traitEffectText(entry)))
    const controls = el('div', 'ac-market-row-controls')
    const price = el('span', 'ac-market-offer-price')
    price.append(gameIcon('coin', 'ac-market-coin'), el('span', 'ac-game-amount', coinsText(offer.price)))
    controls.append(price)
    if (canTrade(game) && roomId) {
      const buy = button(offer.sold ? BROKER.sold : BROKER.buy(offer.price), 'ac-button ac-primary ac-market-go', {
        onClick: () => actions.traitAction({ action: 'buy', worldId: world.id, cityId: city.id, offerIndex: offer.index,
          traitId: offer.traitId, roomId })
      })
      buy.dataset.key = `broker:${city.id}:${offer.index}`
      buy.setAttribute('aria-label', offer.sold ? `${entry.name}: ${BROKER.sold}` : BROKER.buyLabel(entry.name, traitEffectText(entry), offer.price))
      buy.disabled = offer.sold || !offer.affordable
      controls.append(buy)
      if (!offer.sold && !offer.affordable) controls.append(el('span', 'ac-game-missing', BROKER.cannotPay))
    } else if (offer.sold) {
      controls.append(el('span', 'ac-muted', BROKER.sold))
    }
    row.append(head, controls)
    return row
  }

  function sellForm({ world, city, roomId, game, entries }) {
    const scrolls = roomScrolls(game, roomId, entries)
    const form = el('div', 'ac-trait-sell')
    form.append(el('h3', 'ac-trait-subtitle', BROKER.sellTitle), el('p', 'ac-game-card-line ac-muted', BROKER.sellHint))
    const row = el('div', 'ac-game-row')
    const picker = select('ac-select', BROKER.sellPicker)
    setOptions(picker, scrolls.length
      ? scrolls.map((scroll) => [scroll.entry.id, `${scroll.entry.name} ×${scroll.count}`])
      : [['', BROKER.noSell]])
    const wanted = chosenSale.get(roomId)
    picker.value = scrolls.some((scroll) => scroll.entry.id === wanted) ? wanted : scrolls[0]?.entry.id ?? ''
    picker.dataset.key = `broker:${city.id}:sell-which`
    picker.disabled = scrolls.length === 0
    const priceOf = (traitId) => world.traits?.salePrices?.[entries.get(traitId)?.tier] ?? 0
    const sell = button(BROKER.sell(priceOf(picker.value)), 'ac-button ac-market-go', {
      onClick: () => actions.traitAction({ action: 'sell', worldId: world.id, cityId: city.id, roomId, traitId: picker.value })
    })
    sell.dataset.key = `broker:${city.id}:sell`
    const label = () => sell.setAttribute('aria-label', BROKER.sellLabel(priceOf(picker.value)))
    label()
    sell.disabled = scrolls.length === 0
    picker.addEventListener('change', () => {
      chosenSale.set(roomId, picker.value)
      sell.textContent = BROKER.sell(priceOf(picker.value))
      label()
    })
    row.append(picker, sell)
    form.append(row)
    return form
  }

  return {
    /**
     * The card for an open city, or null when the world has no broker there (no traits in the game).
     *
     * @param {{ world: object, city: object, roomId: string | null, game: object }} where `roomId` is
     *   the room a bought scroll goes into, the stall's
     */
    render({ world, city, roomId, game }) {
      const broker = world.traits?.brokers?.[city.id]
      const entries = traitEntries(game)
      if (!broker || entries.size === 0) return null
      const children = [el('p', 'ac-game-card-line', BROKER.intro)]
      if (world.traits.discount > 0) children.push(el('p', 'ac-game-card-line ac-muted', BROKER.discount(world.traits.discount)))
      const list = el('div', 'ac-game-list')
      list.append(...broker.offers.filter((offer) => entries.has(offer.traitId))
        .map((offer) => offerRow({ world, city, offer, entry: entries.get(offer.traitId), roomId, game })))
      children.push(list)
      if (canTrade(game) && roomId) children.push(sellForm({ world, city, roomId, game, entries }))
      children.push(el('p', 'ac-game-card-line ac-muted', BROKER.swapHint))
      const card = section(BROKER.title, children, 'ac-trait-broker')
      card.setAttribute('aria-label', `${BROKER.title}: ${city.name}`)
      return card
    }
  }
}

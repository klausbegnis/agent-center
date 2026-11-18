// A city's rank on the Market tab: a badge on the city's card in the list, and on the city's page a
// card with its standing towards the next rank, the fee there, the charters held, what the next rank
// gives and the charter's price with its Buy button, off and saying why while it cannot be bought.
import { CITY_RANK } from './city-rank-labels.js'
import { cityRankModel } from './city-rank-model.js'
import { button, el } from './dom.js'
import { meter, section } from './game-controls.js'
import { formatAmount } from './game-format.js'
import { gameIcon } from './icon-view.js'
import { priceList } from './price-view.js'

/**
 * "Rank II" over a city's banner in the list, or null for a city without ranks.
 *
 * @param {object} city
 */
export function rankBadge(city) {
  if (!city.rank && !city.festival) return null
  const node = el('span', 'ac-city-rank-badges')
  if (city.festival) {
    const festival = el('span', 'ac-city-rank-badge ac-city-festival-badge', CITY_RANK.festivalBadge)
    festival.title = CITY_RANK.festival
    node.append(festival)
  }
  if (city.rank) {
    const badge = el('span', `ac-city-rank-badge ac-city-rank-${city.rank.rank}`, CITY_RANK.badge(city.rank.rank))
    badge.title = CITY_RANK.rank(city.rank.rank, city.rank.title)
    node.append(badge)
  }
  return node
}

/** The charter's price: the materials the city wants and the coins, the short ones marked. */
function charterPrice(world, next) {
  const list = priceList(next.materials, world.materials)
  const coins = el('li', 'ac-game-price-entry')
  coins.title = CITY_RANK.coins
  coins.append(gameIcon('coin'), el('span', 'ac-game-amount', formatAmount(next.coins)),
    el('span', 'ac-visually-hidden', ` ${CITY_RANK.coins}`))
  if ((world.coins ?? 0) < next.coins) coins.classList.add('ac-game-price-short')
  list.append(coins)
  return list
}

/** The next rank: what it gives, the charter's price and the Buy button. */
function nextRank(world, city, next, actions) {
  const node = el('div', 'ac-city-rank-next')
  const gains = el('ul', 'ac-city-rank-gains')
  gains.append(...next.gains.map((text) => el('li', 'ac-game-card-line', text)))
  const buy = el('div', 'ac-game-buy ac-city-rank-buy')
  buy.append(el('span', 'ac-game-cost', `${CITY_RANK.charter}: ${next.charter}`), charterPrice(world, next))
  node.append(el('h3', 'ac-city-rank-next-title', next.heading), gains, buy)
  if (!actions.buyCharter) return node
  const action = button(CITY_RANK.buy(next.charter), 'ac-button ac-primary ac-game-buy-button', {
    onClick: () => actions.buyCharter(world.id, city.id)
  })
  action.dataset.key = `charter:${city.id}`
  action.setAttribute('aria-label', CITY_RANK.buyAria(next.charter, city.name, next.rank))
  action.disabled = next.block !== null
  buy.append(action)
  if (next.blockText) {
    const why = el('span', 'ac-game-missing', next.blockText)
    why.id = `ac-city-rank-why-${city.id}`
    action.setAttribute('aria-describedby', why.id)
    buy.append(why)
  }
  return node
}

/**
 * The rank card of an open city, or null for a city without ranks.
 *
 * @param {{ world: object, city: object, actions: object }} options
 * @returns {HTMLElement | null}
 */
export function rankCard({ world, city, actions }) {
  const model = cityRankModel(city, world)
  if (!model) return null
  const bar = meter('ac-city-rank-meter', CITY_RANK.standing)
  bar.set(model.progress.share, model.progress.text)
  const facts = el('p', 'ac-game-card-line ac-city-rank-fee', model.feeText)
  const children = [el('p', 'ac-game-card-line', CITY_RANK.note), bar.element, facts]
  if (model.festivalText) children.push(el('p', 'ac-game-card-line ac-city-festival', model.festivalText))
  if (model.perks.length) {
    const perks = el('ul', 'ac-city-rank-perks')
    perks.setAttribute('aria-label', CITY_RANK.perks)
    perks.append(...model.perks.map((perk) => el('li', 'ac-game-card-line', perk.text)))
    children.push(el('h3', 'ac-city-rank-next-title', CITY_RANK.perks), perks)
  }
  if (model.next) children.push(nextRank(world, city, model.next, actions))
  else children.push(el('p', 'ac-game-card-line', CITY_RANK.top), ...(model.topText ? [el('p', 'ac-game-card-line', model.topText)] : []))
  return section(model.heading, children, `ac-city-rank ac-city-rank-${model.rank}`)
}

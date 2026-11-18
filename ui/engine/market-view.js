// The Market tab of the world of the room picked above the tabs (the coins are in the strip
// there): the list of its cities (a banner each, with what it sells cheap and pays well for, or
// the level it opens at) or the city opened, with its
// Sell, Trade and Stall cards. The open city, the amounts chosen and the stall's room are kept
// across redraws, and a redraw puts the keyboard back on the control that had it.
import { rankBadge, rankCard } from './city-rank-view.js'
import { button, el } from './dom.js'
import { replaceKeepingFocus, section } from './game-controls.js'
import { joinedRooms, worldById } from './game-model.js'
import { roomTitle } from './labels.js'
import { cityTrades, sellCard, stallCard } from './market-city-view.js'
import { MARKET } from './market-labels.js'
import { stallRoomId } from './market-model.js'
import { tradeCard } from './market-trade-view.js'
import { createBrokerCard } from './trait-broker-view.js'

/** A city's banner, scaled up pixel for pixel, with its name on the lower left. */
function banner(city, base) {
  const node = el('div', 'ac-market-banner')
  const image = el('img', 'ac-market-banner-image')
  image.src = `${base}${city.banner}`
  image.alt = city.bannerAlt
  image.width = 192
  image.height = 72
  const name = el('span', 'ac-market-banner-name', city.name)
  name.setAttribute('aria-hidden', 'true')
  node.append(image, name)
  return node
}

/**
 * @param {{
 *   panel: HTMLElement,
 *   actions: Record<string, (...args: unknown[]) => Promise<boolean>>,
 *   base: string,
 * }} options `base` is where the plugin's files are reached, as the themes are
 */
export function createMarketView({ panel, actions, base }) {
  let state = null
  let drawn = null
  let wantedWorldId = null
  let openCityId = null
  let wantedRoomId = null
  /** The room picked above the tabs when last drawn: picking another one moves the stall's too. */
  let pickedRoomId = null
  /** The amount chosen on each Sell row, by its key; the open row; the Trade form's choices. */
  const chosen = new Map()
  /** After a deal: redraw from the amount reset to nothing, the keyboard on that slider. */
  const afterDeal = (key) => {
    drawn = null
    draw()
    panel.querySelector(`[data-key="${CSS.escape(key)}:slider"]`)?.focus()
  }
  const openSell = { rowId: null, toggle: () => {}, onDone: afterDeal }
  const trade = {
    fromId: null,
    toId: null,
    amount: 0,
    onChoose: () => {},
    onDone: (key) => {
      trade.amount = 0
      afterDeal(key)
    }
  }
  /**
   * Each city's banner, built once per picture: the cards are rebuilt on every change of the world,
   * and a new image would flash empty while it loads. A city that rises a rank shows a new one.
   */
  const banners = new Map()
  /** A city's trait broker, after its stall (trait-broker-view.js). */
  const broker = createBrokerCard({ actions })
  const bannerOf = (city) => {
    const key = `${city.id}|${city.banner}`
    if (!banners.has(key)) banners.set(key, banner(city, base))
    const node = banners.get(key)
    node.querySelector('.ac-city-rank-badges')?.remove()
    const badge = rankBadge(city)
    if (badge) node.append(badge)
    return node
  }

  const viewOnly = el('p', 'ac-game-card-line ac-market-view-only', MARKET.viewOnly)
  const body = el('div', 'ac-game-panel-body')
  const noWorld = el('p', 'ac-game-card-line ac-market-no-world', MARKET.noWorld)
  panel.append(noWorld, body)

  function open(cityId) {
    openCityId = cityId
    drawn = null
    draw()
    // The city's first control, or the way back, takes the keyboard.
    panel.querySelector('[data-key="market:back"]')?.focus()
  }

  function cityCard(city) {
    const card = el('article', `ac-game-card ac-market-city${city.open ? '' : ' ac-market-city-locked'}`)
    card.append(bannerOf(city), el('p', 'ac-market-tagline', city.tagline), cityTrades(city))
    if (!city.open) {
      card.append(el('p', 'ac-market-locked', MARKET.locked(city.opensAt)))
      return card
    }
    const visit = button(MARKET.visit(city.name), 'ac-button ac-primary', { onClick: () => open(city.id) })
    visit.dataset.key = `city:${city.id}`
    card.append(visit)
    return card
  }

  function cityPage(world, city) {
    const rooms = joinedRooms(state).filter((room) => state.game.rooms[room.id]?.worldId === world.id)
    const roomId = stallRoomId(rooms, state.game.rooms, world.id, wantedRoomId)
    const back = button(`← ${MARKET.back}`, 'ac-button ac-market-back', {
      onClick: () => {
        openCityId = null
        drawn = null
        draw()
        panel.querySelector(`[data-key="city:${city.id}"]`)?.focus()
      }
    })
    back.dataset.key = 'market:back'
    const top = el('section', 'ac-game-card ac-market-city ac-market-city-open')
    top.append(back, bannerOf(city), el('p', 'ac-market-tagline', city.tagline), cityTrades(city))
    trade.onChoose = (choice) => {
      // Another material to give starts from nothing again: its stock is another number.
      if (choice.fromId !== trade.fromId) trade.amount = 0
      Object.assign(trade, choice)
      drawn = null
      draw()
    }
    openSell.toggle = (materialId) => {
      openSell.rowId = openSell.rowId === materialId ? null : materialId
      drawn = null
      draw()
      const target = openSell.rowId
        ? `sell:${city.id}:${materialId}:slider`
        : `sell-open:${city.id}:${materialId}`
      panel.querySelector(`[data-key="${target}"]`)?.focus()
    }
    const onRoom = (next) => {
      wantedRoomId = next
      drawn = null
      draw()
    }
    return [
      top,
      // The city's rank, its charter and what the next rank gives (city-rank-view.js).
      ...[rankCard({ world, city, actions })].filter(Boolean),
      sellCard({ world, city, chosen, open: openSell, actions }),
      tradeCard({ world, city, form: trade, actions }),
      stallCard({ world, city, rooms: rooms.map((room) => [room.id, roomTitle(room)]), roomId, onRoom,
        actions, game: state.game, base }),
      broker.render({ world, city, roomId, game: state.game })
    ].filter(Boolean)
  }

  function draw() {
    if (!state) return
    const world = worldById(state.game, wantedWorldId) ?? state.game.worlds?.[0] ?? null
    noWorld.hidden = Boolean(world?.market)
    viewOnly.hidden = Boolean(actions.sellMaterial) || state.game.viewOnly !== true
    const rooms = joinedRooms(state).map((room) => [room.id, state.game.rooms[room.id]?.worldId])
    const signature = JSON.stringify([world, rooms, openCityId, wantedRoomId, trade.fromId, trade.toId,
      openSell.rowId])
    if (signature === drawn) return
    drawn = signature
    if (!world?.market) {
      body.replaceChildren()
      return
    }
    const city = world.market.cities.find((entry) => entry.id === openCityId && entry.open)
    if (!city) openCityId = null
    const cards = city
      ? cityPage(world, city)
      : [section(MARKET.cities, [el('p', 'ac-game-card-line', MARKET.citiesNote), viewOnly],
        'ac-market-intro'),
          ...world.market.cities.map(cityCard)]
    replaceKeepingFocus(body, cards)
  }

  return {
    /**
     * @param {object} next the view state, with the game running
     * @param {{ worldId: string | null, roomId: string | null }} picked the room picked above the
     *   tabs: the market is its world's, and a stall's piece goes into it unless another is chosen
     */
    update(next, { worldId, roomId }) {
      state = next
      if (worldId !== wantedWorldId) openCityId = null
      wantedWorldId = worldId
      if (roomId !== pickedRoomId) wantedRoomId = roomId
      pickedRoomId = roomId
      draw()
    }
  }
}

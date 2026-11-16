// The Market tab: the world's coins, then either the list of its cities (a banner each, with
// what it sells cheap and pays well for, or the level it opens at) or the city opened, with its
// Sell, Trade and Stall cards. The open city, the amounts chosen and the stall's room are kept
// across redraws, and a redraw puts the keyboard back on the control that had it.
import { button, el, select, setOptions } from './dom.js'
import { replaceKeepingFocus, section } from './game-controls.js'
import { joinedRooms, worldById } from './game-model.js'
import { gameIcon } from './icon-view.js'
import { roomTitle } from './labels.js'
import { cityTrades, sellCard, stallCard } from './market-city-view.js'
import { MARKET, formatCoins } from './market-labels.js'
import { stallRoomId } from './market-model.js'
import { tradeCard } from './market-trade-view.js'

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
 *   prefs?: { get: (key: string) => unknown, set: (key: string, value: string) => unknown }
 * }} options `base` is where the plugin's files are reached, as the themes are
 */
export function createMarketView({ panel, actions, base, prefs }) {
  let state = null
  let drawn = null
  let wantedWorldId = null
  let openCityId = null
  let wantedRoomId = null
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
   * Each city's banner, built once: the cards are rebuilt on every change of the world, and a
   * new image would flash empty while it loads.
   */
  const banners = new Map()
  const bannerOf = (city) => {
    if (!banners.has(city.id)) banners.set(city.id, banner(city, base))
    return banners.get(city.id)
  }

  const head = el('section', 'ac-game-card ac-market-head')
  const worldField = el('label', 'ac-game-field')
  const worldSelect = select('ac-select', MARKET.world)
  worldSelect.removeAttribute('aria-label')
  worldSelect.addEventListener('change', () => {
    wantedWorldId = worldSelect.value
    openCityId = null
    draw()
  })
  worldField.append(el('span', 'ac-game-field-label', MARKET.world), worldSelect)
  const coins = el('div', 'ac-market-coins')
  head.append(worldField, coins, el('p', 'ac-game-card-line', MARKET.coinsNote))
  const viewOnly = el('p', 'ac-game-card-line ac-market-view-only', MARKET.viewOnly)
  head.append(viewOnly)
  const body = el('div', 'ac-game-panel-body')
  const noWorld = el('p', 'ac-game-card-line ac-game-arsenal-empty', MARKET.noWorld)
  panel.append(head, noWorld, body)

  Promise.resolve(prefs?.get('arsenalRoom')).then((saved) => {
    if (typeof saved === 'string' && saved && wantedRoomId === null) wantedRoomId = saved
  }).catch(() => {})

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
      sellCard({ world, city, chosen, open: openSell, actions }),
      tradeCard({ world, city, form: trade, actions }),
      stallCard({ world, city, rooms: rooms.map((room) => [room.id, roomTitle(room)]), roomId, onRoom,
        actions })
    ]
  }

  function draw() {
    if (!state) return
    const worlds = state.game.worlds ?? []
    setOptions(worldSelect, worlds.map((world) => [world.id, world.id]))
    worldField.hidden = worlds.length < 2
    const world = worldById(state.game, wantedWorldId) ?? worlds[0] ?? null
    if (world) worldSelect.value = world.id
    head.hidden = !world?.market
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
    coins.replaceChildren(gameIcon('coin', 'ac-market-coin'),
      el('span', 'ac-game-summary-label', MARKET.coins),
      el('strong', 'ac-game-amount ac-market-coins-value', formatCoins(world.coins)))
    const city = world.market.cities.find((entry) => entry.id === openCityId && entry.open)
    if (!city) openCityId = null
    const cards = city
      ? cityPage(world, city)
      : [section(MARKET.cities, [el('p', 'ac-game-card-line', MARKET.citiesNote)], 'ac-market-intro'),
          ...world.market.cities.map(cityCard)]
    replaceKeepingFocus(body, cards)
  }

  return {
    /** @param {object} next the view state, with the game running */
    update(next) {
      state = next
      draw()
    }
  }
}

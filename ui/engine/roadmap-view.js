// The World tab's Roadmap: the region's map for the world's progress with a live marker on each
// site (and on a party inside), the cooldowns of the room picked above the tabs, then one card per
// instance: its banner with the name over it, its state, races, boss and relic, an Enter control
// (room and tier, with the reason a room cannot) for an open one, and the run's card for one a room
// is inside. Cards are made once and updated, so focus, choices and open questions survive redraws.
import { button, el, select, setOptions } from './dom.js'
import { INSTANCES } from './instance-labels.js'
import { cooldownLines, roadmapModel, runCardModel } from './instance-model.js'
import { roomTitle } from './labels.js'
import { createRunCard } from './run-card-view.js'

/** The roadmap's markers are 16×16 icons, drawn at this size over the map. */
const MARKER_SIZE = 16
/** The banners are 192×72 pixel art. */
const BANNER = { width: 192, height: 72 }
const RELIC_SIZE = 32

/** An instance's card: made once, updated from its model. */
function createInstanceCard(model, { actions, choices }) {
  const element = el('article', 'ac-instance-card')
  element.dataset.key = model.key
  const banner = el('div', 'ac-instance-banner')
  const art = el('img', 'ac-instance-banner-art')
  art.width = BANNER.width
  art.height = BANNER.height
  art.decoding = 'async'
  art.draggable = false
  const name = el('h3', 'ac-instance-name')
  banner.append(art, name)
  const stateLine = el('p', 'ac-instance-state')
  const cleared = el('p', 'ac-game-card-line ac-muted ac-instance-cleared')
  const races = el('p', 'ac-game-card-line ac-instance-races')
  const boss = el('p', 'ac-game-card-line ac-muted ac-instance-boss')
  const relic = el('div', 'ac-instance-relic')
  const relicArt = el('img', 'ac-legendary-art ac-instance-relic-art')
  relicArt.width = RELIC_SIZE
  relicArt.height = RELIC_SIZE
  relicArt.decoding = 'async'
  const relicWords = el('div', 'ac-instance-relic-words')
  relic.append(relicArt, relicWords)
  const enter = el('div', 'ac-instance-enter')
  const roomPick = select('ac-select ac-instance-room', INSTANCES.room)
  roomPick.dataset.key = `${model.key}:room`
  const tierPick = select('ac-select ac-instance-tier', INSTANCES.tier)
  tierPick.dataset.key = `${model.key}:tier`
  const go = button(INSTANCES.enter, 'ac-button ac-primary ac-instance-go', {
    onClick: () => actions.enterInstance?.(roomPick.value, model.id, Number(tierPick.value))
  })
  go.dataset.key = `${model.key}:go`
  const why = el('p', 'ac-game-card-line ac-muted ac-instance-why')
  why.setAttribute('aria-live', 'polite')
  const roomLabel = el('label', 'ac-instance-field')
  roomLabel.append(el('span', 'ac-instance-field-name', INSTANCES.room), roomPick)
  const tierLabel = el('label', 'ac-instance-field')
  tierLabel.append(el('span', 'ac-instance-field-name', INSTANCES.tier), tierPick)
  const fields = el('div', 'ac-instance-fields')
  fields.append(roomLabel, tierLabel, go)
  enter.append(fields, why)
  const run = createRunCard({ actions })
  element.append(banner, stateLine, cleared, races, boss, relic, enter, run.element)
  let current = model
  /** Re-reads the choice: the reason of the room picked, and whether Enter can go. */
  function sync() {
    const chosen = current.enter?.rooms.find((room) => room.id === roomPick.value)
    const reason = chosen?.reason ?? null
    go.disabled = !chosen || reason !== null
    why.textContent = reason ? INSTANCES.why(reason) : ''
    go.setAttribute('aria-label', INSTANCES.enterLabel(current.name, chosen?.name ?? '', Number(tierPick.value)))
    choices.set(current.id, { roomId: roomPick.value, tier: Number(tierPick.value) })
  }
  roomPick.addEventListener('change', sync)
  tierPick.addEventListener('change', sync)

  function drawEnter(model) {
    const shown = Boolean(model.enter && actions.enterInstance)
    enter.hidden = !shown
    if (!shown) return
    const choice = choices.get(model.id) ?? {}
    setOptions(roomPick, model.enter.rooms.map((room) => [room.id, room.name]))
    roomPick.value = model.enter.rooms.some((room) => room.id === choice.roomId) ? choice.roomId : model.enter.defaultRoomId
    setOptions(tierPick, model.enter.tiers.map((tier) => [String(tier.tier), tier.text]))
    const tier = model.enter.tiers.some((each) => each.tier === choice.tier) ? choice.tier : model.enter.defaultTier
    tierPick.value = String(tier)
    sync()
  }

  return {
    element,
    update(model, runModel) {
      current = model
      element.dataset.state = model.state
      if (art.getAttribute('src') !== model.banner) art.src = model.banner
      art.alt = model.alt
      name.textContent = model.name
      stateLine.textContent = model.stateText
      cleared.textContent = model.clearedText
      cleared.hidden = !model.clearedText
      races.textContent = model.racesText
      races.hidden = !model.racesText
      boss.textContent = model.bossText
      boss.hidden = !model.bossText
      relic.hidden = !model.relic
      if (model.relic) {
        if (relicArt.getAttribute('src') !== model.relic.art) relicArt.src = model.relic.art
        relicArt.alt = model.relic.name
        relic.dataset.found = String(model.relic.found)
        relicWords.replaceChildren(
          el('span', 'ac-instance-relic-label', INSTANCES.relic),
          el('strong', 'ac-instance-relic-name', model.relic.name),
          el('span', 'ac-instance-relic-text', model.relic.text),
          el('span', 'ac-muted', model.relic.foundText)
        )
      }
      drawEnter(model)
      run.element.hidden = !runModel
      if (runModel) run.update(runModel)
    }
  }
}

/**
 * @param {{ actions: Record<string, (...args: unknown[]) => Promise<unknown>>, base: string }} options
 */
export function createRoadmapView({ actions, base }) {
  const element = el('div', 'ac-roadmap')
  const head = el('section', 'ac-game-card ac-roadmap-head')
  const title = el('h2', 'ac-game-card-title')
  const summary = el('p', 'ac-game-card-line ac-roadmap-summary')
  const complete = el('p', 'ac-game-card-line ac-roadmap-complete')
  const figure = el('div', 'ac-roadmap-map')
  const map = el('img', 'ac-roadmap-art')
  map.decoding = 'async'
  map.draggable = false
  const markers = el('div', 'ac-roadmap-markers')
  figure.append(map, markers)
  const cooldowns = el('div', 'ac-roadmap-cooldowns')
  head.append(title, summary, complete, figure, el('p', 'ac-game-card-line ac-muted', INSTANCES.mapNote), cooldowns)
  const list = el('div', 'ac-instance-list')
  const empty = el('p', 'ac-game-card-line', INSTANCES.noWorld)
  element.append(head, list, empty)
  const cards = new Map()
  /** The room and tier chosen on each card, kept across redraws and across worlds. */
  const choices = new Map()
  let markersDrawn = ''

  function drawMarkers(model) {
    const signature = JSON.stringify(model.markers)
    if (signature === markersDrawn) return
    markersDrawn = signature
    markers.replaceChildren(...model.markers.map((marker) => {
      const node = el('img', `ac-roadmap-marker ac-roadmap-marker-${marker.state}`)
      node.src = marker.icon
      node.width = MARKER_SIZE
      node.height = MARKER_SIZE
      node.alt = marker.label
      node.title = marker.label
      node.style.left = `${marker.left}%`
      node.style.top = `${marker.top}%`
      return node
    }))
  }

  return {
    element,
    /**
     * @param {{ state: object, world: object | null, roomId: string | null }} shown the view state,
     *   the world picked above the tabs and its picked room
     */
    update({ state, world, roomId }) {
      const game = state.game
      const shownRooms = new Map(state.rooms.map((room) => [room.id, roomTitle(room)]))
      const names = (id) => shownRooms.get(id) ?? id.split('/').at(-1)
      const roomIds = (world?.roomIds ?? []).filter((id) => shownRooms.has(id))
      const model = roadmapModel(game, world, { base, roomIds, roomId, names })
      head.hidden = !model
      list.hidden = !model
      empty.hidden = Boolean(model)
      if (!model) return
      title.textContent = model.title
      summary.textContent = model.summary
      complete.hidden = !model.complete
      complete.textContent = model.complete ?? ''
      if (map.getAttribute('src') !== model.map.src) map.src = model.map.src
      map.alt = model.map.alt
      map.width = model.map.width
      map.height = model.map.height
      drawMarkers(model)
      const lines = roomId ? cooldownLines(game, roomId) : []
      cooldowns.replaceChildren(...lines.map((line) => el('p', 'ac-game-card-line ac-muted', line)))
      const nodes = model.cards.map((card) => {
        if (!cards.has(card.id)) cards.set(card.id, createInstanceCard(card, { actions, choices }))
        const view = cards.get(card.id)
        view.update(card, card.roomInside ? runCardModel(game, card.roomInside, { base }) : null)
        return view.element
      })
      if (list.childElementCount !== nodes.length || nodes.some((node, at) => list.children[at] !== node)) list.replaceChildren(...nodes)
    }
  }
}

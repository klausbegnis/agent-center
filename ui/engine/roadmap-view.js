// The Roadmap tab: a switch between the road's regions, the region's map for the world's progress with a live marker on each
// site (and on a party inside), the cooldowns of the room picked above the tabs, then one card per
// instance: its banner with the name over it, its state, races, boss and relic, an Enter control
// (room and tier, with the reason a room cannot) for an open one, a Rematch beside it once its boss
// is beaten (with a tier badge on the banner and the map), and the run's card for one a room is
// inside. Cards are made once and updated, so focus, choices and open questions survive redraws.
// Enter and Rematch say under them that they are asking, and, when the worker refuses, why, where
// the person clicked: the notice above the tabs may be scrolled far out of view.
import { button, el, select, setOptions } from './dom.js'
import { INSTANCES } from './instance-labels.js'
import { cooldownLines, enterPick, roadmapModel, runCardModel } from './instance-model.js'
import { roomTitle } from './labels.js'
import { createRunCard } from './run-card-view.js'

/** The roadmap's markers are 16×16 icons, drawn at this size over the map. */
const MARKER_SIZE = 16
/** The banners are 192×72 pixel art. */
const BANNER = { width: 192, height: 72 }
const RELIC_SIZE = 32

/**
 * An instance's card: made once, updated from its model. `onAsk` names the card whose Enter or
 * Rematch is being asked, so a refusal reaches it (see `showMessage` below).
 */
function createInstanceCard(model, { actions, choices, onAsk }) {
  const element = el('article', 'ac-instance-card')
  element.dataset.key = model.key
  const banner = el('div', 'ac-instance-banner')
  const art = el('img', 'ac-instance-banner-art')
  art.width = BANNER.width
  art.height = BANNER.height
  art.decoding = 'async'
  art.draggable = false
  const name = el('h3', 'ac-instance-name')
  const badge = el('span', 'ac-instance-rematch-badge')
  banner.append(art, name, badge)
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
  /** Whether Enter or Rematch is being asked: both wait, so one click is one request. */
  let isAsking = false
  // Says "Entering…" while asked and the worker's reason when it refuses; empty otherwise.
  const result = el('p', 'ac-game-card-line ac-instance-result')
  result.setAttribute('role', 'status')
  async function ask(...entry) {
    if (isAsking || !actions.enterInstance) return
    isAsking = true
    result.textContent = INSTANCES.entering
    onAsk(card)
    sync()
    const went = await actions.enterInstance(...entry)
    isAsking = false
    onAsk(null)
    // A refusal has put its reason here already; one that went shows as the run's card.
    if (went || result.textContent === INSTANCES.entering) result.textContent = ''
    sync()
  }
  const go = button(INSTANCES.enter, 'ac-button ac-primary ac-instance-go', {
    onClick: () => ask(roomPick.value, model.id, Number(tierPick.value))
  })
  go.dataset.key = `${model.key}:go`
  // The rematch of a beaten boss goes beside Enter, with the same room.
  const rematchGo = button('', 'ac-button ac-instance-rematch-go', {
    onClick: () => current.rematch?.next && ask(roomPick.value, model.id, 1, current.rematch.next)
  })
  rematchGo.dataset.key = `${model.key}:rematch`
  const why = el('p', 'ac-game-card-line ac-muted ac-instance-why')
  why.setAttribute('aria-live', 'polite')
  const rematchWhy = el('p', 'ac-game-card-line ac-muted ac-instance-why')
  rematchWhy.setAttribute('aria-live', 'polite')
  const rematchLines = el('div', 'ac-instance-rematch')
  const roomLabel = el('label', 'ac-instance-field')
  roomLabel.append(el('span', 'ac-instance-field-name', INSTANCES.room), roomPick)
  const tierLabel = el('label', 'ac-instance-field')
  tierLabel.append(el('span', 'ac-instance-field-name', INSTANCES.tier), tierPick)
  const fields = el('div', 'ac-instance-fields')
  fields.append(roomLabel, tierLabel, go, rematchGo)
  enter.append(fields, result, why, rematchWhy)
  const run = createRunCard({ actions })
  element.append(banner, stateLine, cleared, races, boss, relic, rematchLines, enter, run.element)
  let current = model
  /** Re-reads the choice: the reason of the room picked, and whether Enter can go. */
  function sync() {
    const chosen = current.enter?.rooms.find((room) => room.id === roomPick.value)
    const reason = chosen?.reason ?? null
    go.disabled = !chosen || reason !== null || isAsking
    why.textContent = reason ? INSTANCES.why(reason) : ''
    go.setAttribute('aria-label', INSTANCES.enterLabel(current.name, chosen?.name ?? '', Number(tierPick.value)))
    const rematch = current.rematch
    const rematchRoom = rematch?.rooms.find((room) => room.id === roomPick.value)
    rematchGo.hidden = !rematch?.next
    rematchGo.textContent = rematch?.buttonText ?? ''
    const rematchReason = rematchRoom?.reason ?? null
    rematchGo.disabled = !rematchRoom || rematchReason !== null || isAsking
    // A reason Enter already gives is said once.
    rematchWhy.textContent = rematch?.next && rematchReason && rematchReason !== reason ? INSTANCES.rematchWhy(rematchReason) : ''
    if (rematch?.next) rematchGo.setAttribute('aria-label', INSTANCES.rematchLabel(current.name, rematchRoom?.name ?? '', rematch.next))
  }
  // Another pick is another question: an old refusal no longer answers it.
  const repick = () => {
    if (!isAsking) result.textContent = ''
    // Only a pick the person made is remembered; the default follows the room picked above the tabs.
    choices.set(current.id, { roomId: roomPick.value, tier: Number(tierPick.value) })
    sync()
  }
  roomPick.addEventListener('change', repick)
  tierPick.addEventListener('change', repick)

  function drawEnter(model) {
    const shown = Boolean(model.enter && actions.enterInstance)
    enter.hidden = !shown
    if (!shown) return
    const pick = enterPick(model.enter, choices.get(model.id))
    setOptions(roomPick, model.enter.rooms.map((room) => [room.id, room.name]))
    roomPick.value = pick.roomId
    setOptions(tierPick, model.enter.tiers.map((tier) => [String(tier.tier), tier.text]))
    tierPick.value = String(pick.tier)
    sync()
  }

  const card = {
    element,
    /** Shows the worker's answer to this card's Enter or Rematch, where the person clicked. */
    showRefusal(message) {
      result.textContent = INSTANCES.refused(message)
    },
    update(model, runModel) {
      current = model
      element.dataset.state = model.state
      if (art.getAttribute('src') !== model.banner) art.src = model.banner
      art.alt = model.alt
      name.textContent = model.name
      badge.textContent = model.rematchBadge ?? ''
      badge.hidden = !model.rematchBadge
      if (model.rematchBadge) badge.title = INSTANCES.rematchBest(model.rematch.best)
      rematchLines.hidden = !model.rematch
      rematchLines.replaceChildren(...(model.rematch
        ? [el('p', 'ac-game-card-line', model.rematch.bestText), el('p', 'ac-game-card-line ac-muted', model.rematch.nextText)]
        : []))
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
  return card
}

/**
 * @param {{ actions: Record<string, (...args: unknown[]) => Promise<unknown>>, base: string }} options
 */
export function createRoadmapView({ actions, base }) {
  const element = el('div', 'ac-roadmap')
  const head = el('section', 'ac-game-card ac-roadmap-head')
  // The switch between regions, shown once there is more than one.
  const regionSwitch = el('div', 'ac-bestiary-switch ac-roadmap-regions')
  regionSwitch.setAttribute('role', 'group')
  regionSwitch.setAttribute('aria-label', INSTANCES.regionsName)
  const locked = el('p', 'ac-game-card-line ac-roadmap-locked')
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
  head.append(regionSwitch, title, summary, locked, complete, figure, el('p', 'ac-game-card-line ac-muted', INSTANCES.mapNote), cooldowns)
  const list = el('div', 'ac-instance-list')
  const empty = el('p', 'ac-game-card-line', INSTANCES.noWorld)
  element.append(head, list, empty)
  const cards = new Map()
  /** The room and tier chosen on each card, kept across redraws and across worlds. */
  const choices = new Map()
  /** The card whose Enter or Rematch is being asked, or null. */
  let asking = null
  let markersDrawn = ''
  /** The region picked on the switch, and what was last drawn, to draw again on a pick. */
  let regionId = null
  let lastShown = null
  let regionsDrawn = ''

  function drawRegions(model) {
    regionSwitch.hidden = model.regions.length === 0
    const signature = JSON.stringify(model.regions)
    if (signature === regionsDrawn) return
    regionsDrawn = signature
    regionSwitch.replaceChildren(...model.regions.map((region) => {
      const node = el('button', 'ac-button ac-bestiary-switch-button ac-roadmap-region', region.text)
      node.type = 'button'
      node.dataset.key = `region:${region.id}`
      node.dataset.locked = String(region.locked)
      node.setAttribute('aria-pressed', String(region.pressed))
      node.setAttribute('aria-label', region.label)
      node.title = region.label
      node.addEventListener('click', () => {
        regionId = region.id
        if (lastShown) view.update(lastShown)
      })
      return node
    }))
  }

  function drawMarkers(model) {
    const signature = JSON.stringify(model.markers)
    if (signature === markersDrawn) return
    markersDrawn = signature
    markers.replaceChildren(...model.markers.flatMap((marker) => {
      const node = el('img', `ac-roadmap-marker ac-roadmap-marker-${marker.state}`)
      node.src = marker.icon
      node.width = MARKER_SIZE
      node.height = MARKER_SIZE
      node.alt = marker.label
      node.title = marker.label
      node.style.left = `${marker.left}%`
      node.style.top = `${marker.top}%`
      if (!marker.badge) return [node]
      // The best rematch cleared, a small tier badge beside the site's marker.
      const badge = el('span', 'ac-roadmap-badge', marker.badge)
      badge.setAttribute('aria-hidden', 'true')
      badge.style.left = `${marker.left}%`
      badge.style.top = `${marker.top}%`
      return [node, badge]
    }))
  }

  const view = {
    element,
    /**
     * @param {{ state: object, world: object | null, roomId: string | null }} shown the view state,
     *   the world picked above the tabs and its picked room
     */
    update(shown) {
      lastShown = shown
      const { state, world, roomId } = shown
      const game = state.game
      const shownRooms = new Map(state.rooms.map((room) => [room.id, roomTitle(room)]))
      const names = (id) => shownRooms.get(id) ?? id.split('/').at(-1)
      const roomIds = (world?.roomIds ?? []).filter((id) => shownRooms.has(id))
      const model = roadmapModel(game, world, { base, roomIds, roomId, names, regionId })
      head.hidden = !model
      list.hidden = !model
      empty.hidden = Boolean(model)
      if (!model) return
      drawRegions(model)
      locked.hidden = !model.locked
      locked.textContent = model.locked ?? ''
      figure.dataset.locked = String(Boolean(model.locked))
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
        if (!cards.has(card.id)) {
          cards.set(card.id, createInstanceCard(card, { actions, choices, onAsk: (which) => { asking = which } }))
        }
        const view = cards.get(card.id)
        view.update(card, card.roomInside ? runCardModel(game, card.roomInside, { base }) : null)
        return view.element
      })
      if (list.childElementCount !== nodes.length || nodes.some((node, at) => list.children[at] !== node)) list.replaceChildren(...nodes)
    },
    /**
     * A message about an action (game-actions.js): a refused Enter or Rematch is said on its card.
     *
     * @param {string} action
     * @param {string} message
     */
    showMessage(action, message) {
      if (action === 'enterInstance' && asking) asking.showRefusal(message)
    }
  }
  return view
}

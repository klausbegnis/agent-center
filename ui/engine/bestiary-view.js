// The Bestiary tab: a header with the world's totals, its hunter rank, the boss hunter's track and
// the bestiary's bonuses; a switch between Creatures and Bosses (and, for creatures, their order);
// and a grid of cards. A race's card shows its portrait (a dark silhouette until its first kill),
// name, level and prestige title, points to the next level with a bar, and its bonus now and next,
// and opens in place to its details. A boss's card shows its fixed look, its
// name once beaten, its wins and the hint of its legendary item. Every card and its drawing is
// made once and only updated, so 75 monsters cost nothing after the first draw.
import { BESTIARY } from './bestiary-labels.js'
import { CREATURE_SORTS, bestiaryModel } from './bestiary-model.js'
import { el } from './dom.js'
import { meter, replaceKeepingFocus } from './game-controls.js'
import { worldById } from './game-model.js'
import { legendaryPicture } from './legendary-art.js'
import { drawMonsterArt } from './monster-view.js'

const SHOWS = ['creatures', 'bosses']
/** Prestige ranks a card's border tells apart; higher ones look like the last. */
const PRESTIGE_BORDERS = 3

/** A monster's portrait, drawn once. */
function portrait(look) {
  const holder = el('span', 'ac-bestiary-art')
  holder.setAttribute('aria-hidden', 'true')
  drawMonsterArt(holder, { look })
  return holder
}

/** Lines under a small heading, or nothing when there are none. */
function lineList(title, lines) {
  if (!lines.length) return []
  const list = el('ul', 'ac-bestiary-lines')
  list.append(...lines.map((line) => el('li', '', line)))
  return [el('h4', 'ac-bestiary-subtitle', title), list]
}

/** A race's card: made once, updated from its model, opened and closed in place. */
function createRaceCard(model, onToggle) {
  const element = el('article', 'ac-bestiary-card')
  const toggle = el('button', 'ac-bestiary-toggle')
  toggle.type = 'button'
  toggle.dataset.key = model.key
  const detailsId = `ac-bestiary-details-${model.id}`
  toggle.setAttribute('aria-controls', detailsId)
  toggle.addEventListener('click', () => onToggle(model.key))
  const name = el('strong', 'ac-bestiary-name')
  const level = el('span', 'ac-bestiary-level')
  const heading = el('span', 'ac-bestiary-heading')
  heading.append(name, level)
  const title = el('span', 'ac-bestiary-title')
  const kills = el('span', 'ac-bestiary-kills')
  const bar = el('span', 'ac-bestiary-bar')
  bar.setAttribute('aria-hidden', 'true')
  const fill = el('span', 'ac-bestiary-bar-fill')
  bar.append(fill)
  const bonus = el('span', 'ac-bestiary-bonus')
  const next = el('span', 'ac-bestiary-next')
  const words = el('span', 'ac-bestiary-words')
  words.append(heading, title, kills, bar, bonus, next)
  toggle.append(portrait(model.look), words)
  const details = el('div', 'ac-bestiary-details')
  details.id = detailsId
  element.append(toggle, details)
  let drawn = null

  function drawDetails(card) {
    if (!card.details) {
      details.replaceChildren(el('p', 'ac-game-card-line', BESTIARY.unknownDetails))
      return
    }
    const ranks = el('dl', 'ac-bestiary-ranks')
    for (const rank of card.details.ranks) {
      const item = el('div', 'ac-bestiary-rank')
      item.title = rank.title
      item.append(el('dt', '', rank.name), el('dd', '', rank.count.toLocaleString('en')))
      ranks.append(item)
    }
    const coming = card.details.next
    details.replaceChildren(
      el('h4', 'ac-bestiary-subtitle', BESTIARY.rankBreakdown), ranks,
      el('p', 'ac-game-card-line', [card.killsText, card.details.eliteText, card.details.firstKill].filter(Boolean).join(' · ')),
      ...lineList(BESTIARY.now, card.details.now.length ? card.details.now : [BESTIARY.nothingYet]),
      ...lineList(coming.at, coming.lines)
    )
  }

  return {
    element,
    /** @param {object} card the model @param {boolean} isOpen */
    update(card, isOpen) {
      const signature = JSON.stringify([card, isOpen])
      if (signature === drawn) return
      drawn = signature
      element.dataset.discovered = String(card.discovered)
      // A border that deepens with prestige: a mark, never the only sign (the title says it too).
      element.dataset.prestige = String(Math.min(card.prestige, PRESTIGE_BORDERS))
      element.classList.toggle('ac-bestiary-open', isOpen)
      toggle.setAttribute('aria-expanded', String(isOpen))
      toggle.setAttribute('aria-label', card.label)
      name.textContent = card.name
      level.textContent = card.levelText
      title.textContent = card.title
      kills.textContent = card.discovered ? card.progressText : card.killsText
      fill.style.width = `${card.share * 100}%`
      bonus.textContent = card.nowText
      next.textContent = card.nextText
      details.hidden = !isOpen
      if (isOpen) drawDetails(card)
    }
  }
}

/** A boss's card: made once, updated from its model. */
function createBossCard(model, base) {
  const element = el('li', 'ac-bestiary-boss')
  const name = el('strong', 'ac-bestiary-name')
  const epithet = el('span', 'ac-bestiary-epithet')
  const wins = el('span', 'ac-bestiary-wins')
  const legendary = el('span', 'ac-bestiary-legendary-mark', '★')
  legendary.setAttribute('aria-hidden', 'true')
  const item = el('span', 'ac-bestiary-item')
  item.setAttribute('aria-hidden', 'true')
  const label = el('span', 'ac-visually-hidden')
  const words = el('span', 'ac-bestiary-words')
  words.setAttribute('aria-hidden', 'true')
  words.append(name, epithet, wins)
  element.append(portrait(model.look), words, legendary, item, label)
  let drawn = null
  return {
    element,
    update(card) {
      const signature = JSON.stringify(card)
      if (signature === drawn) return
      drawn = signature
      element.dataset.discovered = String(card.discovered)
      name.textContent = card.name
      epithet.textContent = card.epithet
      wins.textContent = card.beatenText
      legendary.hidden = !(card.legendary > 0)
      label.textContent = card.label
      // A long name is cut short on a small card: the whole of it is the tooltip.
      element.title = card.discovered ? `${card.name}, ${card.epithet}` : ''
      item.hidden = !card.item
      item.dataset.found = String(Boolean(card.item?.found))
      if (card.item?.found) item.replaceChildren(legendaryPicture(base, card.item.id, { className: 'ac-bestiary-item-art' }))
      else item.replaceChildren(el('span', 'ac-bestiary-item-unknown', '?'))
    }
  }
}

/**
 * @param {{ panel: HTMLElement, base: string, outerSwitch?: boolean }} options `outerSwitch`: the
 *   World tab switches between Creatures and Bosses itself (setShow), so this view's own switch hides
 */
export function createBestiaryView({ panel, base, outerSwitch = false }) {
  let show = 'creatures'
  let sort = 'points'
  let openKey = null
  let state = null
  let worldId = null
  let order = { creatures: '', bosses: '' }
  const raceCards = new Map()
  const bossCards = new Map()

  const head = el('section', 'ac-game-card ac-bestiary-head')
  const title = el('h2', 'ac-game-card-title', BESTIARY.title)
  const totals = el('div', 'ac-game-summary ac-bestiary-totals')
  const races = el('div', 'ac-game-summary-item')
  const racesValue = el('strong', 'ac-game-summary-value')
  races.append(el('span', 'ac-game-summary-label', BESTIARY.racesName), racesValue)
  const bosses = el('div', 'ac-game-summary-item')
  const bossesValue = el('strong', 'ac-game-summary-value')
  bosses.append(el('span', 'ac-game-summary-label', BESTIARY.bossesName), bossesValue)
  totals.append(races, bosses)
  const hunter = el('div', 'ac-bestiary-hunter')
  const hunterLevel = el('span', 'ac-bestiary-hunter-level')
  const hunterHead = el('div', 'ac-bestiary-hunter-head')
  hunterHead.append(el('strong', '', BESTIARY.hunter), hunterLevel)
  const hunterMeter = meter('ac-bestiary-hunter-meter', BESTIARY.hunter)
  const hunterLines = el('div', 'ac-bestiary-hunter-lines')
  hunter.append(hunterHead, hunterMeter.element, hunterLines)
  hunter.title = BESTIARY.hunterNote
  const rank = el('div', 'ac-bestiary-hunter ac-bestiary-rank-track')
  const rankValue = el('span', 'ac-bestiary-hunter-level')
  const rankHead = el('div', 'ac-bestiary-hunter-head')
  rankHead.append(el('strong', '', BESTIARY.rank), rankValue)
  const rankMeter = meter('ac-bestiary-hunter-meter', BESTIARY.rank)
  const rankLines = el('div', 'ac-bestiary-hunter-lines')
  rank.append(rankHead, rankMeter.element, rankLines)
  rank.title = BESTIARY.rankNote
  const bonuses = el('div', 'ac-bestiary-bonuses')
  head.append(title, el('p', 'ac-game-card-line', BESTIARY.intro), totals, rank, hunter, bonuses)

  const switcher = el('div', 'ac-bestiary-switch')
  switcher.setAttribute('role', 'group')
  switcher.setAttribute('aria-label', BESTIARY.show)
  const switchButtons = SHOWS.map((name) => {
    const node = el('button', 'ac-button ac-bestiary-switch-button', name === 'creatures' ? BESTIARY.creatures : BESTIARY.bossesTab)
    node.type = 'button'
    node.dataset.key = `show:${name}`
    node.addEventListener('click', () => {
      show = name
      draw()
    })
    switcher.append(node)
    return node
  })
  // The creatures' order: by points (the default) or the closest to a new level first.
  const sorter = el('div', 'ac-bestiary-switch ac-bestiary-sort')
  sorter.setAttribute('role', 'group')
  sorter.setAttribute('aria-label', BESTIARY.sort)
  sorter.append(el('span', 'ac-bestiary-sort-label', BESTIARY.sort))
  const sortButtons = CREATURE_SORTS.map((name) => {
    const node = el('button', 'ac-button ac-bestiary-switch-button', name === 'next' ? BESTIARY.sortNext : BESTIARY.sortPoints)
    node.type = 'button'
    node.dataset.key = `sort:${name}`
    node.addEventListener('click', () => {
      sort = name
      draw()
    })
    sorter.append(node)
    return node
  })
  const controls = el('div', 'ac-bestiary-controls')
  controls.append(switcher, sorter)
  const creatureGrid = el('div', 'ac-bestiary-grid ac-bestiary-creatures')
  const bossGrid = el('ul', 'ac-bestiary-grid ac-bestiary-bosses')
  const others = el('p', 'ac-game-card-line ac-bestiary-others')
  const empty = el('p', 'ac-game-card-line', BESTIARY.noWorld)
  const body = el('section', 'ac-game-card ac-bestiary-body')
  body.append(controls, creatureGrid, bossGrid, others)
  panel.append(head, body, empty)

  function toggleCard(key) {
    openKey = openKey === key ? null : key
    draw()
  }

  /** Puts the cards in their order, moving nodes only when the order changed. */
  function place(grid, which, nodes, keys) {
    const signature = keys.join('|')
    if (order[which] === signature) return
    order[which] = signature
    replaceKeepingFocus(grid, nodes)
  }

  function drawCreatures(model) {
    const cards = model.creatures.map((card) => {
      if (!raceCards.has(card.id)) raceCards.set(card.id, createRaceCard(card, toggleCard))
      const view = raceCards.get(card.id)
      view.update(card, openKey === card.key)
      return view.element
    })
    place(creatureGrid, 'creatures', cards, model.creatures.map((card) => card.id))
    others.textContent = model.others ?? ''
  }

  function drawBosses(model) {
    const cards = model.bosses.map((card) => {
      if (!bossCards.has(card.id)) bossCards.set(card.id, createBossCard(card, base))
      const view = bossCards.get(card.id)
      view.update(card)
      return view.element
    })
    place(bossGrid, 'bosses', cards, model.bosses.map((card) => card.id))
  }

  function drawRank(model) {
    rank.hidden = !model.rank
    if (!model.rank) return
    rankValue.textContent = model.rank.rankText
    rankMeter.set(model.rank.share, model.rank.progressText)
    rankLines.replaceChildren(
      ...model.rank.now.map((line) => el('p', 'ac-bestiary-bonus-line', line)),
      ...(model.rank.next.length ? [el('p', 'ac-game-card-line', `${BESTIARY.rankNext}${model.rank.next.join('; ')}`)] : [])
    )
  }

  function drawHead(model) {
    racesValue.textContent = model.racesText
    bossesValue.textContent = model.bossesText
    drawRank(model)
    hunterLevel.textContent = model.hunter.levelText
    hunterMeter.set(model.hunter.share, model.hunter.progressText)
    const next = model.hunter.next
    hunterLines.replaceChildren(
      ...model.hunter.now.map((line) => el('p', 'ac-bestiary-bonus-line', line)),
      ...(next ? [el('p', 'ac-game-card-line', `${next.at}${next.lines.join('; ')}`)] : [])
    )
    const list = el('ul', 'ac-bestiary-lines')
    list.append(...(model.bonuses.length ? model.bonuses : [BESTIARY.noBonus]).map((line) => el('li', '', line)))
    bonuses.replaceChildren(el('h3', 'ac-bestiary-subtitle', BESTIARY.bonusesTitle), list)
  }

  function draw() {
    if (!state) return
    const world = worldById(state.game, worldId) ?? state.game.worlds?.[0] ?? null
    const model = bestiaryModel(state.game, world, { sort })
    head.hidden = !model
    body.hidden = !model
    empty.hidden = Boolean(model)
    if (!model) return
    drawHead(model)
    switchButtons.forEach((node, at) => node.setAttribute('aria-pressed', String(SHOWS[at] === show)))
    sortButtons.forEach((node, at) => node.setAttribute('aria-pressed', String(CREATURE_SORTS[at] === sort)))
    switcher.hidden = outerSwitch
    sorter.hidden = show !== 'creatures'
    creatureGrid.hidden = show !== 'creatures'
    bossGrid.hidden = show !== 'bosses'
    others.hidden = show !== 'creatures' || !model.others
    if (show === 'creatures') drawCreatures(model)
    else drawBosses(model)
  }

  return {
    /** Shows the creatures or the bosses, as the World tab's switch says. */
    setShow(name) {
      if (!SHOWS.includes(name) || name === show) return
      show = name
      draw()
    },
    /**
     * @param {object} next the view state, with the game running
     * @param {string | null} nextWorldId the world of the room picked above the tabs
     */
    update(next, nextWorldId) {
      if (nextWorldId !== worldId) openKey = null
      state = next
      worldId = nextWorldId
      draw()
    }
  }
}

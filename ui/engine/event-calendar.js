// The weekly events' calendar: a button in the header, beside the summary's scroll and the settings
// cog, with the week's event as a small badge and its goal as a thin bar, and the card it opens in
// the panels' place: this week's event in full (what it does, the time left, the goal and its
// reward) and the coming weeks, each with its event. Also the small marker in a room's header.
// Draws what event-model.js works out.
import { button, el, svgIcon } from './dom.js'
import { EVENTS } from './event-labels.js'
import { calendarButtonModel, comingWeeks, eventIconUrl, markerModel, thisWeekModel } from './event-model.js'
import { pixelPath } from './pixel-art.js'

/** The mark on the calendar's button: a page of a wall calendar with its two rings. */
const CALENDAR_MARK = [
  '.#....#.',
  '########',
  '#......#',
  '########',
  '#.#.#.##',
  '#......#',
  '#.#.#..#',
  '########'
]
/** The icons are drawn at 16 x 16 and stored at 32 x 32: shown at whole multiples, they stay crisp. */
const CARD_ICON = 32
const SMALL_ICON = 16

function icon(className, size) {
  const image = el('img', className)
  image.alt = ''
  image.setAttribute('aria-hidden', 'true')
  image.width = size
  image.height = size
  image.decoding = 'async'
  return image
}

/** A progress bar a screen reader reads as one: the goal's count so far. */
function progressBar(goal) {
  const track = el('span', 'ac-event-progress')
  track.setAttribute('role', 'progressbar')
  track.setAttribute('aria-valuemin', '0')
  track.setAttribute('aria-valuemax', String(goal.count))
  track.setAttribute('aria-valuenow', String(goal.progress))
  track.setAttribute('aria-label', `${goal.text}: ${goal.progress} of ${goal.count}`)
  const fill = el('span', 'ac-event-progress-fill')
  fill.style.width = `${Math.round(goal.share * 100)}%`
  track.append(fill)
  return track
}

/** This week's event in full: the calendar's current week, expanded. */
function thisWeekCard(week, base) {
  const card = el('section', `ac-game-card ac-event-week-current${week.goal.done ? ' ac-event-done' : ''}`)
  const head = el('div', 'ac-event-head')
  const text = el('div', 'ac-event-head-text')
  text.append(el('h3', 'ac-event-name', week.name),
    el('p', 'ac-event-meta', `${EVENTS.thisWeek} · ${week.dates} · ${week.kindLabel} · ${week.timeLeft}`))
  const image = icon('ac-event-icon', CARD_ICON)
  image.src = eventIconUrl(base, week.kind)
  head.append(image, text)
  const does = el('ul', 'ac-event-does')
  for (const line of week.lines) does.append(el('li', '', line))
  const goalRow = el('div', 'ac-event-goal')
  goalRow.append(el('span', 'ac-event-goal-text', `${EVENTS.goal}: ${week.goal.text}`), progressBar(week.goal),
    el('span', 'ac-event-goal-count', `${week.goal.progress} / ${week.goal.count}`))
  card.append(head, does, goalRow, el('p', 'ac-event-reward', week.reward), el('p', 'ac-event-flavour', week.flavour))
  return card
}

/** The coming weeks, one row each; the first, next week, also says what its event does. */
function comingCard(weeks, next, base) {
  const card = el('section', 'ac-game-card ac-event-coming')
  card.append(el('h3', 'ac-game-card-title', EVENTS.comingWeeks))
  const list = el('ol', 'ac-event-weeks')
  weeks.forEach((week, at) => {
    const item = el('li', 'ac-event-week-row')
    const image = icon('ac-event-week-icon', SMALL_ICON)
    image.src = eventIconUrl(base, week.kind)
    const text = el('div', 'ac-event-week-text')
    const top = el('div', 'ac-event-week-top')
    top.append(el('strong', 'ac-event-week-name', week.name), el('span', 'ac-event-week-dates', week.dates))
    text.append(top, el('span', 'ac-event-week-kind', week.kindLabel))
    if (at === 0 && next && next.name === week.name) {
      text.append(el('span', 'ac-event-week-does', [...next.lines, next.goal].join(' · ')))
    }
    item.append(image, text)
    list.append(item)
  })
  card.append(list)
  return card
}

/**
 * @param {{ base: string, root: HTMLElement, onOpen: () => void }} options `base` is where the
 *   plugin's files are served from; `onOpen` closes whatever else holds the panels' place (the
 *   summary, the settings)
 */
export function createEventCalendar({ base, root, onOpen }) {
  let world = null
  let state = null
  let isOpen = false
  let drawnButton = null

  const toggle = button('', 'ac-button ac-game-settings-button ac-event-button', { onClick: () => setOpen(!isOpen) })
  toggle.dataset.key = 'event-calendar'
  // The calendar with the event's icon on its corner.
  const mark = el('span', 'ac-event-button-mark')
  const badge = icon('ac-event-badge', SMALL_ICON)
  mark.append(svgIcon('ac-game-settings-icon', CALENDAR_MARK.length, pixelPath(CALENDAR_MARK, '#')), badge)
  const name = el('span', 'ac-event-button-name')
  name.setAttribute('aria-hidden', 'true')
  const bar = el('span', 'ac-event-button-bar')
  bar.setAttribute('aria-hidden', 'true')
  const barFill = el('span', 'ac-event-button-fill')
  bar.append(barFill)
  toggle.append(mark, name, bar)
  toggle.hidden = true

  const element = el('section', 'ac-event-calendar')
  element.setAttribute('aria-labelledby', 'ac-event-calendar-title')
  element.hidden = true
  const head = el('div', 'ac-game-settings-head')
  const title = el('h2', 'ac-game-settings-title', EVENTS.calendar)
  title.id = 'ac-event-calendar-title'
  title.tabIndex = -1
  head.append(title, button(EVENTS.close, 'ac-button', { onClick: () => setOpen(false, true) }))
  const body = el('div', 'ac-event-calendar-body')
  element.append(head, body)
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    setOpen(false, true)
  })

  function drawButton() {
    const model = calendarButtonModel(world)
    toggle.hidden = !model
    toggle.setAttribute('aria-expanded', String(isOpen))
    if (!model) return
    const signature = JSON.stringify(model)
    if (signature === drawnButton) return
    drawnButton = signature
    badge.src = eventIconUrl(base, model.kind)
    name.textContent = model.name
    barFill.style.width = `${Math.round(model.share * 100)}%`
    toggle.classList.toggle('ac-event-button-done', model.done)
    toggle.setAttribute('aria-label', model.label)
    toggle.title = model.name
  }

  function drawCard() {
    if (!isOpen) return
    const week = thisWeekModel(world)
    if (!week) return
    const notes = state?.game?.viewOnly ? [el('p', 'ac-game-settings-note', EVENTS.viewOnly)] : []
    body.replaceChildren(...notes, thisWeekCard(week, base), comingCard(comingWeeks(world), week.next, base))
  }

  function setOpen(next, returnFocus = false) {
    if (next === isOpen) return
    isOpen = next
    element.hidden = !isOpen
    if (isOpen) {
      onOpen()
      root.dataset.gameCalendar = 'open'
      drawCard()
      title.focus()
    } else {
      delete root.dataset.gameCalendar
      if (returnFocus) toggle.focus()
    }
    drawButton()
  }

  return {
    button: toggle,
    element,
    /** Closes the card, as when a tab, the summary or the settings open. */
    close: () => setOpen(false),
    /**
     * @param {object} nextState the view state
     * @param {object | null} nextWorld the world shown above the tabs, or null while the game is off
     */
    update(nextState, nextWorld) {
      state = nextState
      world = nextWorld
      if (isOpen && !thisWeekModel(world)) setOpen(false)
      drawButton()
      drawCard()
    }
  }
}

/**
 * The marker of a room's world's event, for the room's header.
 *
 * @param {{ base: string }} options
 */
export function createEventMarker({ base }) {
  const element = el('span', 'ac-event-marker')
  element.setAttribute('role', 'img')
  element.hidden = true
  const image = icon('ac-event-marker-icon', SMALL_ICON)
  element.append(image)
  let drawn = null
  return {
    element,
    /** @param {object | null} world the room's world, or null while the game is off */
    update(world) {
      const model = markerModel(world)
      element.hidden = !model
      if (!model) return
      const signature = `${model.kind}|${model.label}`
      if (signature === drawn) return
      drawn = signature
      image.src = eventIconUrl(base, model.kind)
      element.setAttribute('aria-label', model.label)
      element.title = model.label
    }
  }
}

// The weekly event's banner above the game's tabs, and its small marker in a room's header. The
// banner says the event's name, what it does, the time left and the goal's progress in one compact
// block, and a button shows next week's event under it. Draws what event-model.js works out.
import { el } from './dom.js'
import { EVENTS } from './event-labels.js'
import { bannerModel, eventIconUrl, markerModel } from './event-model.js'

/** The icons are drawn at 16 x 16 and stored at 32 x 32: shown at whole multiples, they stay crisp. */
const BANNER_ICON = 32
const MARKER_ICON = 16

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
function createProgress() {
  const track = el('span', 'ac-event-progress')
  track.setAttribute('role', 'progressbar')
  track.setAttribute('aria-valuemin', '0')
  const fill = el('span', 'ac-event-progress-fill')
  track.append(fill)
  return {
    track,
    set({ progress, count, share, text }) {
      track.setAttribute('aria-valuemax', String(count))
      track.setAttribute('aria-valuenow', String(progress))
      track.setAttribute('aria-label', text)
      fill.style.width = `${Math.round(share * 100)}%`
    }
  }
}

/** Next week's event, shown on demand under the banner. */
function createNext(base) {
  const element = el('div', 'ac-event-next')
  element.id = 'ac-event-next'
  const image = icon('ac-event-next-icon', MARKER_ICON)
  const text = el('div', 'ac-event-next-text')
  const name = el('strong', 'ac-event-next-name')
  const does = el('p', 'ac-event-does')
  const flavour = el('p', 'ac-event-flavour')
  text.append(name, does, flavour)
  element.append(image, text)
  return {
    element,
    set(next) {
      image.src = eventIconUrl(base, next.kind)
      name.textContent = EVENTS.nextName(next.name)
      does.textContent = [...next.lines, next.goal].join(' · ')
      flavour.textContent = next.flavour
    }
  }
}

/**
 * @param {{ base: string }} options `base` is where the plugin's files are served from
 */
export function createEventBanner({ base }) {
  const element = el('section', 'ac-event-banner')
  element.setAttribute('aria-label', EVENTS.bannerName)
  element.hidden = true
  const image = icon('ac-event-icon', BANNER_ICON)
  const main = el('div', 'ac-event-main')
  const head = el('div', 'ac-event-head')
  const name = el('strong', 'ac-event-name')
  const kind = el('span', 'ac-event-kind')
  const left = el('span', 'ac-event-left')
  head.append(name, kind, left)
  const does = el('p', 'ac-event-does')
  const goalRow = el('div', 'ac-event-goal')
  const goal = el('span', 'ac-event-goal-text')
  const progress = createProgress()
  const count = el('span', 'ac-event-goal-count')
  const reward = el('span', 'ac-event-reward')
  goalRow.append(goal, progress.track, count, reward)
  main.append(head, does, goalRow)
  const toggle = el('button', 'ac-button ac-event-toggle', EVENTS.nextShow)
  toggle.type = 'button'
  toggle.setAttribute('aria-expanded', 'false')
  toggle.setAttribute('aria-controls', 'ac-event-next')
  const next = createNext(base)
  next.element.hidden = true
  toggle.addEventListener('click', () => {
    const isOpen = next.element.hidden
    next.element.hidden = !isOpen
    toggle.setAttribute('aria-expanded', String(isOpen))
    toggle.textContent = isOpen ? EVENTS.nextHide : EVENTS.nextShow
  })
  element.append(image, main, toggle, next.element)
  let drawn = null

  return {
    element,
    /** @param {object | null} world the world shown above the tabs, or null while the game is off */
    update(world) {
      const model = bannerModel(world)
      element.hidden = !model
      if (!model) return
      const signature = JSON.stringify(model)
      if (signature === drawn) return
      drawn = signature
      element.dataset.kind = model.kind
      image.src = eventIconUrl(base, model.kind)
      name.textContent = model.name
      name.title = model.flavour
      kind.textContent = model.kindLabel
      left.textContent = model.timeLeft
      does.textContent = model.lines.join(' · ')
      goal.textContent = `${EVENTS.goal}: ${model.goal.text}`
      progress.set({ ...model.goal, text: `${model.goal.text}: ${model.goal.progress} of ${model.goal.count}` })
      count.textContent = `${model.goal.progress} / ${model.goal.count}`
      reward.textContent = model.reward
      element.classList.toggle('ac-event-done', model.goal.done)
      toggle.hidden = !model.next
      if (model.next) next.set(model.next)
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
  const image = icon('ac-event-marker-icon', MARKER_ICON)
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

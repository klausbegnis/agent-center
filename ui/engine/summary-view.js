// The "While you worked" summary: a scroll button in the header, with a dot when something notable
// happened since the person last looked, and the card it opens in place of the tabs' panels:
// Today, Since you last looked, a strip of the last 14 days and the highlights. Opening it marks
// the summary read (not on a page that only watches), but the card keeps showing what was new
// until it closes.
import { SUMMARY } from './achievement-labels.js'
import { dayStartMs, hasUnreadSummary, highlightText, stripBars, summaryLines } from './achievement-model.js'
import { button, el, svgIcon } from './dom.js'
import { pixelPath } from './pixel-art.js'

/** The mark on the summary's button: a rolled scroll. */
const SCROLL_MARK = [
  '.######.',
  '#......#',
  '.#.##.#.',
  '.#....#.',
  '.#.##.#.',
  '.#....#.',
  '#......#',
  '.######.'
]
/** The highlights shown at most, newest first. */
const HIGHLIGHTS_SHOWN = 8

/** A card of counter lines, or a line saying there is nothing. */
function linesCard(title, counts, empty, highlights = []) {
  const card = el('section', 'ac-game-card ac-summary-card')
  card.append(el('h3', 'ac-game-card-title', title))
  const lines = summaryLines(counts)
  if (!lines.length && !highlights.length) {
    card.append(el('p', 'ac-game-card-line ac-muted', empty))
    return card
  }
  const list = el('ul', 'ac-summary-lines')
  for (const line of lines) list.append(el('li', `ac-summary-line ac-summary-line-${line.key}`, line.text))
  for (const highlight of highlights.slice(-HIGHLIGHTS_SHOWN).reverse()) {
    list.append(el('li', 'ac-summary-line ac-summary-highlight', highlightText(highlight)))
  }
  card.append(list)
  return card
}

/** The last days as small bars of monsters defeated, each with its day under it. */
function stripCard(days) {
  const card = el('section', 'ac-game-card ac-summary-card ac-summary-strip-card')
  card.append(el('h3', 'ac-game-card-title', SUMMARY.strip))
  const strip = el('ol', 'ac-summary-strip')
  strip.setAttribute('aria-label', SUMMARY.stripLabel)
  for (const bar of stripBars(days)) {
    const item = el('li', 'ac-summary-day')
    item.title = bar.text
    item.setAttribute('aria-label', bar.text)
    const column = el('span', 'ac-summary-bar')
    column.setAttribute('aria-hidden', 'true')
    const fill = el('span', bar.kills > 0 ? 'ac-summary-bar-fill' : 'ac-summary-bar-fill ac-summary-bar-empty')
    fill.style.height = `${Math.max(bar.kills > 0 ? 6 : 2, Math.round(bar.share * 100))}%`
    column.append(fill)
    const label = el('span', 'ac-summary-day-label', bar.label)
    label.setAttribute('aria-hidden', 'true')
    item.append(column, label)
    strip.append(item)
  }
  card.append(strip)
  return card
}

/**
 * @param {{ actions: Record<string, (...args: unknown[]) => Promise<unknown>>, root: HTMLElement,
 *   onOpen: () => void }} options `onOpen` closes whatever else holds the panels' place (the settings)
 */
export function createSummaryView({ actions, root, onOpen }) {
  let state = null
  let isOpen = false
  /** What was new when the card opened: it stays while the card is open. */
  let sinceShown = null

  const toggle = button('', 'ac-button ac-game-settings-button ac-summary-button', { onClick: () => setOpen(!isOpen) })
  toggle.append(svgIcon('ac-game-settings-icon', SCROLL_MARK.length, pixelPath(SCROLL_MARK, '#')))
  const dot = el('span', 'ac-summary-dot')
  dot.setAttribute('aria-hidden', 'true')
  toggle.append(dot)

  const element = el('section', 'ac-summary')
  element.setAttribute('aria-labelledby', 'ac-summary-title')
  element.hidden = true
  const head = el('div', 'ac-game-settings-head ac-summary-head')
  const title = el('h2', 'ac-game-settings-title', SUMMARY.title)
  title.id = 'ac-summary-title'
  title.tabIndex = -1
  head.append(title, button(SUMMARY.close, 'ac-button', { onClick: () => setOpen(false, true) }))
  const body = el('div', 'ac-summary-body')
  element.append(head, body)

  function drawButton() {
    const isRunning = state?.game?.status === 'running' && Boolean(state.game.journal)
    toggle.hidden = !isRunning
    const unread = hasUnreadSummary(state?.game)
    dot.hidden = !unread
    const label = unread ? SUMMARY.openUnread : SUMMARY.open
    toggle.setAttribute('aria-label', label)
    toggle.title = label
    toggle.setAttribute('aria-expanded', String(isOpen))
  }

  function drawCard() {
    const journal = state?.game?.journal
    if (!isOpen || !journal) return
    const since = sinceShown ?? journal.since
    const notes = []
    if (state.game.viewOnly) notes.push(el('p', 'ac-game-settings-note', SUMMARY.viewOnly))
    const sinceTitle = since.seenAt === null ? SUMMARY.sinceFirst : SUMMARY.since
    const todayHighlights = journal.highlights.filter((highlight) => highlight.at >= dayStartMs(journal.today.day))
    body.replaceChildren(
      ...notes,
      linesCard(SUMMARY.today, journal.today, SUMMARY.nothing, todayHighlights),
      linesCard(sinceTitle, since, SUMMARY.nothingSince, since.highlights),
      stripCard(journal.days),
      el('p', 'ac-game-card-line ac-muted ac-summary-days', SUMMARY.activeDays(journal.activeDays))
    )
  }

  function setOpen(next, returnFocus = false) {
    if (next === isOpen) return
    isOpen = next
    element.hidden = !isOpen
    if (isOpen) {
      onOpen()
      root.dataset.gameSummary = 'open'
      sinceShown = state?.game?.journal?.since ?? null
      drawCard()
      title.focus()
      if (state?.game?.viewOnly !== true && hasUnreadSummary(state?.game)) actions.markSummarySeen?.()
    } else {
      delete root.dataset.gameSummary
      sinceShown = null
      if (returnFocus) toggle.focus()
    }
    drawButton()
  }

  return {
    button: toggle,
    element,
    /** Closes the card, as when another tab or the settings open. */
    close: () => setOpen(false),
    update(next) {
      state = next
      if (isOpen && state?.game?.status !== 'running') setOpen(false)
      drawButton()
      drawCard()
    }
  }
}


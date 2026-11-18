// The daily quests: a "?" button in the header, beside the calendar, the summary and the settings,
// with a dot when a quest was done or the day's quests are new since the card was last opened and a
// small count of the quests done, and the card it opens in the panels' place: today's three quests
// with what each asks, its progress, reward and state, the day's bonus, the streak and the time
// until new quests. Draws what quest-model.js works out.
import { button, el, svgIcon } from './dom.js'
import { gameIcon } from './icon-view.js'
import { pixelPath } from './pixel-art.js'
import { QUESTS } from './quest-labels.js'
import { doneKey, questButtonModel, questCardModel } from './quest-model.js'

/** The mark on the button: a question mark on a notice. */
const QUEST_MARK = [
  '..####..',
  '.##..##.',
  '.....##.',
  '....##..',
  '...##...',
  '...##...',
  '........',
  '...##...'
]
/** Where the card's last look is kept, so the dot survives a reload. */
const SEEN_PREF = 'questsSeen'

/** A progress bar a screen reader reads as one. */
function progressBar(quest) {
  const track = el('span', 'ac-quest-progress')
  track.setAttribute('role', 'progressbar')
  track.setAttribute('aria-valuemin', '0')
  track.setAttribute('aria-valuemax', String(quest.target))
  track.setAttribute('aria-valuenow', String(quest.progress))
  track.setAttribute('aria-label', `${quest.text}: ${quest.progress} of ${quest.target}`)
  const fill = el('span', 'ac-quest-progress-fill')
  fill.style.width = `${Math.round(quest.share * 100)}%`
  track.append(fill)
  return track
}

/** One quest of the day. */
function questItem(quest) {
  const item = el('li', `ac-quest${quest.done ? ' ac-quest-done' : ''}`)
  const head = el('div', 'ac-quest-head')
  head.append(gameIcon(quest.icon, 'ac-quest-icon'), el('span', 'ac-quest-slot', quest.slot), el('strong', 'ac-quest-text', quest.text))
  const row = el('div', 'ac-quest-row')
  row.append(progressBar(quest), el('span', 'ac-quest-count', `${Math.floor(quest.progress).toLocaleString('en')} / ${quest.target.toLocaleString('en')}`))
  item.append(head, row, el('p', 'ac-quest-reward', quest.reward))
  return item
}

/**
 * @param {{ root: HTMLElement, onOpen: () => void,
 *   prefs?: { get: (key: string) => unknown, set: (key: string, value: string) => void } }} options
 *   `onOpen` closes whatever else holds the panels' place
 */
export function createQuestView({ root, onOpen, prefs }) {
  let game = null
  let worldId = null
  let isOpen = false
  let seen = null
  Promise.resolve(prefs?.get(SEEN_PREF)).then((value) => {
    if (typeof value === 'string' && seen === null) seen = value
    drawButton()
  }).catch(() => {})

  const toggle = button('', 'ac-button ac-game-settings-button ac-quest-button', { onClick: () => setOpen(!isOpen) })
  toggle.dataset.key = 'daily-quests'
  toggle.append(svgIcon('ac-game-settings-icon', QUEST_MARK.length, pixelPath(QUEST_MARK, '#')))
  const count = el('span', 'ac-quest-button-count')
  count.setAttribute('aria-hidden', 'true')
  const dot = el('span', 'ac-summary-dot ac-quest-dot')
  dot.setAttribute('aria-hidden', 'true')
  toggle.append(count, dot)
  toggle.hidden = true

  const element = el('section', 'ac-quests')
  element.setAttribute('aria-labelledby', 'ac-quests-title')
  element.hidden = true
  const head = el('div', 'ac-game-settings-head')
  const title = el('h2', 'ac-game-settings-title', QUESTS.title)
  title.id = 'ac-quests-title'
  title.tabIndex = -1
  head.append(title, button(QUESTS.close, 'ac-button', { onClick: () => setOpen(false, true) }))
  const body = el('div', 'ac-quests-body')
  element.append(head, body)
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    setOpen(false, true)
  })

  function drawButton() {
    const model = questButtonModel(game, worldId, seen)
    toggle.hidden = !model
    toggle.setAttribute('aria-expanded', String(isOpen))
    if (!model) return
    count.textContent = `${model.done}/${model.total}`
    toggle.classList.toggle('ac-quest-button-all', model.allDone)
    dot.hidden = !model.isNew || isOpen
    const label = model.isNew ? `${model.label}. ${QUESTS.openNew}` : model.label
    toggle.setAttribute('aria-label', label)
    toggle.title = model.label
  }

  function drawCard() {
    if (!isOpen) return
    const model = questCardModel(game, worldId)
    if (!model) return
    const notes = game?.viewOnly ? [el('p', 'ac-game-settings-note', QUESTS.viewOnly)] : []
    const list = el('ol', 'ac-quest-list')
    for (const quest of model.quests) list.append(questItem(quest))
    const today = el('section', 'ac-game-card ac-quests-today')
    today.append(list)
    const bonus = el('section', `ac-game-card ac-quests-bonus${model.bonus.paid ? ' ac-quest-done' : ''}`)
    bonus.append(el('h3', 'ac-game-card-title', QUESTS.bonusTitle), el('p', 'ac-quest-reward', model.bonus.text),
      el('p', 'ac-quest-streak', model.streak), el('p', 'ac-quest-note', QUESTS.streakNote), el('p', 'ac-quest-note', model.nextDay))
    body.replaceChildren(...notes, today, bonus)
    // What the card shows is seen: the dot goes until something changes.
    const key = doneKey(game, worldId)
    if (key && key !== seen) {
      seen = key
      prefs?.set(SEEN_PREF, key)
    }
  }

  function setOpen(next, returnFocus = false) {
    if (next === isOpen) return
    isOpen = next
    element.hidden = !isOpen
    if (isOpen) {
      onOpen()
      root.dataset.gameQuests = 'open'
      drawCard()
      title.focus()
    } else {
      delete root.dataset.gameQuests
      if (returnFocus) toggle.focus()
    }
    drawButton()
  }

  return {
    button: toggle,
    element,
    /** Closes the card, as when a tab, the summary, the calendar or the settings open. */
    close: () => setOpen(false),
    /**
     * @param {object | null} nextGame the view state's game, or null while it is off
     * @param {string | null} nextWorldId the world shown above the tabs
     */
    update(nextGame, nextWorldId) {
      game = nextGame
      worldId = nextWorldId
      if (isOpen && !questCardModel(game, worldId)) setOpen(false)
      drawCard()
      drawButton()
    }
  }
}

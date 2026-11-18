// The World tab's Achievements view: the points earned, the title the picked room's party wears
// (a picker of the titles earned), and every group as a fold that opens to its achievements, each
// with its progress bar, points and the date it was earned. Achievements belong to the whole game,
// so the view is the same for every world; only the title follows the room picked above the tabs.
import { ACHIEVEMENTS } from './achievement-labels.js'
import { achievementGroups, titleOptions } from './achievement-model.js'
import { el, select, setOptions } from './dom.js'
import { meter, replaceKeepingFocus } from './game-controls.js'
import { roomTitle } from './labels.js'

/** One achievement: its name and points, what it asks, its title and its progress. */
function rowElement(row) {
  const item = el('li', 'ac-achievement')
  item.classList.toggle('ac-achievement-earned', row.isEarned)
  item.classList.toggle('ac-achievement-secret', row.isSecret)
  const head = el('div', 'ac-achievement-head')
  const badge = el('span', 'ac-achievement-badge', row.isEarned ? '★' : row.isSecret ? '?' : '☆')
  badge.setAttribute('aria-hidden', 'true')
  head.append(badge, el('strong', 'ac-achievement-name', row.name), el('span', 'ac-achievement-points', `${row.points}`))
  item.append(head, el('p', 'ac-achievement-text', row.description))
  if (row.title) item.append(el('p', 'ac-achievement-title', ACHIEVEMENTS.grantsTitle(row.title)))
  // A hidden achievement shows no progress: that would tell what it asks.
  if (row.isSecret) return item
  const progress = meter('ac-achievement-progress', ACHIEVEMENTS.progressLabel(row.name))
  progress.set(row.share, row.progressText)
  item.append(progress.element)
  return item
}

/** A group as a fold: its name, how many are earned and a bar, then its achievements. */
function groupElement(group, isOpen, onToggle) {
  const fold = el('details', 'ac-game-card ac-achievement-group')
  fold.open = isOpen
  const summary = el('summary', 'ac-achievement-group-head')
  summary.dataset.key = `achievement-group:${group.id}`
  const bar = el('span', 'ac-achievement-group-bar')
  bar.setAttribute('aria-hidden', 'true')
  const fill = el('span', 'ac-achievement-group-fill')
  fill.style.width = `${Math.round(group.share * 100)}%`
  bar.append(fill)
  summary.append(el('span', 'ac-achievement-group-name', group.name), bar, el('span', 'ac-achievement-group-count', group.count))
  const list = el('ul', 'ac-achievement-list')
  list.append(...group.rows.map(rowElement))
  fold.append(summary, list)
  fold.addEventListener('toggle', () => onToggle(group.id, fold.open))
  return fold
}

/**
 * @param {{ actions: Record<string, (...args: unknown[]) => Promise<unknown>> }} options
 */
export function createAchievementsView({ actions }) {
  const element = el('div', 'ac-achievements')
  const top = el('section', 'ac-game-card ac-achievements-top')
  const heading = el('h2', 'ac-game-card-title', ACHIEVEMENTS.heading)
  const points = el('p', 'ac-achievements-points')
  const counts = el('p', 'ac-game-card-line ac-muted')
  const backfilled = el('p', 'ac-game-card-line ac-muted')
  top.append(heading, points, counts, backfilled)

  const titleCard = el('section', 'ac-game-card ac-achievements-title-card')
  const titleHeading = el('h2', 'ac-game-card-title', ACHIEVEMENTS.titleHeading)
  const picker = select('ac-select ac-achievements-title-picker', ACHIEVEMENTS.titleHeading)
  picker.dataset.key = 'achievement-title'
  const titleText = el('p', 'ac-achievements-title-text')
  const titleNote = el('p', 'ac-game-card-line ac-muted', ACHIEVEMENTS.titleNote)
  titleCard.append(titleHeading, titleText, picker, titleNote)

  const groups = el('div', 'ac-achievement-groups')
  element.append(top, titleCard, groups)

  /** Which folds are open, kept across redraws; the first opens until the person chooses. */
  const open = new Map()
  let roomId = null
  let drawnGroups = null

  picker.addEventListener('change', () => {
    if (!roomId || !actions.setPartyTitle) return
    actions.setPartyTitle(roomId, picker.value === '' ? null : picker.value)
  })

  function drawTitle(state, achievements) {
    const canChoose = Boolean(roomId) && state.game?.viewOnly !== true && typeof actions.setPartyTitle === 'function'
    const room = state.rooms?.find((entry) => entry.id === roomId)
    const roomName = room ? roomTitle(room) : ''
    const current = achievements.partyTitles?.[roomId]?.id ?? ''
    const options = titleOptions(achievements)
    picker.hidden = !canChoose || options.length < 2
    if (!picker.hidden) {
      picker.setAttribute('aria-label', ACHIEVEMENTS.titleFor(roomName))
      setOptions(picker, options)
      picker.value = current
    }
    const worn = achievements.partyTitles?.[roomId]?.title
    titleText.textContent = options.length < 2
      ? ACHIEVEMENTS.noTitlesYet
      : canChoose ? ACHIEVEMENTS.titleFor(roomName) : `${ACHIEVEMENTS.titleFor(roomName)}: ${worn ?? ACHIEVEMENTS.noTitle}`
    if (!canChoose && options.length >= 2 && state.game?.viewOnly) titleNote.textContent = ACHIEVEMENTS.viewOnly
    else titleNote.textContent = ACHIEVEMENTS.titleNote
  }

  function drawGroups(achievements) {
    const shown = achievementGroups(achievements)
    const signature = JSON.stringify(shown)
    if (signature === drawnGroups) return
    drawnGroups = signature
    if (open.size === 0 && shown.length) open.set(shown[0].id, true)
    const onToggle = (id, isOpen) => open.set(id, isOpen)
    replaceKeepingFocus(groups, shown.map((group) => groupElement(group, open.get(group.id) === true, onToggle)))
  }

  return {
    element,
    /**
     * @param {{ state: object, roomId: string | null }} shown the view state and the room picked
     *   above the tabs, whose party's title the picker sets
     */
    update({ state, roomId: nextRoomId }) {
      roomId = nextRoomId
      const achievements = state.game?.achievements
      element.hidden = !achievements
      if (!achievements) return
      points.textContent = ACHIEVEMENTS.points(achievements.points, achievements.totalPoints)
      counts.textContent = ACHIEVEMENTS.earned(achievements.earned, achievements.total)
      backfilled.hidden = !achievements.filled
      backfilled.textContent = achievements.filled ? ACHIEVEMENTS.backfilled(achievements.filled) : ''
      drawTitle(state, achievements)
      drawGroups(achievements)
    }
  }
}

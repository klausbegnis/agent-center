// A subagent in a room: its parent's familiar when the theme draws one, otherwise a small
// character. Either way it wears its parent's colours and carries a mark of what it is doing.
import { applyLook, drawActor, drawSprite } from './actor-view.js'
import { el, svgIcon } from './dom.js'
import { ACTIVITY_ICON_SIZE, activityMark, familiarSize } from './familiars.js'
import { hash } from './hash.js'
import { actorDescription, hiddenSubagents } from './labels.js'

/** Familiars start their idle motion at one of this many points in the cycle, so a group is not in step. */
const MOTION_PHASES = 8
/** Seconds between two neighbouring phases. */
const MOTION_PHASE_SECONDS = 0.35
const DEFAULT_MOTION = 'bob'

function placeInRoom(theme, element, point, lift, mirrored) {
  const x = mirrored ? theme.room.width - point.x : point.x
  element.style.left = `${(x / theme.room.width) * 100}%`
  element.style.top = `${((point.y - lift) / theme.room.height) * 100}%`
  // Depth follows the floor position, not the height a familiar floats at.
  element.style.zIndex = String(Math.round(point.y))
}

/**
 * Positions a familiar. The point is where its feet would touch the floor, in room units.
 *
 * @param {boolean} mirrored whether this room draws its scenery mirrored
 */
export function placeFamiliar(theme, actor, point, mirrored) {
  const size = familiarSize(theme)
  placeInRoom(theme, actor, point, size.lift, mirrored)
  actor.style.width = `${(size.width / theme.room.width) * 100}%`
}

function drawMark(bubble, activity) {
  if (bubble.dataset.mark === activity && bubble.hasChildNodes()) return
  bubble.dataset.mark = activity
  const mark = activityMark(activity)
  if (mark.text) bubble.textContent = mark.text
  else bubble.replaceChildren(svgIcon('ac-activity-icon', ACTIVITY_ICON_SIZE, mark.path))
}

/**
 * Updates a subagent's character to show what it is doing.
 *
 * @param {object} agent the subagent
 * @param {{ id: string, name: string, kind: string }} parent the agent it works for
 */
export function drawFamiliar(theme, actor, agent, parent, isSelected) {
  const familiar = theme.actors.familiar
  if (familiar) {
    applyLook(theme, actor, parent.kind, parent.id)
    drawSprite(theme, actor, [familiar.symbol], familiarSize(theme))
    actor.dataset.activity = agent.activity
    actor.dataset.motion = familiar.motion ?? DEFAULT_MOTION
    actor.classList.add('ac-sub', 'ac-familiar')
    actor.classList.toggle('ac-selected', isSelected)
    actor.querySelector('.ac-label').textContent = agent.name
    actor.setAttribute('aria-label', actorDescription(agent, parent.name))
  } else {
    drawActor(theme, actor, agent, isSelected, parent)
  }
  const phase = hash(agent.id) % MOTION_PHASES
  actor.style.setProperty('--ac-familiar-delay', `${-phase * MOTION_PHASE_SECONDS}s`)
  drawMark(actor.querySelector('.ac-bubble'), agent.activity)
}

/** The "+N" marker that stands for the familiars a crowded parent has no room to show. */
export function createFamiliarMarker() {
  return el('span', 'ac-familiar-more')
}

/** @param {number} hiddenCount how many subagents the marker stands for */
export function drawFamiliarMarker(theme, marker, point, hiddenCount, mirrored) {
  placeInRoom(theme, marker, point, familiarSize(theme).lift, mirrored)
  const wording = hiddenSubagents(hiddenCount)
  marker.textContent = wording.short
  marker.title = wording.full
  marker.setAttribute('aria-label', wording.full)
}

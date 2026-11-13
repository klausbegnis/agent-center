// Puts a room drawn with a new theme in place of the old one: on a change of theme and, in game
// mode, each time a travelling room moves to its next scene. The old scene stays on top for a
// moment and fades away, so the room dissolves into the new scene instead of jumping to it.

/** How long the old scene takes to fade; ui/stage.css plays `ac-scene-leave` as long. */
export const SCENE_FADE_MS = 1000
/**
 * The old scene is taken away this long after the fade should have ended, if its animation did
 * not say it ended (a page in the background may never run it).
 */
export const LEAVING_SCENE_MS = SCENE_FADE_MS + 250
/** What moves on its own inside a scene: characters walk and "+N" markers follow them. */
const MOVING = '.ac-actor, .ac-familiar-more'

/**
 * Stops what moves in a scene where it stands now. A scene that is moved to another place in the
 * page loses its transitions, which would put every character still walking at the end of its
 * walk at once; pinning the current place first keeps the leaving scene still.
 *
 * @param {HTMLElement} scene
 */
function freeze(scene) {
  const view = scene.ownerDocument.defaultView
  for (const node of scene.querySelectorAll(MOVING)) {
    const { left, top } = view.getComputedStyle(node)
    node.style.transition = 'none'
    node.style.left = left
    node.style.top = top
  }
}

/**
 * What has the keyboard in the old room, to give it back in the new one: a character by its
 * agent, anything else by its place among the room's controls.
 */
function focusIn(oldView) {
  const active = oldView.section.ownerDocument.activeElement
  if (!active || !oldView.section.contains(active) || active === oldView.section) return null
  const agentId = oldView.agentIdOf(active)
  if (agentId) return { agentId }
  return { index: [...oldView.section.querySelectorAll('button, select')].indexOf(active) }
}

function restoreFocus(newView, focus) {
  if (!focus) return
  const target = focus.agentId
    ? newView.actorOf(focus.agentId)
    : newView.section.querySelectorAll('button, select')[focus.index]
  target?.focus({ preventScroll: true })
}

/**
 * Replaces a room's view with one drawn in another theme. What lies over the old stage (the
 * selected agent's card) moves to the new one as it is, and the keyboard focus follows. With
 * `fade`, the old scene is laid over the new one and fades away; without it the swap is at once.
 *
 * @param {{ section: HTMLElement, stage: HTMLElement, scene: HTMLElement, stopEmotes: () => void,
 *   agentIdOf: (element: Element) => string | null }} oldView already updated to the state now
 * @param {{ section: HTMLElement, stage: HTMLElement,
 *   actorOf: (agentId: string) => Element | undefined }} newView
 * @param {{ fade: boolean }} options false under reduced motion or while nobody can see the page
 * @returns {HTMLElement | null} the old scene while it fades, for the caller's clock to take away
 *   after LEAVING_SCENE_MS should it still be there
 */
export function swapRoomView(oldView, newView, { fade }) {
  const focus = focusIn(oldView)
  for (const child of [...oldView.stage.children]) {
    if (child !== oldView.scene) newView.stage.append(child)
  }
  let leaving = null
  if (fade) {
    leaving = oldView.scene
    oldView.stopEmotes()
    freeze(leaving)
    leaving.classList.add('ac-scene-leaving')
    // It covers the new scene exactly: the stage's box, not a size of its own.
    leaving.style.aspectRatio = 'auto'
    leaving.inert = true
    leaving.setAttribute('aria-hidden', 'true')
    newView.stage.append(leaving)
    leaving.addEventListener('animationend', (event) => {
      if (event.target === event.currentTarget) event.currentTarget.remove()
    })
  }
  oldView.section.replaceWith(newView.section)
  restoreFocus(newView, focus)
  return leaving
}

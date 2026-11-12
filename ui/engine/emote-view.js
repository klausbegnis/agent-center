// Draws an emote on a character: a motion from ui/stage.css, an effect symbol over the
// character and, for the time it lasts, another pose. What plays and when is decided in
// emotes.js; this module only shows it and puts the character back as it was.
import { svgUse } from './dom.js'
import { DEFAULT_EFFECT_MOTION, emoteSeconds } from './emotes.js'

/** The value of `data-emote` for an emote that has an effect or a pose but no motion. */
const NO_MOTION = 'none'

/** The pose is the first symbol of a character's sprite; parts and outfits come after it. */
function poseElement(actor) {
  return actor.querySelector('.ac-sprite use')
}

function showEffect(theme, actor, emote) {
  const { width, height } = theme.actors
  // An effect is drawn on the same grid as a pose, so the theme decides where it sits.
  const effect = svgUse('ac-emote-effect', emote.effect, `0 0 ${width} ${height}`)
  effect.dataset.motion = emote.effectMotion ?? DEFAULT_EFFECT_MOTION
  actor.append(effect)
}

function showPose(actor, symbolId) {
  const pose = poseElement(actor)
  if (!pose) return
  actor.dataset.restPose = pose.getAttribute('href')
  pose.setAttribute('href', `#${symbolId}`)
}

/** Puts the pose back, unless the character was redrawn with a new pose in the meantime. */
function restorePose(actor) {
  const pose = poseElement(actor)
  const emotePose = actor.dataset.emotePose
  if (pose && emotePose && pose.getAttribute('href') === `#${emotePose}`) {
    pose.setAttribute('href', actor.dataset.restPose)
  }
  delete actor.dataset.emotePose
  delete actor.dataset.restPose
}

/**
 * Ends the emote a character is playing, if any, and leaves it as it was before.
 *
 * @param {HTMLElement} actor
 */
export function stopEmote(actor) {
  if (!actor.classList.contains('ac-emoting')) return
  actor.classList.remove('ac-emoting')
  delete actor.dataset.emote
  actor.style.removeProperty('--ac-emote-seconds')
  actor.querySelector('.ac-emote-effect')?.remove()
  restorePose(actor)
}

/**
 * Starts an emote on a character. It runs once; call `stopEmote` when its time is up.
 *
 * @param {object} theme
 * @param {HTMLElement} actor
 * @param {{ motion?: string, effect?: string, effectMotion?: string, pose?: string, seconds?: number }} emote
 */
export function playEmote(theme, actor, emote) {
  stopEmote(actor)
  actor.style.setProperty('--ac-emote-seconds', `${emoteSeconds(emote)}s`)
  actor.dataset.emote = emote.motion ?? NO_MOTION
  actor.classList.add('ac-emoting')
  if (emote.effect) showEffect(theme, actor, emote)
  if (emote.pose) {
    actor.dataset.emotePose = emote.pose
    showPose(actor, emote.pose)
  }
}

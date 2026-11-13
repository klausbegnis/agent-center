// Draws the fight's beats (fight-schedule.js) in a room: a lunge, a bolt of light, a guard, a
// healing glow, the monster's pounce and flinch, impact marks and damage numbers. Every move is a
// CSS animation in ui/game.css, switched on with a data attribute or a short-lived element and
// taken away by the stage's one clock, so nothing is animated frame by frame.
import { el } from './dom.js'
import { formatAmount } from './game-format.js'
import { gameIcon } from './icon-view.js'
import { EFFECT } from './labels.js'
import { directionTo, monsterHeight } from './monster-place.js'
import { BOLT_FLIES_MS, BOLT_LEAVES_MS } from './fight-schedule.js'
import { ROOM_ASPECT } from './stations.js'

/** How far a lunge or a pounce reaches, as a share of the mover's own width. */
const LUNGE_SHARE = 0.55
/** How long a damage number rises; ui/game.css plays as long. */
const NUMBER_MS = 1400
/** A bolt and a mark leave the scene this long after they arrive. */
const LINGER_MS = 150

/** Where an element positioned by left and top stands, in percent of the scene. */
function pointOf(element) {
  return { x: parseFloat(element.style.left) || 0, y: parseFloat(element.style.top) || 0 }
}

/** The same direction measured on the scene's real shape, which is wider than tall. */
function sceneDirection(from, to) {
  return directionTo({ x: from.x * ROOM_ASPECT, y: from.y }, { x: to.x * ROOM_ASPECT, y: to.y })
}

/**
 * @param {{ scene: HTMLElement, theme: object }} options
 */
export function createFightView({ scene, theme }) {
  /** Half a character's and half a monster's height, in percent of the scene's height. */
  const casterMiddle = (theme.actors.height / theme.room.height) * 50
  const foeMiddle = (monsterHeight(theme, null) / theme.room.height) * 50
  /** Elements wearing a move, with the time it ends. */
  const moving = new Map()
  /** Short-lived elements (bolts, marks, numbers, glows), with the time they go. */
  const passing = new Map()

  /** Starts a move on an element, again from the start if it was already playing it. */
  function move(element, motion, until, direction) {
    if (direction) {
      element.style.setProperty('--ac-fight-x', `${(direction.x * LUNGE_SHARE * 100).toFixed(1)}%`)
      element.style.setProperty('--ac-fight-y', `${(direction.y * LUNGE_SHARE * 100).toFixed(1)}%`)
    }
    if (element.dataset.fight === motion) {
      delete element.dataset.fight
      // Reading the layout once makes the browser start the same animation over.
      void element.offsetWidth
    }
    element.dataset.fight = motion
    moving.set(element, until)
  }

  function pass(node, parent, until) {
    node.setAttribute('aria-hidden', 'true')
    parent.append(node)
    passing.set(node, until)
  }

  /** A bolt of light from the caster's hands to the monster's body. */
  function bolt(caster, foe, now) {
    const from = pointOf(caster)
    const to = pointOf(foe.element)
    const node = el('span', 'ac-fight-bolt')
    // From the middle of the caster's body to the middle of the monster's.
    const fromY = from.y - casterMiddle
    const toY = to.y - foeMiddle
    node.style.left = `${from.x}%`
    node.style.top = `${fromY}%`
    node.style.setProperty('--ac-bolt-x', `${(to.x - from.x).toFixed(1)}cqw`)
    node.style.setProperty('--ac-bolt-y', `${((toY - fromY) / ROOM_ASPECT).toFixed(1)}cqw`)
    node.style.setProperty('--ac-bolt-delay', `${BOLT_LEAVES_MS}ms`)
    node.style.setProperty('--ac-bolt-ms', `${BOLT_FLIES_MS}ms`)
    pass(node, scene, now + BOLT_LEAVES_MS + BOLT_FLIES_MS + LINGER_MS)
  }

  function memberBeat(beat, actor, foe, now, actorOf) {
    const until = now + beat.ms
    const towards = foe ? sceneDirection(pointOf(actor), pointOf(foe.element)) : null
    move(actor, beat.motion, until, towards)
    if (beat.motion === 'cast' && foe) bolt(actor, foe, now)
    if (beat.motion === 'guard') pass(gameIcon('defense', 'ac-fight-guard'), actor, until)
    if (beat.motion === 'thorns') pass(el('span', 'ac-fight-thorns'), actor, until)
    if (beat.motion === 'heal') {
      for (const id of beat.otherIds ?? []) {
        const other = actorOf(id)
        if (other) pass(el('span', 'ac-fight-glow'), other, until)
      }
    }
  }

  function monsterBeat(beat, foe, now, actorOf) {
    const until = now + beat.ms
    const other = beat.targetId ? actorOf(beat.targetId) : null
    const towards = other ? sceneDirection(pointOf(foe.element), pointOf(other)) : null
    if (beat.motion === 'pounce') move(foe.body, 'pounce', until, towards)
    if (beat.motion === 'flinch') {
      // A flinch is pushed away from whoever struck.
      move(foe.body, 'flinch', until, towards && { x: -towards.x, y: -towards.y })
      pass(el('span', 'ac-fight-impact'), foe.marks, until)
      if (beat.damage !== undefined) {
        const number = el('span', 'ac-foe-damage', EFFECT.damage(formatAmount(beat.damage)))
        // Numbers fan out a little so two in a row do not sit on each other.
        number.style.setProperty('--ac-damage-shift', `${((Math.round(now / 250) % 5) - 2) * 14}%`)
        pass(number, foe.marks, now + NUMBER_MS)
      }
    }
    if (beat.motion === 'regen') pass(el('span', 'ac-fight-regen', EFFECT.mend), foe.marks, until)
  }

  return {
    /**
     * Plays beats that start now.
     *
     * @param {import('./fight-schedule.js').Beat[]} beats
     * @param {{ foe: { element: HTMLElement, body: HTMLElement, marks: HTMLElement } | null,
     *   actorOf: (id: string) => HTMLElement | undefined, now: number }} where
     */
    play(beats, { foe, actorOf, now }) {
      for (const beat of beats) {
        if (beat.who === 'monster') {
          if (foe) monsterBeat(beat, foe, now, actorOf)
          continue
        }
        const actor = actorOf(beat.id)
        if (actor) memberBeat(beat, actor, foe, now, actorOf)
      }
    },
    /** Takes away the moves whose time is up. */
    tick(now) {
      for (const [element, until] of moving) {
        if (now < until) continue
        delete element.dataset.fight
        moving.delete(element)
      }
      for (const [node, until] of passing) {
        if (now < until) continue
        node.remove()
        passing.delete(node)
      }
    },
    /** Ends every move at once. */
    stopAll() {
      for (const element of moving.keys()) delete element.dataset.fight
      for (const node of passing.keys()) node.remove()
      moving.clear()
      passing.clear()
    }
  }
}

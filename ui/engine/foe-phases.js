// What the monster in a room is doing on screen: walking in, standing there, falling to a kill,
// or leaving when nobody in the room works. A kill plays once before the next monster walks in.
// Pure: it is told the monster that should stand there and the time, and says what to show.

/** How long the monster takes to walk in, to fall, and to leave; ui/game.css plays as long. */
export const FOE_MS = { arriving: 900, dying: 1200, leaving: 900 }

/**
 * @typedef {'gone' | 'arriving' | 'present' | 'dying' | 'leaving'} FoePhase
 */

/** Keeps the phase of one room's monster. */
export function createFoePhases() {
  /** @type {FoePhase} */
  let phase = 'gone'
  /** The monster on screen, which is not yet the next one while the last one falls. */
  let shownKey = null
  let nextKey = null
  let until = 0

  function enter(key, now) {
    shownKey = key
    nextKey = null
    phase = 'arriving'
    until = now + FOE_MS.arriving
  }

  /**
   * Says which monster should stand in the room now, if any.
   *
   * @param {string | null} key what identifies the monster, or null when none should stand there
   * @param {number} now
   */
  function observe(key, now) {
    if (key === null) {
      nextKey = null
      if (phase === 'arriving' || phase === 'present') {
        phase = 'leaving'
        until = now + FOE_MS.leaving
      }
      return
    }
    if (phase === 'gone' || phase === 'leaving') return enter(key, now)
    if (phase === 'dying') {
      nextKey = key
      return
    }
    if (key !== shownKey) {
      nextKey = key
      phase = 'dying'
      until = now + FOE_MS.dying
    }
  }

  /**
   * Moves on to `now`.
   *
   * @returns {{ phase: FoePhase, key: string | null }} what to show
   */
  function tick(now) {
    if (until && now >= until) {
      until = 0
      if (phase === 'arriving') phase = 'present'
      else if (phase === 'leaving') {
        phase = 'gone'
        shownKey = null
      } else if (phase === 'dying') {
        if (nextKey) enter(nextKey, now)
        else {
          phase = 'gone'
          shownKey = null
        }
      }
    }
    return { phase, key: shownKey }
  }

  return { observe, tick }
}

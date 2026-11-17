// A character's portrait on the Party tab: its agent's sprite as the room draws it (theme, outfit,
// tint), idle and facing forward, in a box of fixed size, so nothing moves when a theme arrives.
// A click shows the agent in its room. Drawn again only when the theme or the look changes.
import { drawPortrait } from './actor-view.js'
import { el } from './dom.js'
import { PORTRAIT } from './portrait-labels.js'

/**
 * @param {{ onShow: () => void }} options called when the portrait is clicked while it shows the
 *   sprite
 */
export function createPortrait({ onShow }) {
  const element = el('button', 'ac-game-portrait')
  element.type = 'button'
  const frame = el('span', 'ac-game-portrait-frame')
  frame.append(el('span', 'ac-sprite'))
  element.append(frame)
  let drawnKey = null
  let canShow = false
  element.addEventListener('click', () => {
    if (canShow) onShow()
  })

  return {
    element,
    /**
     * @param {import('./portraits.js').Portrait} portrait
     * @param {{ name: string, theme: object | undefined }} shown `theme` the loaded theme it names
     */
    set(portrait, { name, theme }) {
      canShow = portrait.kind === 'sprite'
      const label = canShow ? PORTRAIT.show(name) : PORTRAIT.placeholder(name, portrait.reason)
      element.setAttribute('aria-label', label)
      element.title = label
      element.setAttribute('aria-disabled', String(!canShow))
      element.classList.toggle('ac-game-portrait-empty', !canShow)
      if (portrait.key === drawnKey) return
      drawnKey = portrait.key
      // A new look starts from a clean box: the last theme's colours must not leak into this one.
      frame.removeAttribute('style')
      const sprite = frame.querySelector('.ac-sprite')
      sprite.removeAttribute('style')
      if (!canShow || !theme) {
        delete frame.dataset.sprite
        sprite.replaceChildren()
        return
      }
      frame.classList.toggle('ac-pixelated', theme.ui?.pixelated === true)
      drawPortrait(theme, frame, { kind: portrait.agentKind, lookId: portrait.lookId })
    }
  }
}

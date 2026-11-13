// A monster in pixels: the body named by its sprite, filled with its accent colour, with a dark
// outline that reads on every theme's scenery. An elite wears an aura, a boss is drawn larger.
import { svgPaths } from './dom.js'
import { monsterSize } from './game-band.js'
import { monsterAccent } from './game-model.js'
import { MONSTER_INKS, monsterShape, pixelPath, viewBoxOf } from './pixel-art.js'

/** The drawing of a monster's body, or of nothing while there is no monster. */
export function createMonsterView() {
  const element = document.createElement('span')
  element.className = 'ac-monster'
  let drawnBody = null

  return {
    element,
    /**
     * @param {object | null} monster from the view state's room
     * @param {string} description what a screen reader says for it
     */
    draw(monster, description) {
      element.hidden = !monster
      if (!monster) return
      const body = monster.sprite?.body ?? 'blob'
      if (body !== drawnBody) {
        drawnBody = body
        const rows = monsterShape(body)
        const paths = MONSTER_INKS.map((ink) => ({ className: `ac-ink-${ink}`, d: pixelPath(rows, ink) }))
        element.replaceChildren(svgPaths('ac-monster-art', viewBoxOf(rows), paths))
      }
      element.style.setProperty('--ac-monster-accent', monsterAccent(monster))
      element.style.setProperty('--ac-monster-size', String(monsterSize(monster)))
      element.classList.toggle('ac-monster-elite', Boolean(monster.affix) && monster.kind !== 'boss')
      element.classList.toggle('ac-monster-boss', monster.kind === 'boss')
      element.setAttribute('role', 'img')
      element.setAttribute('aria-label', description)
    }
  }
}

// The monster standing in a room: its pixel body, filled with its accent colour and outlined in
// dark so it reads on every theme's scenery, a small health bar over its head, its tag (Boss, or
// an elite's affix) and its name on hover or focus. Where it stands and how large it is come
// from monster-place.js; what it is doing from foe-phases.js and the fight's beats.
import { el, svgPaths } from './dom.js'
import { monsterAccent } from './game-model.js'
import { monsterHeight, monsterRank } from './monster-place.js'
import { MONSTER_INKS, monsterShape, pixelPath, viewBoxOf } from './pixel-art.js'

/**
 * @param {{ theme: object, spot: { x: number, y: number }, mirrored: boolean }} options `spot` is
 *   where its feet go, in the theme's room units
 */
export function createMonsterView({ theme, spot, mirrored }) {
  const element = el('div', 'ac-foe')
  element.tabIndex = 0
  element.setAttribute('role', 'img')
  const plate = el('div', 'ac-foe-plate')
  const tag = el('span', 'ac-foe-tag')
  const bar = el('span', 'ac-foe-health')
  const fill = el('span', 'ac-foe-health-fill')
  bar.append(fill)
  const state = el('span', 'ac-foe-state')
  plate.append(tag, bar, state)
  const body = el('div', 'ac-foe-body')
  const aura = el('span', 'ac-foe-aura')
  const art = el('span', 'ac-foe-art')
  body.append(aura, art)
  const name = el('span', 'ac-foe-name')
  /** Damage numbers, impact marks and the mending glow play here, over the body. */
  const marks = el('div', 'ac-foe-marks')
  marks.setAttribute('aria-hidden', 'true')
  element.append(plate, body, marks, name)
  for (const node of [plate, body, name]) node.setAttribute('aria-hidden', 'true')

  const x = mirrored ? theme.room.width - spot.x : spot.x
  element.style.left = `${(x / theme.room.width) * 100}%`
  element.style.top = `${(spot.y / theme.room.height) * 100}%`
  element.style.zIndex = String(Math.round(spot.y))
  let drawnBody = null

  return {
    element,
    body,
    marks,
    /** Where its feet are, in the theme's room units, as drawn (mirrored rooms included). */
    point: { x, y: spot.y },
    /**
     * @param {object} monster from the view state's room
     * @param {{ health: number, tag: string | null, state: string, description: string }} facts
     *   `health` is a share; `state` a word for a fight on hold or a resting party, or ''
     */
    draw(monster, { health, tag: tagText, state: stateText, description }) {
      const bodyName = monster.sprite?.body ?? 'blob'
      if (bodyName !== drawnBody) {
        drawnBody = bodyName
        const rows = monsterShape(bodyName)
        const paths = MONSTER_INKS.map((ink) => ({ className: `ac-ink-${ink}`, d: pixelPath(rows, ink) }))
        art.replaceChildren(svgPaths('ac-monster-art', viewBoxOf(rows), paths))
      }
      element.dataset.rank = monsterRank(monster)
      element.dataset.affix = monster.affix ?? ''
      element.style.width = `${(monsterHeight(theme, monster) / theme.room.width) * 100}%`
      element.style.setProperty('--ac-monster-accent', monsterAccent(monster))
      fill.style.transform = `scaleX(${health})`
      tag.textContent = tagText ?? ''
      tag.hidden = !tagText
      state.textContent = stateText
      state.hidden = !stateText
      // On hold or resting it stands still.
      element.dataset.still = String(Boolean(stateText))
      name.textContent = monster.name
      element.setAttribute('aria-label', description)
    },
    /** @param {import('./foe-phases.js').FoePhase} phase */
    setPhase(phase) {
      element.dataset.phase = phase
      element.hidden = phase === 'gone'
    }
  }
}

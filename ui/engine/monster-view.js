// The monster standing in a room: its pixel drawing outlined in dark so it reads on every
// theme's scenery, the glow of its rank, a small health bar over its head, its tag (its rank,
// or an elite's affix) and its name on hover or focus. A generated monster is built from its
// look (monster-compose.js); a hand-made one, or one saved before looks, from its body and
// accent colour. Where it stands and how large it is come from monster-place.js; what it is
// doing from foe-phases.js and the fight's beats.
import { el, svgPaths } from './dom.js'
import { monsterAccent } from './game-model.js'
import { composeLook } from './monster-compose.js'
import { monsterHeight, monsterRank } from './monster-place.js'
import { MONSTER_VIEW_BOX } from './monster-rigs.js'
import { MONSTER_INKS, monsterShape, pixelPath, viewBoxOf } from './pixel-art.js'

/** The plate over the monster's head is this share of its width. */
const PLATE_WIDTH = 0.8

/** A generated monster's drawing: one path per ink, each in the colour its palette gives. */
function lookArt(look) {
  const drawing = composeLook(look)
  if (!drawing) return null
  const inks = [...new Set(drawing.rows.join('').replaceAll('.', ''))]
  const paths = inks.map((ink) => ({
    className: 'ac-monster-ink',
    d: pixelPath(drawing.rows, ink),
    fill: drawing.fills[ink]
  }))
  return svgPaths('ac-monster-art ac-monster-art-look', MONSTER_VIEW_BOX, paths)
}

/** A hand-made monster's drawing: its body shape in its accent colour. */
function bodyArt(bodyName) {
  const rows = monsterShape(bodyName)
  const paths = MONSTER_INKS.map((ink) => ({ className: `ac-ink-${ink}`, d: pixelPath(rows, ink) }))
  return svgPaths('ac-monster-art', viewBoxOf(rows), paths)
}

/** What the drawing depends on, so it is only rebuilt when the monster changes. */
const artSignature = (monster) =>
  (monster.look ? JSON.stringify(monster.look) : `body:${monster.sprite?.body ?? 'blob'}`)

/**
 * Draws a monster into a holder, the way a room shows it, without its plate or animations.
 * Used by the room and by the demo's contact sheet.
 *
 * @param {Element} holder
 * @param {object} monster with `look`, or `sprite` for a hand-made one
 */
export function drawMonsterArt(holder, monster) {
  const art = (monster.look && lookArt(monster.look)) || bodyArt(monster.sprite?.body ?? 'blob')
  holder.replaceChildren(art)
}

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
  element.append(body, marks, name)
  for (const node of [plate, body, name]) node.setAttribute('aria-hidden', 'true')

  const x = mirrored ? theme.room.width - spot.x : spot.x
  element.style.left = `${(x / theme.room.width) * 100}%`
  element.style.top = `${(spot.y / theme.room.height) * 100}%`
  element.style.zIndex = String(Math.round(spot.y))
  // The plate over its head is a piece of its own, drawn under every character, so it never
  // hides a name or a bubble; the engine puts it over the head of the monster's size.
  plate.style.left = element.style.left
  let drawnArt = null

  return {
    element,
    plate,
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
      const signature = artSignature(monster)
      if (signature !== drawnArt) {
        drawnArt = signature
        drawMonsterArt(art, monster)
      }
      element.dataset.rank = monsterRank(monster)
      plate.dataset.rank = element.dataset.rank
      element.dataset.affix = monster.affix ?? ''
      const size = monsterHeight(theme, monster)
      element.style.width = `${(size / theme.room.width) * 100}%`
      plate.style.width = `${((size * PLATE_WIDTH) / theme.room.width) * 100}%`
      plate.style.top = `${((spot.y - size) / theme.room.height) * 100}%`
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
      if (element.dataset.phase === phase) return
      element.dataset.phase = phase
      element.hidden = phase === 'gone'
      plate.dataset.phase = phase
      plate.hidden = phase === 'gone' || phase === 'leaving'
    }
  }
}

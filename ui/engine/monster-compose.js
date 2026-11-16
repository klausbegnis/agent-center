// Builds a generated monster's drawing from its look: lays its parts on the grid in its rig's
// order, dresses the body, paints markings, and outlines the whole. The same look always gives
// the same drawing. Never touches the DOM.
import { inkColours } from './monster-ink.js'
import { dressBody } from './monster-outfit.js'
import { partById } from './monster-parts.js'
import { MONSTER_GRID, rigOf } from './monster-rigs.js'

const EMPTY = '.'
const OUTLINE = 'o'
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]]

const emptyGrid = () => Array.from({ length: MONSTER_GRID }, () => Array(MONSTER_GRID).fill(EMPTY))
const isInside = (x, y) => x >= 0 && y >= 0 && x < MONSTER_GRID && y < MONSTER_GRID

/**
 * @typedef {{ rows: string[], at?: [number, number], grip?: [number, number],
 *   hand?: 'main' | 'off', anchor?: string }} Piece one drawing of a part
 */

/** The pieces of a part on a rig: its own, or the ones it has for that rig. */
function piecesOf(part, rigId) {
  const source = part.rigs?.[rigId] ?? part
  if (source.pieces) return source.pieces
  return source.rows ? [source] : []
}

/** Where a piece's top left corner goes on the grid. */
function originOf(piece, slot, rig) {
  const [atX, atY] = piece.at ?? [0, 0]
  if (piece.grip) {
    const [handX, handY] = rig.hands?.[piece.hand ?? 'main'] ?? [0, 0]
    return [handX - piece.grip[0] + atX, handY - piece.grip[1] + atY]
  }
  const anchor = rig.anchors[piece.anchor ?? slot]
  return anchor ? [anchor[0] + atX, anchor[1] + atY] : [atX, atY]
}

/** Lays a piece down, outlining it where it covers something when its slot asks for that. */
function stamp(grid, piece, origin, outlined) {
  const [left, top] = origin
  const covers = []
  piece.rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx += 1) {
      if (row[dx] !== EMPTY) covers.push([left + dx, top + dy, row[dx]])
    }
  })
  if (outlined) {
    const own = new Set(covers.map(([x, y]) => `${x},${y}`))
    for (const [x, y] of covers) {
      for (const [stepX, stepY] of NEIGHBOURS) {
        const [nextX, nextY] = [x + stepX, y + stepY]
        if (!isInside(nextX, nextY) || own.has(`${nextX},${nextY}`)) continue
        if (grid[nextY][nextX] !== EMPTY) grid[nextY][nextX] = OUTLINE
      }
    }
  }
  for (const [x, y, ink] of covers) if (isInside(x, y)) grid[y][x] = ink
}

/** Patterns a marking may follow; each says whether a cell takes the marking's ink. */
const PATTERNS = {
  all: () => true,
  spots: (x, y) => (x * 7 + y * 13) % 11 < 2,
  stripes: (x) => x % 3 === 0,
  bands: (x, y) => y % 3 === 0,
  checker: (x, y) => (x + y) % 2 === 0,
  top: (x, y, grid) => y === 0 || grid[y - 1][x] === EMPTY || grid[y - 1][x] === OUTLINE
}

/** The rectangle a marking stays in: a humanoid region, or the whole grid. */
function regionOf(region, rig) {
  const size = rig.sizes?.[region]
  const anchor = rig.anchors[region]
  if (!size || !anchor) return { left: 0, top: 0, right: MONSTER_GRID, bottom: MONSTER_GRID }
  return { left: anchor[0], top: anchor[1], right: anchor[0] + size.width, bottom: anchor[1] + size.height }
}

/** Recolours the cells of a marking: spots, stripes, moss on top, glowing eyes. */
function paint(grid, marking, rig) {
  const from = new Set(marking.from)
  const matches = PATTERNS[marking.pattern] ?? PATTERNS.all
  const area = regionOf(marking.region, rig)
  const changes = []
  for (let y = area.top; y < area.bottom; y += 1) {
    for (let x = area.left; x < area.right; x += 1) {
      if (from.has(grid[y][x]) && matches(x, y, grid)) changes.push([x, y])
    }
  }
  for (const [x, y] of changes) grid[y][x] = marking.to
}

/** Rings every shape with the outline ink, so it reads on any scenery. */
function outline(grid) {
  const ring = []
  for (let y = 0; y < MONSTER_GRID; y += 1) {
    for (let x = 0; x < MONSTER_GRID; x += 1) {
      if (grid[y][x] !== EMPTY) continue
      const touches = NEIGHBOURS.some(([stepX, stepY]) => {
        const [nextX, nextY] = [x + stepX, y + stepY]
        return isInside(nextX, nextY) && grid[nextY][nextX] !== EMPTY && grid[nextY][nextX] !== OUTLINE
      })
      if (touches) ring.push([x, y])
    }
  }
  for (const [x, y] of ring) grid[y][x] = OUTLINE
}

/** The parts of a look by slot, in the rig's order, extras split into back and front. */
function layersOf(look, rig) {
  const parts = look.parts ?? {}
  const layers = []
  for (const slot of rig.order) {
    const ids = slot === 'back' || slot === 'front' ? parts.extras ?? [] : [parts[slot]]
    for (const id of ids) {
      const part = partById(id)
      if (!part || part.outfit || part.paint) continue
      const layer = part.layer ?? (part.slot === 'extras' ? 'front' : part.slot)
      if (layer === slot) layers.push({ slot, part })
    }
  }
  return layers
}

/**
 * The drawing of a generated monster.
 *
 * @param {{ rig: string, parts: Record<string, string | string[]>, colours: Record<string, string> }} look
 * @returns {{ rows: string[], fills: Record<string, string> } | null} null for a rig this UI does not know
 */
export function composeLook(look) {
  const rig = rigOf(look?.rig)
  if (!rig) return null
  const grid = emptyGrid()
  for (const { slot, part } of layersOf(look, rig)) {
    const outlined = rig.outlined.includes(slot) && part.outline !== false
    for (const piece of piecesOf(part, look.rig)) stamp(grid, piece, originOf(piece, slot, rig), outlined)
  }
  dressBody(grid, partById(look.parts?.outfit)?.outfit ?? null, rig)
  for (const id of look.parts?.extras ?? []) {
    const marking = partById(id)?.paint
    if (marking) paint(grid, marking, rig)
  }
  outline(grid)
  return { rows: grid.map((row) => row.join('')), fills: inkColours(look.colours) }
}

// Dresses a humanoid: turns the zone inks of its torso and legs (chest, arms, hands, legs, feet)
// into skin or the materials of its outfit. An outfit is a set of rules rather than a drawing,
// so it fits every torso and legs of every build. Never touches the DOM.
import { ZONE_INKS } from './monster-ink.js'

/** The inks of each material by tone. */
const MATERIALS = {
  skin: { base: 's', shade: 'S', light: 'h' },
  cloth: { base: 'c', shade: 'C', light: 'c' },
  metal: { base: 'm', shade: 'M', light: 'l' },
  leather: { base: 'w', shade: 'W', light: 'w' },
  fur: { base: 'r', shade: 'R', light: 'r' },
  bone: { base: 'b', shade: 'B', light: 'b' },
  accent: { base: 'a', shade: 'A', light: 'a' },
  dark: { base: 'p', shade: 'p', light: 'p' }
}

/** What a zone ink is: which part of the body, and in which tone. */
const ZONES = {
  t: ['chest', 'base'],
  T: ['chest', 'shade'],
  u: ['chest', 'light'],
  x: ['arm', 'base'],
  X: ['arm', 'shade'],
  n: ['hand', 'base'],
  y: ['leg', 'base'],
  Y: ['leg', 'shade'],
  z: ['foot', 'shade']
}

/** The zone inks, chest included, an outfit pass replaces. */
export const BODY_ZONE_INKS = new Set(Object.keys(ZONES))

/** The two columns down the middle of the grid, where trims and buckles go. */
const MIDDLE = new Set([11, 12])

/**
 * Textures break a material up so chain, fur and rags read as such at a few pixels a part.
 * Each gets the cell and its tone and returns the tone to paint, or `skin` to leave it bare.
 */
const TEXTURES = {
  chain: (x, y, tone) => (tone === 'base' && (x + y) % 2 ? 'shade' : tone),
  plate: (x, y, tone, cell) => (cell.isLeftEdge && tone === 'base' ? 'light' : tone),
  fur: (x, y, tone) => ((x * 7 + y * 3) % 5 === 0 ? 'shade' : tone),
  ribs: (x, y, tone, cell) => (cell.row % 2 === 1 ? 'dark' : tone),
  rags: (x, y, tone) => ((x * 5 + y * 3) % 7 === 0 ? 'skin' : tone),
  studs: (x, y, tone) => (tone === 'base' && x % 3 === 0 && y % 2 === 0 ? 'stud' : tone)
}

/** Which material an outfit gives a cell of the body, or null to leave the skin bare. */
function materialFor(outfit, zone, cell) {
  if (zone === 'chest') return outfit.chest ?? null
  if (zone === 'arm') return cell.row < (outfit.sleeves ?? 0) ? outfit.arms ?? outfit.chest : null
  if (zone === 'hand') return outfit.hands ?? null
  if (zone === 'leg') return cell.row < (outfit.legRows ?? 0) ? outfit.legs : null
  return outfit.feet ?? null
}

/** The ink of one zone cell under an outfit. */
function dressCell(outfit, ink, cell) {
  const [zone, tone] = ZONES[ink]
  if (zone === 'chest' && outfit.belt && cell.row === cell.rows - 1) {
    return MIDDLE.has(cell.x) ? MATERIALS.metal.light : MATERIALS[outfit.belt].base
  }
  if (zone === 'chest' && outfit.collar && cell.row === 0) return MATERIALS[outfit.collar].base
  if (zone === 'chest' && outfit.trim && MIDDLE.has(cell.x)) return MATERIALS[outfit.trim][tone]
  const material = materialFor(outfit, zone, cell)
  if (!material) return MATERIALS.skin[tone]
  const texture = outfit.texture && outfit.textured === material ? TEXTURES[outfit.texture] : null
  const textured = texture ? texture(cell.x, cell.y, tone, cell) : tone
  if (textured === 'skin') return MATERIALS.skin[tone]
  if (textured === 'dark') return MATERIALS.dark.base
  if (textured === 'stud') return MATERIALS.metal.light
  return MATERIALS[material][textured]
}

/** Where a cell is: its row in the region it belongs to, and whether it starts its run. */
function cellAt(grid, x, y, rig) {
  const [, torsoTop] = rig.anchors.torso
  const [, legsTop] = rig.anchors.legs
  const inLegs = y >= legsTop
  const top = inLegs ? legsTop : torsoTop
  const rows = inLegs ? rig.sizes.legs.height : rig.sizes.torso.height
  const left = grid[y][x - 1]
  return { x, y, row: y - top, rows, isLeftEdge: !left || !BODY_ZONE_INKS.has(left) }
}

/**
 * Closes the gap between the legs from the top for `skirt` rows, as a robe or a loincloth does,
 * with a ragged last row when the outfit asks for one.
 */
function closeSkirt(grid, outfit, rig) {
  const rows = outfit.skirt ?? 0
  if (!rows) return
  const [legsLeft, legsTop] = rig.anchors.legs
  const width = rig.sizes.legs.width
  const material = MATERIALS[outfit.legs ?? outfit.chest ?? 'cloth']
  for (let row = 0; row < Math.min(rows, rig.sizes.legs.height); row += 1) {
    const line = grid[legsTop + row]
    const filled = []
    for (let x = legsLeft; x < legsLeft + width; x += 1) if (line[x] !== '.') filled.push(x)
    if (filled.length === 0) continue
    const isHem = row === rows - 1 && outfit.hem === 'ragged'
    for (let x = filled[0]; x <= filled[filled.length - 1]; x += 1) {
      if (isHem && x % 2) continue
      if (line[x] === '.') line[x] = material.shade
    }
  }
}

/**
 * Dresses every zone cell of a grid in place. Without an outfit the body is bare skin.
 *
 * @param {string[][]} grid rows of single-character cells
 * @param {object | null} outfit
 * @param {object} rig a humanoid rig from monster-rigs.js
 */
export function dressBody(grid, outfit, rig) {
  const rules = outfit ?? {}
  if (rig.kind === 'humanoid') closeSkirt(grid, rules, rig)
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      const ink = grid[y][x]
      if (ZONES[ink]) {
        grid[y][x] = rig.kind === 'humanoid' ? dressCell(rules, ink, cellAt(grid, x, y, rig)) : bareInk(ink)
      }
    }
  }
}

/** A zone ink outside a humanoid: plain skin. */
const bareInk = (ink) => ZONE_INKS[ink]

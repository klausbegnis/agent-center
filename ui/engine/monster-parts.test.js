import { test } from 'node:test'
import assert from 'node:assert/strict'
import { composeLook } from './monster-compose.js'
import { inkColours, PART_INKS } from './monster-ink.js'
import { MONSTER_PARTS, PART_ID_COUNT, partById } from './monster-parts.js'
import { HEAD_SIZE, MONSTER_GRID, RIGS } from './monster-rigs.js'

const HUMANOID_RIGS = Object.keys(RIGS).filter((id) => RIGS[id].kind === 'humanoid')
const isRectangular = (rows) => rows.length > 0 && rows.every((row) => row.length === rows[0].length)

/** Every drawing of a part: its own rows, its pieces, and the ones it has per rig. */
function drawingsOf(part) {
  const sources = [part, ...Object.values(part.rigs ?? {})]
  return sources.flatMap((source) => (source.pieces ? source.pieces : source.rows ? [source] : []))
}

/** The parts of one slot that a humanoid rig can lay down. */
const humanoidParts = (slot, rigId) => Object.entries(MONSTER_PARTS)
  .filter(([, part]) => part.slot === slot && (slot === 'head' ? !part.at : part.rigs?.[rigId]))
  .map(([id, part]) => ({ id, rows: slot === 'head' ? part.rows : part.rigs[rigId].rows }))

/** The grid columns a row of a drawing fills, once laid at `left`. */
const filledColumns = (row, left) => [...row].flatMap((ink, index) => (ink === '.' ? [] : [left + index]))
const meets = (first, second) => first.some((column) => second.includes(column))

test('no two parts share an id, so none hides another', () => {
  assert.equal(Object.keys(MONSTER_PARTS).length, PART_ID_COUNT)
})

test('every drawing is a rectangle that uses only known inks', () => {
  for (const [id, part] of Object.entries(MONSTER_PARTS)) {
    for (const drawing of drawingsOf(part)) {
      assert.ok(isRectangular(drawing.rows), id)
      for (const ink of drawing.rows.join('')) assert.ok(PART_INKS.has(ink), `${id} uses "${ink}"`)
    }
  }
})

test('every part names its slot, and draws something, sets an outfit or paints a marking', () => {
  const slots = new Set(['head', 'torso', 'legs', 'outfit', 'headgear', 'held', 'extras', 'body', 'wings',
    'tail', 'abdomen', 'thorax', 'arms', 'roots', 'trunk', 'crown', 'face'])
  for (const [id, part] of Object.entries(MONSTER_PARTS)) {
    assert.ok(slots.has(part.slot), id)
    assert.ok(drawingsOf(part).length > 0 || part.outfit || part.paint, id)
  }
})

test('heads and headgear are drawn on the head grid, torsos and legs at their build\'s size', () => {
  for (const [id, part] of Object.entries(MONSTER_PARTS)) {
    if (part.slot === 'head' && !part.at) {
      assert.deepEqual([part.rows[0].length, part.rows.length], [HEAD_SIZE.width, HEAD_SIZE.height], id)
    }
    if (part.slot === 'headgear') assert.equal(part.rows[0].length, HEAD_SIZE.width, id)
    if (part.slot !== 'torso' && part.slot !== 'legs') continue
    for (const [rigId, drawing] of Object.entries(part.rigs ?? {})) {
      const size = RIGS[rigId].sizes[part.slot]
      assert.deepEqual([drawing.rows[0].length, drawing.rows.length], [size.width, size.height], id)
    }
  }
})

test('a held item is gripped by a fist on its grip pixel', () => {
  for (const [id, part] of Object.entries(MONSTER_PARTS)) {
    if (part.slot !== 'held') continue
    for (const piece of part.pieces) {
      const [x, y] = piece.grip
      if (piece.hand === 'off') continue
      assert.equal(piece.rows[y]?.[x], 'n', id)
    }
  }
})

test('every head, torso and legs of a build meet: neck, hips, and feet on the ground', () => {
  let combinations = 0
  for (const rigId of HUMANOID_RIGS) {
    const rig = RIGS[rigId]
    for (const head of humanoidParts('head', rigId)) {
      const neck = filledColumns(head.rows.at(-1), rig.anchors.head[0])
      for (const torso of humanoidParts('torso', rigId)) {
        const shoulders = filledColumns(torso.rows[0], rig.anchors.torso[0])
        const waist = filledColumns(torso.rows.at(-1), rig.anchors.torso[0])
        assert.equal(rig.anchors.head[1] + HEAD_SIZE.height, rig.anchors.torso[1], `${rigId} neck row`)
        assert.ok(meets(neck, shoulders), `${head.id} on ${torso.id}`)
        for (const legs of humanoidParts('legs', rigId)) {
          combinations += 1
          assert.equal(rig.anchors.torso[1] + torso.rows.length, rig.anchors.legs[1], `${rigId} hip row`)
          const hips = filledColumns(legs.rows[0], rig.anchors.legs[0])
          assert.ok(meets(waist, hips), `${torso.id} on ${legs.id}`)
          assert.equal(rig.anchors.legs[1] + legs.rows.length, MONSTER_GRID - 1, `${legs.id} on the ground`)
          assert.ok(filledColumns(legs.rows.at(-1), 0).length > 0, legs.id)
        }
      }
    }
  }
  assert.ok(combinations > 100, String(combinations))
})

test('every build\'s hands are in its torsos\' hand pixels, so held items sit in the hand', () => {
  for (const rigId of HUMANOID_RIGS) {
    const rig = RIGS[rigId]
    for (const torso of humanoidParts('torso', rigId)) {
      for (const [x, y] of Object.values(rig.hands)) {
        const ink = torso.rows[y - rig.anchors.torso[1]]?.[x - rig.anchors.torso[0]]
        assert.equal(ink, 'n', `${torso.id} at ${x},${y}`)
      }
    }
  }
})

const look = (parts, rig = 'humanoid-medium') => ({
  rig,
  parts,
  colours: { skin: '#6f8f3a', cloth: '#8c2f39', metal: '#8e959e', leather: '#6b4a2b', accent: '#d4a73a',
    bone: '#e8dcc0', hair: '#2e2622', eye: '#f0d040' }
})
const ORC = {
  head: 'orc-tusked', torso: 'medium-broad', legs: 'medium-straight', outfit: 'chain', headgear: 'helm',
  held: 'axe', extras: ['warpaint']
}

test('a look is drawn on the whole grid, the same every time, with a colour for every ink it uses', () => {
  const drawing = composeLook(look(ORC))
  assert.equal(drawing.rows.length, MONSTER_GRID)
  assert.ok(drawing.rows.every((row) => row.length === MONSTER_GRID))
  assert.deepEqual(composeLook(look(ORC)), drawing)
  for (const ink of drawing.rows.join('').replaceAll('.', '')) {
    assert.match(drawing.fills[ink], /^#[0-9a-f]{6}$/)
  }
})

test('an outfit leaves no zone ink behind, and dressing changes what the body shows', () => {
  const bare = composeLook(look({ ...ORC, outfit: 'none' }))
  const dressed = composeLook(look(ORC))
  for (const drawing of [bare, dressed]) assert.doesNotMatch(drawing.rows.join(''), /[tTuxXnyYz]/)
  assert.notDeepEqual(bare.rows, dressed.rows)
})

test('every shape is ringed with the outline', () => {
  const { rows } = composeLook(look(ORC))
  for (let y = 0; y < rows.length; y += 1) {
    for (let x = 0; x < rows[y].length; x += 1) {
      if (rows[y][x] !== '.') continue
      const neighbours = [rows[y - 1]?.[x], rows[y + 1]?.[x], rows[y][x - 1], rows[y][x + 1]]
      assert.ok(neighbours.every((ink) => ink === undefined || ink === '.' || ink === 'o'), `${x},${y}`)
    }
  }
})

test('a look on a rig this UI does not know is not drawn, and unknown parts are skipped', () => {
  assert.equal(composeLook(look(ORC, 'centaur')), null)
  assert.ok(composeLook(look({ ...ORC, held: 'laser-sword', extras: ['none'] })))
  assert.equal(partById('none'), null)
})

test('colours that are not plain hex colours never reach the drawing', () => {
  const fills = inkColours({ skin: 'url(#x)', eye: 'red' })
  for (const fill of Object.values(fills)) assert.match(fill, /^#[0-9a-f]{6}$/i)
})

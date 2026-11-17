import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ICON_GRID, ICON_INKS, iconColor, ICONS, iconPaths, slotIconId } from './game-icons.js'

const WORK = ['forge', 'lore', 'engineering', 'arcana', 'command']
const GATHERING = ['mining', 'fishing', 'farming', 'woodcutting', 'hunting', 'runecraft']
const MATERIALS = ['bars', 'pages', 'gears', 'crystals', 'seals', 'ore', 'fish', 'crops', 'logs', 'hides',
  'runes']
const CLASSES = ['physical', 'magical', 'defense', 'support']
const SLOTS = ['weapon-physical', 'weapon-magical', 'outfit', 'tool']
const UPGRADES = ['campfire', 'workbench', 'runeCircle']
const TABS = ['tab-rooms', 'tab-party', 'tab-chest']
const EVERY_ICON = [...WORK, ...GATHERING, ...MATERIALS, ...CLASSES, ...SLOTS, ...UPGRADES, ...TABS, 'star', 'coin']

/** How many pixels differ between two drawings, counting a pixel of another ink as different. */
const difference = (first, second) =>
  first.join('').split('').filter((pixel, index) => pixel !== second.join('')[index]).length

test('every skill, material, class, slot, group upgrade, game tab, the star and the coin have an icon', () => {
  for (const id of EVERY_ICON) assert.ok(ICONS[id], id)
  assert.equal(Object.keys(ICONS).length, EVERY_ICON.length)
})

test('every icon is a full square on its grid, in its own inks, with a colour for each', () => {
  for (const [id, icon] of Object.entries(ICONS)) {
    assert.equal(icon.rows.length, ICON_GRID, id)
    assert.ok(icon.rows.every((row) => row.length === ICON_GRID), id)
    const inks = new Set(icon.rows.join('').replaceAll('.', ''))
    for (const ink of inks) {
      assert.ok(ICON_INKS.includes(ink), `${id} uses ${ink}`)
      assert.match(icon.colors[ink], /^#[0-9A-F]{6}$/i, `${id} has a colour for ${ink}`)
    }
  }
})

test('no two icons look alike: each differs from every other in shape or in colour', () => {
  const entries = Object.entries(ICONS)
  for (const [index, [id, icon]] of entries.entries()) {
    for (const [otherId, other] of entries.slice(index + 1)) {
      const sameColors = JSON.stringify(icon.colors) === JSON.stringify(other.colors)
      const shapeGap = difference(icon.rows, other.rows)
      assert.ok(shapeGap >= 12 && !(sameColors && shapeGap < 30), `${id} and ${otherId} look alike`)
    }
  }
})

test('a weapon is drawn by its damage type, other slots by their slot', () => {
  assert.equal(slotIconId('weapon', 'magical'), 'weapon-magical')
  assert.equal(slotIconId('weapon', 'physical'), 'weapon-physical')
  assert.equal(slotIconId('outfit'), 'outfit')
})

test('an icon becomes one coloured path per ink, and an unknown id draws nothing', () => {
  const drawn = iconPaths('forge')
  assert.equal(drawn.viewBox, '0 0 10 10')
  assert.deepEqual(drawn.paths.map((path) => path.color), ['#F8D56B', '#C96A42'])
  assert.equal(iconPaths('constructor'), null)
})

test('an icon gives its main colour to what goes with it', () => {
  assert.equal(iconColor('forge'), '#F8D56B')
  assert.equal(iconColor('constructor'), null)
})

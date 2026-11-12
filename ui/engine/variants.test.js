import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hash } from './hash.js'
import { assignVariants, lookFor, variantFor } from './variants.js'

const theme = {
  room: { background: 'room.svg' },
  actors: { outfits: [[], ['scarf'], ['cap']], outfitColors: ['#111', '#222'] }
}
const rooms = (count) => Array.from({ length: count }, (_, index) => ({ id: `host:/work/project-${index}` }))

test('the hash is stable and differs between ids', () => {
  assert.equal(hash('room-a'), hash('room-a'))
  assert.notEqual(hash('room-a'), hash('room-b'))
})

test('a room always gets the same variant', () => {
  const room = { id: 'local:/work/storefront' }
  assert.deepEqual(variantFor(theme, room), variantFor(theme, room))
})

test('a theme can turn mirroring off and offer several sceneries', () => {
  const custom = { room: { background: 'a.svg', backgrounds: ['a.svg', 'b.svg'], variants: { flip: false } } }
  for (const room of rooms(12)) {
    const variant = variantFor(custom, room)
    assert.equal(variant.flip, false)
    assert.ok(['a.svg', 'b.svg'].includes(variant.background))
  }
})

test('rooms are kept apart on the colour wheel', () => {
  const variants = [...assignVariants(rooms(6), () => theme).values()]
  for (let i = 0; i < variants.length; i++) {
    for (let j = i + 1; j < variants.length; j++) {
      const difference = Math.abs(variants[i].hue - variants[j].hue) % 360
      assert.ok(Math.min(difference, 360 - difference) >= 40, `${variants[i].hue} vs ${variants[j].hue}`)
    }
  }
})

test("with a theme's own hue list, each entry is used once while there are enough", () => {
  const custom = { room: { background: 'room.svg', variants: { hues: [0, 20, 40, 60] } } }
  const hues = [...assignVariants(rooms(4), () => custom).values()].map((variant) => variant.hue)
  assert.deepEqual([...hues].sort((a, b) => a - b), [0, 20, 40, 60])
})

test('the result does not depend on the order the rooms arrive in', () => {
  const list = rooms(5)
  const forward = assignVariants(list, () => theme)
  const backward = assignVariants([...list].reverse(), () => theme)
  for (const room of list) assert.deepEqual(forward.get(room.id), backward.get(room.id))
})

test('rooms whose theme is not loaded are skipped', () => {
  assert.equal(assignVariants(rooms(3), () => undefined).size, 0)
})

test("an agent's look is stable and drawn from the theme", () => {
  const look = lookFor(theme, 'pane-1')
  assert.deepEqual(look, lookFor(theme, 'pane-1'))
  assert.ok(theme.actors.outfits.some((outfit) => outfit === look.outfit))
  assert.ok(theme.actors.outfitColors.includes(look.outfitColor))
  assert.ok(Math.abs(look.hue) <= 28)
})

test('a theme without outfits gives none', () => {
  assert.deepEqual(lookFor({ actors: { hueShift: 0 } }, 'pane-1'), { outfit: [], outfitColor: null, hue: 0 })
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evenGrid, GALLERY_GAP, pinnedGrid, ROOM_HEAD } from './gallery.js'

const ASPECT = 8 / 5

function fits(grid, count, width, height) {
  const roomHeight = grid.size / ASPECT + ROOM_HEAD
  const usedWidth = grid.columns * grid.size + GALLERY_GAP * (grid.columns - 1)
  const usedHeight = grid.rows * roomHeight + GALLERY_GAP * (grid.rows - 1)
  return grid.columns * grid.rows >= count && usedWidth <= width + 1 && usedHeight <= height + 1
}

test('a wide space puts rooms side by side, a tall one stacks them', () => {
  assert.equal(evenGrid(2, 1600, 500, ASPECT).columns, 2)
  assert.equal(evenGrid(2, 500, 1600, ASPECT).columns, 1)
})

test('every room fits in the space, for many shapes and counts', () => {
  for (const [width, height] of [[1440, 820], [500, 1000], [1000, 500], [1920, 1080]]) {
    for (let count = 1; count <= 9; count++) {
      const grid = evenGrid(count, width, height, ASPECT)
      assert.ok(fits(grid, count, width, height), `${count} rooms in ${width}x${height}`)
    }
  }
})

test('no other column count would give larger rooms', () => {
  const best = evenGrid(6, 1440, 820, ASPECT)
  for (let columns = 1; columns <= 6; columns++) {
    const rows = Math.ceil(6 / columns)
    const cellWidth = (1440 - GALLERY_GAP * (columns - 1)) / columns
    const cellHeight = (820 - GALLERY_GAP * (rows - 1)) / rows
    assert.ok(Math.min(cellWidth, (cellHeight - ROOM_HEAD) * ASPECT) <= best.size + 1)
  }
})

test('a pinned room is larger than the rooms in the strip', () => {
  const grid = pinnedGrid(5, 1440, 820, ASPECT)
  assert.equal(grid.stripColumns, 5)
  assert.ok(grid.pinnedSize > grid.stripSize * 2)
})

test('a pinned room alone takes the whole space', () => {
  const grid = pinnedGrid(0, 1000, 700, ASPECT)
  assert.equal(grid.pinnedShare, 1)
  assert.equal(grid.pinnedSize, evenGrid(1, 1000, 700, ASPECT).size)
})

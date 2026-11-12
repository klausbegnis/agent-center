// Sizing for Gallery view: how to fit every room in the space there is, with no scrolling.
// Pure arithmetic, so it is unit tested.

export const GALLERY_GAP = 12
/** Height of a room's title row. */
export const ROOM_HEAD = 24
const MIN_ROOM_SIZE = 80
/** Share of the height the pinned room's row takes when a room is pinned. */
const PINNED_SHARE = 0.72

/** The widest a room can be in a cell: limited by the cell's width or by its height. */
function fitWidth(cellWidth, cellHeight, aspect) {
  return Math.max(MIN_ROOM_SIZE, Math.floor(Math.min(cellWidth, (cellHeight - ROOM_HEAD) * aspect)))
}

/**
 * The grid that gives equally sized rooms the largest size.
 *
 * @returns {{ columns: number, rows: number, size: number }} size is a room's width in px
 */
export function evenGrid(count, width, height, aspect) {
  let best = { columns: 1, rows: Math.max(1, count), size: 0 }
  for (let columns = 1; columns <= Math.max(1, count); columns++) {
    const rows = Math.ceil(count / columns)
    const cellWidth = (width - GALLERY_GAP * (columns - 1)) / columns
    const cellHeight = (height - GALLERY_GAP * (rows - 1)) / rows
    const size = fitWidth(cellWidth, cellHeight, aspect)
    if (size > best.size) best = { columns, rows, size }
  }
  return best
}

/**
 * One room pinned large on top, the others in a single strip below.
 *
 * @param {number} others how many rooms share the strip
 * @returns {{ pinnedSize: number, stripSize: number, stripColumns: number, pinnedShare: number }}
 */
export function pinnedGrid(others, width, height, aspect) {
  if (others === 0) {
    return { pinnedSize: fitWidth(width, height, aspect), stripSize: 0, stripColumns: 1, pinnedShare: 1 }
  }
  const pinnedHeight = (height - GALLERY_GAP) * PINNED_SHARE
  const stripHeight = height - GALLERY_GAP - pinnedHeight
  const stripCellWidth = (width - GALLERY_GAP * (others - 1)) / others
  return {
    pinnedSize: fitWidth(width, pinnedHeight, aspect),
    stripSize: fitWidth(stripCellWidth, stripHeight, aspect),
    stripColumns: others,
    pinnedShare: PINNED_SHARE
  }
}

// Where characters stand, and which look a theme gives each kind of agent.

/**
 * Every room is drawn at this width / height, whatever the theme, so rooms are all the same
 * size. A theme's own room.width and room.height are only its coordinate units.
 */
export const ROOM_ASPECT = 8 / 5

/** An activity with no station of its own in the theme falls back to these, in order. */
const STATION_FALLBACK = { delegate: ['think', 'idle'], think: ['idle'], run: ['write'], read: ['write'] }

/** Extra characters at a full station stand this fraction of a character width apart. */
const QUEUE_SPACING = 0.9
/** Each further row of a queue moves up by this fraction of a character height. */
const QUEUE_ROW_RISE = 0.55
/** Alternate queue positions are nudged down a little so the line does not look ruled. */
const QUEUE_STAGGER = 4

/** The slots a theme offers for an activity, after fallbacks. Never empty. */
export function stationFor(theme, activity) {
  const stations = theme.stations ?? {}
  for (const name of [activity, ...(STATION_FALLBACK[activity] ?? []), 'idle']) {
    if (Array.isArray(stations[name]) && stations[name].length) return stations[name]
  }
  return [{ x: theme.room.width / 2, y: theme.room.height * 0.8 }]
}

/**
 * Where the i-th character at a station stands. Beyond the theme's slots, extras queue to the
 * left of the last one and move up a row when the room runs out.
 */
export function slotPoint(theme, slots, index) {
  if (index < slots.length) return slots[index]
  const last = slots[slots.length - 1]
  const step = theme.actors.width * QUEUE_SPACING
  const margin = theme.actors.width / 2
  const perRow = Math.max(1, Math.floor((last.x - margin) / step))
  const extra = index - slots.length
  const column = (extra % perRow) + 1
  const row = Math.floor(extra / perRow)
  return {
    x: last.x - column * step,
    y: last.y - row * theme.actors.height * QUEUE_ROW_RISE + (column % 2 ? QUEUE_STAGGER : 0)
  }
}

/** The species whose key appears in the agent kind, or the theme's default. */
export function speciesFor(theme, kind) {
  const species = theme.actors.species ?? {}
  const wanted = String(kind ?? '').toLowerCase()
  const match = Object.keys(species).find((name) => name !== 'default' && wanted.includes(name))
  return species[match ?? 'default'] ?? Object.values(species)[0] ?? {}
}

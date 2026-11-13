// Where the fight is drawn in a room: a band along the top edge, above every station a theme
// has, so the monster never stands on a character and the agent card at the bottom stays clear.
// Never touches the DOM.

/** The band never gets thinner than this share of the room's height, so the fight stays legible. */
export const BAND_MIN = 0.14
/** Nor taller than this, so a theme whose stations sit low does not get a crowded top. */
export const BAND_MAX = 0.22
/** Room above a character's head kept for its "?" or "!" bubble, as a share of the room's height. */
const BUBBLE_ALLOWANCE = 0.04
/** Stations a character only passes through do not limit the band. */
const PASSING_STATIONS = new Set(['enter'])

/** How tall a monster is drawn, as a share of the band: a boss fills it, an elite stands out. */
const MONSTER_SIZE = { common: 0.8, elite: 0.9, boss: 1 }

/**
 * The share of the room's height, from the top, that the fight may use: the space above the
 * highest head at any of the theme's stations, less room for a bubble, within BAND_MIN and
 * BAND_MAX.
 *
 * @param {{ room: { height: number }, actors: { height: number }, stations?: object }} theme
 */
export function bandHeight(theme) {
  const heads = Object.entries(theme.stations ?? {})
    .filter(([name, slots]) => !PASSING_STATIONS.has(name) && Array.isArray(slots))
    .flatMap(([, slots]) => slots)
    .map((slot) => (slot.y - theme.actors.height) / theme.room.height)
  if (heads.length === 0) return BAND_MAX
  const free = Math.min(...heads) - BUBBLE_ALLOWANCE
  return Math.min(BAND_MAX, Math.max(BAND_MIN, free))
}

/**
 * How large a monster is drawn, as a share of the band's height.
 *
 * @param {{ kind: string, affix: string | null }} monster
 */
export function monsterSize(monster) {
  if (monster.kind === 'boss') return MONSTER_SIZE.boss
  return monster.affix ? MONSTER_SIZE.elite : MONSTER_SIZE.common
}

// Generated monsters: a race from game/races.json dressed by hash in parts and colours, with a
// name that says what is drawn, and the fixed named bosses of game/bosses.json. Looks and names
// only; health, reward and loot come from monsters.mjs. Pure: the same text always gives the
// same monster.
import { hashOf } from './hash.mjs'

/** The colours a look carries, by role; the UI paints a part's inks from them. */
export const PALETTE_ROLES = ['skin', 'cloth', 'metal', 'leather', 'accent', 'bone', 'hair', 'eye']

/** The slots of each rig a race fills, extras aside. */
export const RIG_SLOTS = {
  humanoid: ['head', 'torso', 'legs', 'outfit', 'headgear', 'held'],
  dragon: ['body', 'head', 'wings', 'tail'],
  spider: ['legs', 'abdomen', 'head'],
  insect: ['head', 'thorax', 'abdomen', 'wings'],
  golem: ['legs', 'torso', 'arms', 'head'],
  treant: ['roots', 'trunk', 'crown', 'face'],
  slime: ['body', 'face'],
  ghost: ['body', 'face'],
  elemental: ['body', 'face']
}
export const HUMANOID_BUILDS = ['small', 'medium', 'large']

/**
 * A monster entry made for the room's theme (one with `themes`) shows as itself this share of
 * the time and as a generated monster otherwise, so a room keeps its local flavour while the
 * races fill the rest. Generic entries only lend their loot.
 */
export const HANDMADE_SHARE = 0.3
/** A race that prefers the room's theme is this many times as likely as any other. */
export const PREFERRED_RACE_WEIGHT = 3
/** The race of the week's event (weekly.mjs) comes up this many times as often as it would. */
export const FEATURED_RACE_WEIGHT = 2
/** A generated monster carries up to this many extras of its own choosing, besides `always`. */
export const EXTRAS_MAX = 2
/**
 * One humanoid in this many is a chimera: its head or its legs come from another race of the
 * same build. It is named for it ("Chimeric Orc Brute") so the odd look reads as meant.
 */
export const CHIMERA_ONE_IN = 30
export const CHIMERA_WORD = 'Chimeric'
/** The part id that draws nothing, so a list can make a bare head or empty hands likely. */
export const NO_PART = 'none'

/** The rig id a look is drawn on: a humanoid's carries its build. */
export const rigIdOf = (race) => (race.rig === 'humanoid' ? `humanoid-${race.build}` : race.rig)

/**
 * hashOf's low bits follow the last characters of its text closely, so seeds that differ only
 * in a trailing count would pick in a visible rhythm. This finishing mix (the one MurmurHash3
 * ends with) spreads every bit over all the others.
 */
function mixed(text) {
  let hash = hashOf(text)
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b)
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35)
  return (hash ^ (hash >>> 16)) >>> 0
}

/** A pick by hash, so each purpose of one seed is independent of the others. */
const pick = (list, seed, purpose) => list[mixed(`${seed}|${purpose}`) % list.length]
const chance = (seed, purpose) => mixed(`${seed}|${purpose}`) / 4294967296

/**
 * The race of a generated monster: every race can come up, the room theme's own ones more often,
 * and the race of the week's event (weekly.mjs) FEATURED_RACE_WEIGHT times as often as it would.
 */
function raceFor(races, themeId, seed, featuredRace = null) {
  const weighted = races.flatMap((race) => {
    const themed = themeId && race.themes?.includes(themeId) ? PREFERRED_RACE_WEIGHT : 1
    const weight = race.id === featuredRace ? themed * FEATURED_RACE_WEIGHT : themed
    return Array(weight).fill(race)
  })
  return pick(weighted, seed, 'race')
}

/** A role's own choices for a list, where they are among the race's; otherwise the race's. */
function narrowed(raceList, roleList) {
  const kept = (roleList ?? []).filter((id) => raceList.includes(id))
  return kept.length ? kept : raceList
}

/** The palette entries a role of a race picks a colour from. */
function paletteFor(data, race, role, paletteRole) {
  const entries = race.palettes?.[paletteRole] ?? data.palettes[paletteRole]
  const only = role.palettes?.[paletteRole]
  if (!only) return entries
  const ids = narrowed(entries.map((entry) => entry.id), only)
  return ids.map((id) => entries.find((entry) => entry.id === id))
}

/** Extras: the race's `always`, then up to EXTRAS_MAX distinct ones from the role's or race's list. */
function extrasFor(race, role, seed) {
  const choices = narrowed(race.parts.extras ?? [], role.extras)
  const count = choices.length ? mixed(`${seed}|extras`) % (EXTRAS_MAX + 1) : 0
  const chosen = []
  for (let index = 0; chosen.length < count && index < count * 4; index += 1) {
    const extra = pick(choices, seed, `extra-${index}`)
    if (!chosen.includes(extra)) chosen.push(extra)
  }
  return [...(race.always ?? []), ...chosen]
}

/**
 * Swaps the head or the legs for another race's of the same build, one time in CHIMERA_ONE_IN.
 * Only parts the race could not have itself are grafted, so a chimera always shows it.
 */
function chimeraOf(races, race, parts, seed) {
  if (race.rig !== 'humanoid' || chance(seed, 'chimera') >= 1 / CHIMERA_ONE_IN) return null
  const grafts = races
    .filter((other) => other !== race && other.rig === 'humanoid' && other.build === race.build)
    .flatMap((donor) => ['head', 'legs'].flatMap((slot) =>
      donor.parts[slot].filter((id) => !race.parts[slot].includes(id)).map((id) => ({ slot, id }))))
  if (!grafts.length) return null
  const graft = pick(grafts, seed, 'graft')
  return { ...parts, [graft.slot]: graft.id }
}

/** "Bog Troll Brute": mark or chimera word, descriptor, noun and role, the empty ones left out. */
function nameOf({ race, role, descriptor, rank, isChimera, seed }) {
  const lead = isChimera ? CHIMERA_WORD : descriptor
  const mark = rank === 'champion' ? pick(race.marks, seed, 'mark') : ''
  return [mark, lead, role.noun ?? race.noun, role.word].filter((word) => word).join(' ')
}

/**
 * A generated monster's race, name and look.
 *
 * @param {{ palettes: object, races: object[] }} data a valid races file
 * @param {{ seed: string, themeId?: string | null, rank?: string, featuredRace?: string | null }} options
 * @returns {{ race: string, name: string, look: { rig: string, parts: object, colours: object } }}
 */
export function generateMonster(data, { seed, themeId = null, rank = 'normal', featuredRace = null }) {
  const race = raceFor(data.races, themeId, seed, featuredRace)
  const role = pick(race.roles, seed, 'role')
  let parts = {}
  for (const slot of RIG_SLOTS[race.rig]) {
    parts[slot] = pick(narrowed(race.parts[slot], role[slot]), seed, slot)
  }
  const chimera = chimeraOf(data.races, race, parts, seed)
  parts = { ...(chimera ?? parts), extras: extrasFor(race, role, seed) }
  const colours = {}
  const chosen = {}
  for (const paletteRole of PALETTE_ROLES) {
    chosen[paletteRole] = pick(paletteFor(data, race, role, paletteRole), seed, `colour-${paletteRole}`)
    colours[paletteRole] = chosen[paletteRole].colour
  }
  const descriptor = chosen[role.descriptor ?? race.descriptor ?? 'skin'].word ?? ''
  const name = nameOf({ race, role, descriptor, rank, isChimera: Boolean(chimera), seed })
  return { race: race.id, name, look: { rig: rigIdOf(race), parts, colours } }
}

/**
 * The boss of a boss wave. Each project meets the roster in an order of its own, one boss per
 * boss wave, so it meets every boss once before any comes back.
 *
 * @param {{ bosses: object[] }} roster a valid bosses file
 * @param {{ palettes: object, races: object[] }} data the races the bosses belong to
 * @param {{ worldId: string, projectId: string, bossNumber: number }} where `bossNumber` counts
 *   the boss waves, wave / BOSS_EVERY
 * @returns {{ id: string, race: string, name: string, look: object }}
 */
export function bossFor(roster, data, { worldId, projectId, bossNumber }) {
  const order = [...roster.bosses].sort((first, second) =>
    mixed(`${worldId}|${projectId}|${first.id}`) - mixed(`${worldId}|${projectId}|${second.id}`) ||
    first.id.localeCompare(second.id))
  const boss = order[bossNumber % order.length]
  const race = data.races.find((each) => each.id === boss.race)
  const parts = { ...boss.parts, extras: [...(boss.parts.extras ?? [])] }
  return {
    id: boss.id,
    race: boss.race,
    name: `${boss.name}, ${boss.epithet}`,
    look: { rig: rigIdOf(race), parts, colours: { ...boss.colours } }
  }
}

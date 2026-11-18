// Traits as the screens need them, worked out from the view state: the catalogue by id, a
// character's slots (carried, free, still locked), a room's scrolls, and what a free slot or a swap
// can take. Never touches the DOM; the worker checks every choice again.

/**
 * The catalogue's traits by id, each with its tier's name and colour, or an empty map without traits.
 *
 * @param {object} game the view state's `game`
 * @returns {Map<string, object>}
 */
export function traitEntries(game) {
  const catalogue = game?.traits
  if (!catalogue) return new Map()
  const tiers = new Map(catalogue.tiers.map((tier) => [tier.id, tier]))
  return new Map(catalogue.entries.map((entry) => [entry.id, {
    ...entry,
    tierName: tiers.get(entry.tier)?.name ?? entry.tier,
    colour: tiers.get(entry.tier)?.colour ?? null,
    tierRank: catalogue.tiers.findIndex((tier) => tier.id === entry.tier)
  }]))
}

/**
 * A character's trait slots in order: each trait it carries, its free slots, then the slots it earns
 * later with the level each opens at.
 *
 * @param {{ traits?: { carried: string[], slots: number, born?: string } | null }} character
 * @param {Map<string, object>} entries from `traitEntries`
 * @param {number[]} slotLevels the levels the slots after the first open at
 * @returns {({ kind: 'trait', entry: object, isBorn: boolean } | { kind: 'free' } | { kind: 'locked', level: number })[]}
 */
export function traitSlotsOf(character, entries, slotLevels = []) {
  const traits = character?.traits
  if (!traits) return []
  const carried = traits.carried.filter((id) => entries.has(id))
    .map((id) => ({ kind: 'trait', entry: entries.get(id), isBorn: id === traits.born }))
  const free = Array.from({ length: Math.max(0, traits.slots - carried.length) }, () => ({ kind: 'free' }))
  const locked = slotLevels.slice(Math.max(0, traits.slots - 1)).map((level) => ({ kind: 'locked', level }))
  return [...carried, ...free, ...locked]
}

/**
 * A room's scrolls, the best tier first, then by name.
 *
 * @param {object} game
 * @param {string} roomId
 * @param {Map<string, object>} entries
 * @returns {{ entry: object, count: number }[]}
 */
export function roomScrolls(game, roomId, entries) {
  return (game?.rooms?.[roomId]?.scrolls ?? [])
    .filter((scroll) => entries.has(scroll.traitId) && scroll.count > 0)
    .map((scroll) => ({ entry: entries.get(scroll.traitId), count: scroll.count }))
    .sort((a, b) => b.entry.tierRank - a.entry.tierRank || a.entry.name.localeCompare(b.entry.name))
}

/**
 * The scrolls a character could take, in a free slot or in place of one it carries: those of a
 * trait it does not carry already.
 *
 * @param {{ traits?: { carried: string[] } | null }} character
 * @param {{ entry: object, count: number }[]} scrolls
 */
export function scrollChoices(character, scrolls) {
  const carried = new Set(character?.traits?.carried ?? [])
  return scrolls.filter((scroll) => !carried.has(scroll.entry.id))
}

/**
 * What swapping a trait out costs in a world, and whether the world can pay it.
 *
 * @param {object | null} world the view state's world
 * @param {object} entry the trait taken out
 * @returns {{ fee: number, canPay: boolean }}
 */
export function swapCost(world, entry) {
  const fee = world?.traits?.swapFees?.[entry.tier] ?? 0
  return { fee, canPay: (world?.coins ?? 0) >= fee }
}

/**
 * How much of the catalogue a world has collected.
 *
 * @param {object | null} world
 * @param {object} game
 * @returns {{ known: number, total: number } | null} null without traits
 */
export function collection(world, game) {
  if (!game?.traits || !world?.traits) return null
  return { known: world.traits.known.length, total: game.traits.total }
}

/**
 * The agent card's traits of an agent's character: each trait it carries, or null when it has none
 * to show (no game, a guest, a game without traits).
 *
 * @param {object | null} state the view state
 * @param {{ id: string }} agent
 * @returns {object[] | null}
 */
export function agentTraits(state, agent) {
  const character = state?.game?.characters?.[agent?.id]
  if (!character?.traits) return null
  const entries = traitEntries(state.game)
  const carried = character.traits.carried.filter((id) => entries.has(id)).map((id) => entries.get(id))
  return carried.length ? carried : null
}

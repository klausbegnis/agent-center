// What the surfaces show of legendary loot, worked out from the view state: where an item's
// picture is, a room's Relics card (the active relic, the owned ones and the empty slots), its
// active relic, and a legendary item's entry. Never touches the DOM.
import { effectText } from './legendary-labels.js'

/** Where the pictures are, under the plugin folder; each surface puts its own base in front. */
const ART_FOLDER = 'ui/art/legendary/'
/** The Relics card shows its slots in rows of this many, the columns of a 380 px panel. */
export const RELIC_SLOTS_PER_ROW = 6

/**
 * The picture of a legendary entry, or of a frame.
 *
 * @param {string} base the transport's base, '../' in the panel and '/' in the external view
 * @param {string} id an entry id, or 'frame-slot' / 'frame-active-relic'
 * @param {{ glow?: boolean }} [options] the picture with its glow
 */
export const legendaryArtUrl = (base, id, { glow = false } = {}) => `${base ?? ''}${ART_FOLDER}${id}${glow ? '-glow' : ''}.png`

/**
 * The content entry of a legendary id, as the view state sends it, or null.
 *
 * @param {object | undefined} game the view state's game
 * @param {string | null | undefined} id
 */
export const legendaryEntry = (game, id) => (id ? game?.legendary?.entries?.[id] ?? null : null)

/**
 * A chest item's legendary entry, or null for a plain item.
 *
 * @param {object | undefined} game
 * @param {{ legendary?: boolean, entryId?: string } | null} item
 */
export const itemLegendary = (game, item) => (item?.legendary ? legendaryEntry(game, item.entryId) : null)

/** An entry with its buff in words. */
const described = (entry) => ({ ...entry, text: effectText(entry.effect, entry.slot) })

/**
 * The room's active relic with its buff in words, or null.
 *
 * @param {object | undefined} game
 * @param {string} roomId
 */
export function activeRelic(game, roomId) {
  const entry = legendaryEntry(game, game?.rooms?.[roomId]?.relics?.active)
  return entry ? described(entry) : null
}

/**
 * What the Relics card shows for a room: the active relic, the owned ones in the order they were
 * found (each with whether it is active), how many empty slots follow them, and the counts. Null
 * when the game has no legendary loot or the room has not joined.
 *
 * @param {object | undefined} game
 * @param {string} roomId
 * @returns {null | { active: object | null, owned: object[], emptySlots: number, count: number, total: number }}
 */
export function relicsCard(game, roomId) {
  const room = game?.rooms?.[roomId]
  if (!game?.legendary || !room?.joined) return null
  const relics = room.relics ?? { owned: [], active: null }
  const owned = relics.owned.map((id) => legendaryEntry(game, id)).filter(Boolean)
    .map((entry) => ({ ...described(entry), isActive: entry.id === relics.active }))
  const total = game.legendary.relicCount ?? owned.length
  const rows = Math.max(1, Math.ceil((owned.length + 1) / RELIC_SLOTS_PER_ROW))
  const slots = Math.min(Math.max(total, owned.length), rows * RELIC_SLOTS_PER_ROW)
  return {
    active: owned.find((entry) => entry.isActive) ?? null,
    owned,
    emptySlots: Math.max(0, slots - owned.length),
    count: owned.length,
    total
  }
}

/**
 * A legendary item's details: its entry with the buff in words. Null for a plain item.
 *
 * @param {object | undefined} game
 * @param {object | null} item a chest item or an equipped one
 */
export function legendaryDetails(game, item) {
  const entry = itemLegendary(game, item)
  return entry ? described(entry) : null
}

/**
 * The relic a city's stall offers the room a purchase goes to, with what stops buying it: null
 * when the stall has no relic today. `block` is one of 'viewOnly', 'sold', 'noRoom', 'owned' (the
 * room owns the city's relics), 'coins', or null when it can be bought.
 *
 * @param {object | undefined} game
 * @param {{ relic?: { index: number, price: number, sold: boolean, byRoom: Record<string, string | null> } }} city
 * @param {{ roomId: string | null, coins: number, canBuy: boolean }} buyer
 */
export function stallRelic(game, city, { roomId, coins, canBuy }) {
  const offer = city.relic
  if (!offer) return null
  // Once sold, the room would be offered the city's other relic: the row says it was sold instead.
  const offeredId = roomId ? offer.byRoom[roomId] ?? null : Object.values(offer.byRoom).find(Boolean) ?? null
  const entry = offer.sold ? null : legendaryEntry(game, offeredId)
  const blocks = [
    [!canBuy, 'viewOnly'], [offer.sold, 'sold'], [!roomId, 'noRoom'], [!entry, 'owned'], [coins < offer.price, 'coins']
  ]
  return {
    index: offer.index,
    price: offer.price,
    entry: entry ? described(entry) : null,
    block: blocks.find(([applies]) => applies)?.[1] ?? null
  }
}

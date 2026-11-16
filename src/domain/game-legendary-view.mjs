// The legendary part of the game's view state: the content entries a UI needs to draw what the
// rooms own, what their characters hold and what dropped lately, and nothing more, so the state
// stays small. Pure.

/** Every legendary id the state refers to: owned relics, legendary items shown, recent drops. */
function referencedIds({ rooms, characters, recent }) {
  const ids = new Set()
  for (const room of Object.values(rooms)) {
    for (const id of room.relics?.owned ?? []) ids.add(id)
    for (const item of room.chest ?? []) if (item.legendary) ids.add(item.entryId)
  }
  for (const character of Object.values(characters)) {
    for (const item of Object.values(character.equipment ?? {})) if (item?.legendary) ids.add(item.entryId)
  }
  for (const event of recent) if (event.type === 'legendary') ids.add(event.item)
  return ids
}

/**
 * The game's `legendary`: how many relics and pieces of equipment the content has (for the
 * hints of empty slots) and the entries the state refers to, by id. Null without legendary loot.
 *
 * @param {{ relicCount: number, equipmentCount: number, entries: Record<string, object> } | null | undefined} legendary
 *   the engine's view of the content
 * @param {{ rooms: Record<string, object>, characters: Record<string, object>, recent: object[] }} shown
 */
export function legendaryShown(legendary, shown) {
  if (!legendary) return null
  const entries = {}
  for (const id of referencedIds(shown)) if (legendary.entries[id]) entries[id] = legendary.entries[id]
  return { relicCount: legendary.relicCount, equipmentCount: legendary.equipmentCount, entries }
}

/**
 * A legendary drop's event with the name and kind a UI shows.
 *
 * @param {{ item: string }} event
 * @param {{ entries: Record<string, { name: string, kind: string }> } | null | undefined} legendary
 */
export function describeLegendaryDrop(event, legendary) {
  const entry = legendary?.entries[event.item]
  return entry ? { ...event, name: entry.name, kind: entry.kind } : event
}

/**
 * A chest item's legendary marks, kept when the item is shown.
 *
 * @param {{ legendary?: boolean, entryId?: string }} item
 */
export const legendaryMarks = (item) => (item.legendary ? { legendary: true, entryId: item.entryId } : {})

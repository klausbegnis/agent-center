// The bestiary's part of the game's view state: a bestiary event with the name a UI shows, and the
// legendary items the bestiary's boss cards hint at. Pure.

/**
 * A bestiary event with what a UI says of it: the race's name, or the boss's name and epithet.
 *
 * @param {{ kind: string, id?: string }} event
 * @param {{ races: { id: string, name: string }[], bosses: { id: string, name: string, epithet: string }[] }
 *   | null | undefined} bestiary the content's bestiary, as the engine's view gives it
 * @returns {object}
 */
export function describeBestiaryEvent(event, bestiary) {
  if (event.kind === 'race') {
    const race = bestiary?.races.find((entry) => entry.id === event.id)
    return race ? { ...event, name: race.name } : event
  }
  if (event.kind === 'boss') {
    const boss = bestiary?.bosses.find((entry) => entry.id === event.id)
    return boss ? { ...event, name: `${boss.name}, ${boss.epithet}` } : event
  }
  return event
}

/**
 * The legendary items found that the bestiary's boss cards show, so the state names them.
 *
 * @param {{ bestiary?: { bosses: { item: string | null, found: boolean }[] } | null }[]} worlds
 * @returns {string[]}
 */
export function bestiaryItemIds(worlds) {
  return worlds.flatMap((world) => (world.bestiary?.bosses ?? []).filter((boss) => boss.found).map((boss) => boss.item))
}

// The bestiary's part of the game's view state: a bestiary event with the name a UI shows, and the
// legendary items the bestiary's boss cards hint at. Pure.

/**
 * A bestiary event with what a UI says of it: the race's name (and, for a level past the powered
 * ones, its title and prestige rank), or the boss's name and epithet.
 *
 * @param {{ kind: string, creatureId?: string, level?: number }} event
 * @param {{ races: { id: string, name: string, title?: string }[], levels?: number,
 *   bosses: { id: string, name: string, epithet: string }[] } | null | undefined} bestiary the
 *   content's bestiary, as the engine's view gives it
 * @returns {object}
 */
export function describeBestiaryEvent(event, bestiary) {
  if (event.kind === 'race') {
    const race = bestiary?.races.find((entry) => entry.id === event.creatureId)
    if (!race) return event
    const prestige = event.level && bestiary.levels ? event.level - bestiary.levels : 0
    return prestige > 0 ? { ...event, name: race.name, title: race.title, prestige } : { ...event, name: race.name }
  }
  if (event.kind === 'boss') {
    const boss = bestiary?.bosses.find((entry) => entry.id === event.creatureId)
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

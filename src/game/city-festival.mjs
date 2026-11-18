// A city's festival week: when the world's weekly event is a city's festival (game/events.json), that
// city's market takes a smaller fee for the week (city-ranks.mjs, cityFeeOf). The city entries a
// world trades with carry `festival: true` for the festival's city, so the price functions, which
// see only the world and the city, quote the festival's fee. Pure.
import { eventOfWorld } from './weekly.mjs'

/**
 * The city that holds its festival in the world's week, or null.
 *
 * @param {object | null | undefined} world
 * @param {object} [content]
 * @returns {string | null}
 */
export function festivalCityOf(world, content) {
  const event = eventOfWorld(world, content)
  return event?.kind === 'festival' && typeof event.city === 'string' ? event.city : null
}

/**
 * The cities as a world sees them this week: the festival's city marked `festival: true`, the others
 * as they are. The same list when there is no festival.
 *
 * @param {object[]} cities the entries of game/cities.json
 * @param {object | null | undefined} world
 * @param {object} [content]
 * @returns {object[]}
 */
export function citiesOfWeek(cities, world, content) {
  const festival = festivalCityOf(world, content)
  if (!festival) return cities
  return cities.map((city) => (city.id === festival ? { ...city, festival: true } : city))
}

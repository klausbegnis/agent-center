// The city ranks' action, checked before it reaches the engine like the others in game-actions.mjs:
// buying a city's next charter. It answers whether it changed anything; a charter the rules refuse
// says why (city-ranks.mjs).

/**
 * @param {{
 *   engine: ReturnType<typeof import('./game/engine.mjs').createEngine>,
 *   change: (update: (save: object) => object) => { changed: boolean },
 *   requireWorld: (save: object, worldId: string) => void,
 *   requireCity: (cityId: string) => void
 * }} dependencies `change` applies an update to the save; the two others refuse an unknown world
 *   or city
 */
export function createCityActions({ engine, change, requireWorld, requireCity }) {
  return {
    /**
     * Buys a city's next charter with the world's coins and materials: the city rises one rank.
     *
     * @param {{ worldId: string, cityId: string }} input
     */
    async buyCharter({ worldId, cityId }) {
      return change((save) => {
        requireWorld(save, worldId)
        requireCity(cityId)
        const problem = engine.charterProblem(save, { worldId, cityId })
        if (problem) throw new Error(problem)
        return engine.buyCharter(save, { worldId, cityId })
      })
    }
  }
}

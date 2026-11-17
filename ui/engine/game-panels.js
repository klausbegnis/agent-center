// The game's tabs other than Rooms, as panels: Party, Chest (with the room's relics and the chests
// rooms left behind), Camp, Skills and Market. Each draws the room or the world picked above the
// tabs; only the open one is drawn, the others when they are opened. Says which materials the
// prices on screen lack, for the strip above the tabs.
import { costsOnScreen, shortMaterials } from './arsenal-model.js'
import { createCampView } from './camp-view.js'
import { createChestView } from './chest-view.js'
import { el } from './dom.js'
import { roomTitle } from './labels.js'
import { createMarketView } from './market-view.js'
import { createOrphansCard } from './orphans-view.js'
import { createPartyView } from './party-view.js'
import { createRelicsCard } from './relics-view.js'
import { createSkillsView } from './skills-view.js'

/**
 * @param {{
 *   contents: Record<string, HTMLElement>,
 *   actions: Record<string, (...args: unknown[]) => Promise<boolean>>,
 *   base: string,
 *   onChosenItem: () => void
 * }} options `contents` is the element each tab's panel draws into, by tab; `onChosenItem` is
 *   called when another chest item is chosen, so the strip can mark what its upgrade lacks
 */
export function createGamePanels({ contents, actions, base, onChosenItem }) {
  const party = createPartyView({ actions })
  const chest = createChestView({ actions, onChosenChange: onChosenItem, base })
  const relics = createRelicsCard({ actions, base })
  const orphans = createOrphansCard({ actions })
  const camp = createCampView({ actions })
  /** A tab's views in one block that spans the panel and lays itself out by its own width. */
  const block = (...elements) => {
    const node = el('div', 'ac-game-tab-section')
    node.append(...elements)
    return node
  }
  contents.party.append(block(party.element))
  contents.chest.append(block(chest.element, relics.element, orphans.element))
  contents.camp.append(block(camp.element))
  const skills = createSkillsView({ panel: contents.skills, actions })
  const market = createMarketView({ panel: contents.market, actions, base })

  return {
    /**
     * Draws the open tab and answers what the prices on it lack.
     *
     * @param {{ state: object, tab: string, roomId: string | null, room: object | null,
     *   world: object | null }} shown
     * @returns {Map<string, { prices: number, most: number }>}
     */
    draw({ state, tab, roomId, room, world }) {
      const game = state.game
      if (tab === 'skills') skills.update(state, world?.id ?? null)
      if (tab === 'market') market.update(state, { worldId: world?.id ?? null, roomId })
      if (!room || !world) return new Map()
      if (tab === 'party') party.update({ state, game, roomId, room, world })
      if (tab === 'chest') {
        chest.update({ state, game, roomId, room, world })
        relics.update({ game, roomId })
        const shown = state.rooms.find((entry) => entry.id === roomId)
        orphans.update({ roomId, roomName: shown ? roomTitle(shown) : roomId, world })
      }
      if (tab === 'camp') camp.update({ game, world })
      const onScreen = { chosenItem: chest.chosenItem(), upgrades: world.upgrades }
      return shortMaterials(costsOnScreen(tab, onScreen), world.materials)
    }
  }
}

// The game's tabs other than Rooms, as panels: Party, Chest (with the room's relics and the chests
// rooms left behind), Camp, Skills, Market and World (the bestiary and the roadmap of instances). Each draws the room or the world picked above the
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
import { portraitOf } from './portraits.js'
import { roomThemeIds } from './room-themes.js'
import { campCosts } from './settlement-model.js'
import { createSkillsView } from './skills-view.js'
import { createWorldView } from './world-view.js'

/**
 * @param {{
 *   contents: Record<string, HTMLElement>,
 *   actions: Record<string, (...args: unknown[]) => Promise<boolean>>,
 *   base: string,
 *   onChosenItem: () => void,
 *   library?: { get: (id: string) => object | undefined, has: (id: string) => boolean,
 *     ensure: (id: string) => Promise<object | null> },
 *   onShowAgent?: (agentId: string) => void,
 *   onThemeLoaded?: () => void,
 *   prefs?: { get: (key: string) => unknown, set: (key: string, value: string) => void }
 * }} options `contents` is the element each tab's panel draws into, by tab; `onChosenItem` is
 *   called when another chest item is chosen, so the strip can mark what its upgrade lacks;
 *   `library` holds the themes the rooms are drawn with, for the Party tab's portraits, and
 *   `onThemeLoaded` asks for a redraw once a theme a portrait waits for has loaded; `prefs` keeps
 *   the World tab's view
 */
export function createGamePanels({ contents, actions, base, onChosenItem, library, onShowAgent, onThemeLoaded, prefs }) {
  const party = createPartyView({ actions, base, onShowAgent })
  /** Themes a portrait asked for, so each is loaded once. */
  const asked = new Set()

  /** The portrait of each agent of the Party tab, worked out once per draw. */
  function portraitsFor(state, roomId) {
    if (!library) return undefined
    const themeIds = roomThemeIds(state, (id) => library.has(id))
    return (agent) => {
      const portrait = portraitOf(state, { roomId, agentId: agent.id, themeIds, isLoaded: (id) => library.has(id) })
      if (portrait.reason === 'loading' && portrait.themeId && !asked.has(portrait.themeId)) {
        asked.add(portrait.themeId)
        library.ensure(portrait.themeId).then(() => onThemeLoaded?.())
      }
      return [portrait, { name: agent.name, theme: portrait.themeId ? library.get(portrait.themeId) : undefined }]
    }
  }
  const chest = createChestView({ actions, onChosenChange: onChosenItem, base })
  const relics = createRelicsCard({ actions, base })
  const orphans = createOrphansCard({ actions })
  const camp = createCampView({ actions, base })
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
  const worldView = createWorldView({ panel: contents.world, base, actions, prefs })

  return {
    /** The Chest tab's drag of a slot onto a room chip (chest-view.js). */
    chestDrop: { draggingFrom: () => chest.draggingFrom(), dropOn: (payload, toRoomId) => chest.dropOn(payload, toRoomId) },
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
      if (tab === 'world') worldView.update({ state, world, roomId })
      if (!room || !world) return new Map()
      if (tab === 'party') party.update({ state, game, roomId, room, world, portraitFor: portraitsFor(state, roomId) })
      if (tab === 'chest') {
        chest.update({ state, game, roomId, room, world })
        relics.update({ game, roomId, state })
        const shown = state.rooms.find((entry) => entry.id === roomId)
        orphans.update({ roomId, roomName: shown ? roomTitle(shown) : roomId, world })
      }
      if (tab === 'camp') camp.update({ game, world })
      const onScreen = { chosenItem: chest.chosenItem(), campCosts: campCosts(world) }
      return shortMaterials(costsOnScreen(tab, onScreen), world.materials)
    }
  }
}

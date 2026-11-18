// The World tab: a switch between its views, Creatures and Bosses (the bestiary), the Roadmap of
// instances and the Achievements (achievements-view.js). The view chosen is kept for the surface, and `?tab=world&view=roadmap`
// (or an old `?tab=bestiary`) opens on it.
import { createAchievementsView } from './achievements-view.js'
import { createBestiaryView } from './bestiary-view.js'
import { el } from './dom.js'
import { INSTANCES } from './instance-labels.js'
import { WORLD_VIEWS, worldViewOrDefault } from './instance-model.js'
import { createRoadmapView } from './roadmap-view.js'

/** The preference the view is kept under; `view` (an address option) is read first. */
const VIEW_PREF = 'worldView'

/**
 * @param {{ panel: HTMLElement, base: string, actions: Record<string, (...args: unknown[]) => Promise<unknown>>,
 *   prefs?: { get: (key: string) => unknown, set: (key: string, value: string) => void } }} options
 */
export function createWorldView({ panel, base, actions, prefs }) {
  let view = 'creatures'
  let shown = null
  const switcher = el('div', 'ac-bestiary-switch ac-world-switch')
  switcher.setAttribute('role', 'group')
  switcher.setAttribute('aria-label', INSTANCES.viewsName)
  const buttons = WORLD_VIEWS.map((name) => {
    const node = el('button', 'ac-button ac-bestiary-switch-button', INSTANCES.views[name])
    node.type = 'button'
    node.dataset.key = `world:${name}`
    node.addEventListener('click', () => choose(name))
    switcher.append(node)
    return node
  })
  const top = el('div', 'ac-game-card ac-world-top')
  top.append(switcher)
  const bestiaryPanel = el('div', 'ac-world-bestiary')
  const bestiary = createBestiaryView({ panel: bestiaryPanel, base, outerSwitch: true })
  const roadmap = createRoadmapView({ actions, base })
  const achievements = createAchievementsView({ actions })
  panel.append(top, bestiaryPanel, roadmap.element, achievements.element)

  function draw() {
    buttons.forEach((node, at) => node.setAttribute('aria-pressed', String(WORLD_VIEWS[at] === view)))
    bestiaryPanel.hidden = view === 'roadmap' || view === 'achievements'
    roadmap.element.hidden = view !== 'roadmap'
    achievements.element.hidden = view !== 'achievements'
    if (!shown) return
    if (view === 'roadmap') roadmap.update(shown)
    else if (view === 'achievements') achievements.update(shown)
    else {
      bestiary.setShow(view)
      bestiary.update(shown.state, shown.world?.id ?? null)
    }
  }

  function choose(name) {
    view = worldViewOrDefault(name)
    prefs?.set(VIEW_PREF, view)
    draw()
  }

  // The address's `view`, then the one kept for this surface.
  Promise.all([prefs?.get('view'), prefs?.get(VIEW_PREF)].map((value) => Promise.resolve(value).catch(() => null)))
    .then(([asked, saved]) => {
      view = worldViewOrDefault(WORLD_VIEWS.includes(asked) ? asked : saved)
      draw()
    })

  return {
    /**
     * @param {{ state: object, world: object | null, roomId: string | null }} next the view state,
     *   the world picked above the tabs and its picked room
     */
    update(next) {
      shown = next
      draw()
    }
  }
}

// The "Chests left behind" card of the Arsenal's Items section: the projects of the chosen room's
// world that are no longer on screen, each with a button that moves its chest and retirees into
// the chosen room after a confirmation. Hidden when the world has none.
import { el } from './dom.js'
import { confirmButton, replaceKeepingFocus, section } from './game-controls.js'
import { ARSENAL } from './labels.js'

/**
 * @param {{ actions: Record<string, (...args: unknown[]) => Promise<unknown>> }} options
 */
export function createOrphansCard({ actions }) {
  const list = el('div', 'ac-game-list ac-game-orphans')
  const element = section(ARSENAL.orphans, [el('p', 'ac-game-card-line', ARSENAL.orphansNote), list], 'ac-game-orphans-card')
  element.hidden = true
  /** The questions open, by key, so a redraw does not close one someone is reading. */
  const openQuestions = new Set()
  let drawn = null

  function row(orphan, roomId, roomName) {
    const node = el('div', 'ac-game-orphan')
    const what = el('div', 'ac-game-orphan-what')
    what.append(el('span', 'ac-game-orphan-name', orphan.name), el('span', 'ac-muted', ARSENAL.orphanFacts(orphan)))
    const key = `orphan:${orphan.roomId}>${roomId}`
    node.append(what, confirmButton({
      label: ARSENAL.moveHere,
      ariaLabel: ARSENAL.moveHereLabel(orphan.name, roomName),
      question: ARSENAL.moveQuestion(orphan, roomName),
      confirm: ARSENAL.moveConfirm(roomName),
      confirmClassName: 'ac-primary',
      key,
      isOpen: openQuestions.has(key),
      onOpenChange: (isOpen) => (isOpen ? openQuestions.add(key) : openQuestions.delete(key)),
      onConfirm: () => actions.moveOrphanItems(orphan.roomId, roomId)
    }))
    return node
  }

  return {
    element,
    /**
     * @param {{ roomId: string, roomName: string, world: { orphans?: object[] } }} next the room
     *   chosen in the Arsenal, its name as shown, and its world
     */
    update({ roomId, roomName, world }) {
      const orphans = actions.moveOrphanItems ? world.orphans ?? [] : []
      element.hidden = orphans.length === 0
      const signature = JSON.stringify([roomId, roomName, orphans])
      if (signature === drawn) return
      drawn = signature
      replaceKeepingFocus(list, orphans.map((orphan) => row(orphan, roomId, roomName)))
    }
  }
}

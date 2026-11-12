// The row at the bottom that lists hidden rooms, one click away from coming back.
import { button, el } from './dom.js'
import { roomTitle } from './labels.js'

/** @param {{ setRoomHidden?: (roomId: string, hidden: boolean) => unknown }} transport */
export function createShelf(transport) {
  const element = el('footer', 'ac-shelf')
  element.hidden = true

  return {
    element,
    /** @param {{ id: string, name: string, host: string | null }[]} hiddenRooms */
    update(hiddenRooms) {
      element.hidden = hiddenRooms.length === 0
      element.replaceChildren()
      if (hiddenRooms.length === 0) return
      element.append(el('span', 'ac-muted', 'Hidden:'))
      for (const room of hiddenRooms) {
        element.append(
          button(roomTitle(room), 'ac-link', {
            title: 'Show this room again',
            onClick: () => transport.setRoomHidden(room.id, false)
          })
        )
      }
    }
  }
}

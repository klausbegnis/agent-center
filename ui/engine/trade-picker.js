// A trade picker: the trade's icon beside a select of the trades. It draws what it is given and
// works nothing out (see trade-model.js).
import { el, select, setOptions } from './dom.js'
import { gameIcon } from './icon-view.js'
import { choiceOf, NO_CHOICE } from './trade-model.js'

/**
 * A trade picker: the trade's icon beside a select. Built once and changed in place, so a redraw
 * never closes it while someone is choosing.
 *
 * @param {{ key: string, onPick: (choice: string | null) => Promise<boolean> }} options
 */
export function tradePicker({ key, onPick }) {
  const element = el('span', 'ac-game-trade')
  let icon = el('span', 'ac-icon ac-icon-none ac-game-trade-icon')
  const picker = select('ac-select ac-game-trade-select', '')
  picker.dataset.key = key
  let shown = NO_CHOICE
  picker.addEventListener('change', async () => {
    const isDone = await onPick(choiceOf(picker.value))
    // A refused choice puts the picker back.
    if (!isDone) picker.value = shown
  })
  element.append(icon, picker)
  return {
    element,
    /** @param {{ label: string, options: [string, string][], value: string, iconId: string | null }} next */
    set({ label, options, value, iconId }) {
      picker.setAttribute('aria-label', label)
      setOptions(picker, options)
      if (shown !== value || picker.value !== value) picker.value = value
      shown = value
      if (icon.dataset.iconId !== String(iconId)) {
        const next = gameIcon(iconId, 'ac-game-trade-icon')
        next.dataset.iconId = String(iconId)
        icon.replaceWith(next)
        icon = next
      }
    }
  }
}

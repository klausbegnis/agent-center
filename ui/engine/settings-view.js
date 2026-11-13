// The game's settings, opened from the cog in the header: keep titles, auto-spend, each room's
// world (another world, a new one, or out of the game) and resetting a world.
import { button, el, select, setOptions } from './dom.js'
import { confirmButton, replaceKeepingFocus, section, settingSwitch } from './game-controls.js'
import { isEstimated, MAX_WORLDS, newWorldId, roomWorlds } from './game-model.js'
import { ARSENAL, ESTIMATED_NOTE, roomTitle, SETTINGS, worldChoice } from './labels.js'

/** The value of the "out of the game" and "new world" choices; world ids are never empty. */
const OUT_OF_GAME = ''
const NEW_WORLD = ':new'

/**
 * @param {{
 *   actions: Record<string, (...args: unknown[]) => Promise<boolean>>,
 *   onClose: () => void
 * }} options
 */
export function createSettingsView({ actions, onClose }) {
  let state = null
  let drawn = null
  /** The room someone is naming a new world for, and what they typed so far. */
  let naming = null
  let resetWorldId = null
  const openQuestions = new Set()

  const element = el('section', 'ac-game-settings')
  element.setAttribute('aria-labelledby', 'ac-game-settings-title')
  element.hidden = true
  const head = el('div', 'ac-game-settings-head')
  const title = el('h2', 'ac-game-settings-title', SETTINGS.title)
  title.id = 'ac-game-settings-title'
  title.tabIndex = -1
  head.append(title, button(SETTINGS.close, 'ac-button', { onClick: onClose }))

  const estimated = el('p', 'ac-game-settings-note', ESTIMATED_NOTE)
  const switches = el('section', 'ac-game-card')
  const keepTitles = actions.setKeepTitles
    ? settingSwitch(SETTINGS.keepTitles, SETTINGS.keepTitlesHint, actions.setKeepTitles)
    : null
  const autoSpend = actions.setAutoSpend ? settingSwitch(ARSENAL.autoSpend, ARSENAL.autoSpendHint, actions.setAutoSpend) : null
  for (const control of [keepTitles, autoSpend]) if (control) switches.append(control.element)
  switches.append(el('p', 'ac-game-card-line', SETTINGS.local))
  const body = el('div', 'ac-game-panel-body')
  element.append(head, estimated, switches, body)

  function worldOptions(worlds) {
    const options = worlds.map((world) => [world.id, worldChoice(world)])
    options.push([OUT_OF_GAME, SETTINGS.outOfGame])
    if (worlds.length < MAX_WORLDS) options.push([NEW_WORLD, SETTINGS.newWorld])
    return options
  }

  function newWorldForm(roomId, worlds) {
    const form = el('form', 'ac-game-row ac-game-new-world')
    const input = el('input', 'ac-game-input')
    input.type = 'text'
    input.maxLength = 40
    input.value = naming.text
    input.dataset.key = `new-world:${roomId}`
    input.setAttribute('aria-label', SETTINGS.newWorldName)
    input.addEventListener('input', () => {
      naming.text = input.value
    })
    const error = el('p', 'ac-game-missing')
    error.setAttribute('role', 'alert')
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const result = newWorldId(input.value, worlds.map((world) => world.id))
      if (result.error) {
        error.textContent = SETTINGS.newWorldError[result.error]
        return
      }
      naming = null
      drawn = null
      draw()
      await actions.moveRoomToWorld(roomId, result.id)
    })
    const create = el('button', 'ac-button ac-primary', SETTINGS.create)
    create.type = 'submit'
    const cancel = button(SETTINGS.cancel, 'ac-button', {
      onClick: () => {
        naming = null
        drawn = null
        draw()
      }
    })
    form.append(input, create, cancel, error)
    return form
  }

  function roomRow({ room, worldId }, worlds) {
    const row = el('div', 'ac-game-room-world')
    const picker = select('ac-select', SETTINGS.roomWorld(room.name), worldOptions(worlds))
    picker.dataset.key = `world:${room.id}`
    const isNaming = naming?.roomId === room.id
    picker.value = isNaming ? NEW_WORLD : worldId ?? OUT_OF_GAME
    picker.disabled = !actions.moveRoomToWorld
    picker.addEventListener('change', () => {
      if (picker.value === NEW_WORLD) {
        naming = { roomId: room.id, text: '' }
        drawn = null
        draw()
        element.querySelector('.ac-game-new-world input')?.focus()
        return
      }
      naming = null
      actions.moveRoomToWorld(room.id, picker.value === OUT_OF_GAME ? null : picker.value).then((isDone) => {
        // A refused move puts the choice back.
        if (!isDone) picker.value = worldId ?? OUT_OF_GAME
      })
    })
    row.append(el('span', 'ac-game-room-world-name', roomTitle(room)), picker)
    if (isNaming) row.append(newWorldForm(room.id, worlds))
    return row
  }

  function resetCard(worlds) {
    const children = []
    const chosen = worlds.find((world) => world.id === resetWorldId) ?? worlds[0]
    if (worlds.length > 1) {
      const field = el('label', 'ac-game-field')
      const picker = select('ac-select', SETTINGS.resetWorld, worlds.map((world) => [world.id, worldChoice(world)]))
      picker.removeAttribute('aria-label')
      picker.dataset.key = 'reset-world'
      picker.value = chosen.id
      picker.addEventListener('change', () => {
        resetWorldId = picker.value
        drawn = null
        draw()
      })
      field.append(el('span', 'ac-game-field-label', SETTINGS.resetWorld), picker)
      children.push(field)
    }
    const key = `reset:${chosen.id}`
    children.push(confirmButton({
      label: SETTINGS.reset,
      question: SETTINGS.resetQuestion(chosen.id),
      confirm: SETTINGS.resetConfirm(chosen.id),
      className: 'ac-game-danger',
      key,
      isOpen: openQuestions.has(key),
      onOpenChange: (isOpen) => (isOpen ? openQuestions.add(key) : openQuestions.delete(key)),
      onConfirm: () => actions.resetWorld(chosen.id)
    }))
    return section(SETTINGS.reset, children)
  }

  function draw() {
    if (!state) return
    const game = state.game
    estimated.hidden = !isEstimated(game)
    keepTitles?.set(game.keepTitles === true)
    autoSpend?.set(game.autoSpend === true)
    const worlds = game.worlds ?? []
    const rooms = roomWorlds(state)
    const signature = JSON.stringify([worlds.map((world) => [world.id, world.level]), rooms.map(({ room, worldId }) =>
      [room.id, worldId]), naming?.roomId, resetWorldId])
    if (signature === drawn) return
    drawn = signature
    const list = el('div', 'ac-game-list')
    list.append(...rooms.map((entry) => roomRow(entry, worlds)))
    const cards = [section(SETTINGS.worlds, [el('p', 'ac-game-card-line', SETTINGS.worldsNote), list])]
    if (actions.resetWorld && worlds.length) cards.push(resetCard(worlds))
    replaceKeepingFocus(body, cards)
  }

  return {
    element,
    /** @param {object} next the view state, with the game running */
    update(next) {
      state = next
      draw()
    },
    /** Moves the keyboard to the settings once they are shown. */
    focus() {
      title.focus()
    }
  }
}

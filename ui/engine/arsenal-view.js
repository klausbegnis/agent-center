// The Arsenal tab: the world's materials, and for one room its characters, its chest with item
// upgrades, the world's group upgrades and the room's retirees.
import { button, el, select, setOptions } from './dom.js'
import { replaceKeepingFocus, section, switchControl } from './game-controls.js'
import { costEntries, formatAmount, formatShare, missingMaterials } from './game-format.js'
import { chosenRoomId, holderName, joinedRooms, roomCharacters, worldById } from './game-model.js'
import { retireeName } from './game-names.js'
import {
  ARSENAL,
  ATTRIBUTE_LABEL,
  characterFacts,
  equipmentText,
  holderText,
  itemFacts,
  MATERIAL_LABEL,
  materialsText,
  missingText,
  retireeBonusText,
  retireeFacts,
  roomTitle,
  SLOT_LABEL,
  UPGRADE_LABEL,
  upgradeEffectText
} from './labels.js'

/**
 * @param {{
 *   panel: HTMLElement,
 *   actions: Record<string, (...args: unknown[]) => Promise<boolean>>,
 *   prefs?: { get: (key: string) => unknown, set: (key: string, value: string) => unknown }
 * }} options
 */
export function createArsenalView({ panel, actions, prefs }) {
  let wantedRoomId = null
  let state = null
  let drawn = null

  const head = el('section', 'ac-game-card ac-game-arsenal-head')
  const roomField = el('label', 'ac-game-field')
  const roomSelect = select('ac-select', ARSENAL.room)
  roomSelect.removeAttribute('aria-label')
  roomSelect.addEventListener('change', () => {
    wantedRoomId = roomSelect.value
    prefs?.set('arsenalRoom', wantedRoomId)
    draw()
  })
  roomField.append(el('span', 'ac-game-field-label', ARSENAL.room), roomSelect)
  head.append(roomField)
  const autoSpend = actions.setAutoSpend
    ? switchControl({ label: ARSENAL.autoSpend, hint: ARSENAL.autoSpendHint, onChange: (on) => actions.setAutoSpend(on) })
    : null
  if (autoSpend) head.append(autoSpend.element)
  const body = el('div', 'ac-game-panel-body')
  panel.append(head, body)

  Promise.resolve(prefs?.get('arsenalRoom'))
    .then((saved) => {
      if (typeof saved === 'string' && saved && wantedRoomId === null) wantedRoomId = saved
    })
    .catch(() => {})

  function materialGrid(world) {
    const grid = el('div', 'ac-game-materials')
    for (const id of Object.keys(MATERIAL_LABEL)) {
      const cell = el('div', 'ac-game-material')
      cell.append(el('span', 'ac-game-material-name', MATERIAL_LABEL[id]), el('strong', 'ac-game-amount', formatAmount(world.materials?.[id])))
      grid.append(cell)
    }
    return section(ARSENAL.materials(world.id, world.level), [grid])
  }

  function characterCard({ agent, character }) {
    const node = el('article', 'ac-game-entry')
    const title = el('div', 'ac-game-entry-head')
    title.append(el('strong', 'ac-game-entry-name', agent.name), el('span', 'ac-muted', characterFacts(character)))
    const attributes = el('dl', 'ac-game-facts')
    for (const [id, label] of Object.entries(ATTRIBUTE_LABEL)) {
      const pair = el('div', 'ac-game-fact')
      pair.append(el('dt', '', label), el('dd', '', String(character.attributes?.[id] ?? 0)))
      attributes.append(pair)
    }
    attributes.setAttribute('aria-label', ARSENAL.attributes)
    const gear = el('dl', 'ac-game-gear')
    gear.setAttribute('aria-label', ARSENAL.equipment)
    for (const [slot, label] of Object.entries(SLOT_LABEL)) {
      gear.append(el('dt', '', label), el('dd', '', equipmentText(character.equipment?.[slot])))
    }
    node.append(title, attributes, gear)
    return node
  }

  function charactersCard(roomId) {
    const { members, guests } = roomCharacters(state, roomId)
    const children = members.map(characterCard)
    if (!members.length) children.push(el('p', 'ac-game-card-line', ARSENAL.noCharacters))
    if (guests) children.push(el('p', 'ac-game-card-line', ARSENAL.guests(guests)))
    return section(ARSENAL.characters, children)
  }

  /** The price of a purchase, and either its button or, when it cannot be paid, what is missing. */
  function purchase({ cost, affordable, materials, label, ariaLabel, key, onBuy }) {
    const node = el('div', 'ac-game-buy')
    node.append(el('span', 'ac-game-cost', ARSENAL.upgradeCost(materialsText(costEntries(cost), formatAmount))))
    if (!onBuy) return node
    const action = button(label, 'ac-button ac-game-buy-button', { onClick: onBuy })
    action.dataset.key = key
    action.setAttribute('aria-label', ariaLabel)
    const missing = missingMaterials(cost, materials)
    if (!affordable && missing.length) {
      action.disabled = true
      const reason = el('span', 'ac-game-missing', missingText(missing, formatAmount))
      reason.id = `ac-game-missing-${key}`
      action.setAttribute('aria-describedby', reason.id)
      node.append(reason)
    }
    node.append(action)
    return node
  }

  function chestCard(roomId, room, world) {
    const list = el('div', 'ac-game-list')
    for (const item of room.chest ?? []) {
      const node = el('article', 'ac-game-entry')
      const title = el('div', 'ac-game-entry-head')
      title.append(el('strong', 'ac-game-entry-name', item.name), el('span', 'ac-muted', itemFacts(item)))
      node.append(title, el('span', 'ac-game-card-line', holderText(holderName(item, state, roomId))))
      node.append(purchase({
        cost: item.upgradeCost,
        affordable: item.affordable,
        materials: world.materials,
        label: ARSENAL.upgrade,
        ariaLabel: ARSENAL.upgradeItem(item.name),
        key: `item:${item.id}`,
        onBuy: actions.upgradeItem && (() => actions.upgradeItem(roomId, item.id))
      }))
      list.append(node)
    }
    return section(ARSENAL.chest(room.chest?.length ?? 0, room.chestSize ?? 0), [list])
  }

  function upgradesCard(world) {
    const list = el('div', 'ac-game-list')
    for (const upgrade of world.upgrades ?? []) {
      const name = UPGRADE_LABEL[upgrade.id] ?? upgrade.id
      const node = el('article', 'ac-game-entry')
      const title = el('div', 'ac-game-entry-head')
      title.append(el('strong', 'ac-game-entry-name', name), el('span', 'ac-muted', `Lv ${upgrade.level}`))
      node.append(title, el('span', 'ac-game-card-line', upgradeEffectText(upgrade, formatShare)))
      node.append(purchase({
        cost: upgrade.cost,
        affordable: upgrade.affordable,
        materials: world.materials,
        label: ARSENAL.buy,
        ariaLabel: ARSENAL.buyUpgrade(name, upgrade.level + 1),
        key: `upgrade:${upgrade.id}`,
        onBuy: actions.buyGroupUpgrade && (() => actions.buyGroupUpgrade(world.id, upgrade.id))
      }))
      list.append(node)
    }
    return section(ARSENAL.groupUpgrades(world.id), [list])
  }

  function retireesCard(room) {
    const children = [el('p', 'ac-game-card-line', retireeBonusText(room.bonus ?? 0, room.retiredCount ?? 0, formatShare))]
    const list = el('ul', 'ac-game-retirees')
    for (const retiree of room.retirees ?? []) {
      const item = el('li', 'ac-game-retiree')
      item.append(el('strong', '', retireeName(retiree.nameId)), el('span', 'ac-muted', retireeFacts(retiree)))
      if (retiree.title) item.append(el('span', 'ac-game-retiree-title', ARSENAL.title(retiree.title)))
      list.append(item)
    }
    if (room.retirees?.length) children.push(list)
    else children.push(el('p', 'ac-game-card-line', ARSENAL.noRetirees))
    const older = (room.retiredCount ?? 0) - (room.retirees?.length ?? 0)
    if (older > 0 && room.retirees?.length) children.push(el('p', 'ac-game-card-line', ARSENAL.moreRetirees(older)))
    return section(ARSENAL.retirees, children)
  }

  function draw() {
    if (!state) return
    const game = state.game
    autoSpend?.set(game.autoSpend === true)
    const rooms = joinedRooms(state)
    setOptions(roomSelect, rooms.map((room) => [room.id, roomTitle(room)]))
    const roomId = chosenRoomId(state, wantedRoomId)
    roomField.hidden = !roomId
    if (roomId) roomSelect.value = roomId

    const room = roomId ? game.rooms[roomId] : null
    const world = room ? worldById(game, room.worldId) : null
    // Redrawn only when what it shows changed, so a list being read does not jump.
    const signature = JSON.stringify([roomId, room, world, roomCharacters(state, roomId ?? '')])
    if (signature === drawn) return
    drawn = signature
    if (!room || !world) {
      replaceKeepingFocus(body, [el('p', 'ac-game-card-line', ARSENAL.noRooms)])
      return
    }
    replaceKeepingFocus(body, [
      materialGrid(world),
      charactersCard(roomId),
      chestCard(roomId, room, world),
      upgradesCard(world),
      retireesCard(room)
    ])
  }

  return {
    /** @param {object} next the view state, with the game running */
    update(next) {
      state = next
      draw()
    }
  }
}

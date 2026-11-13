// The Arsenal tab: the world's materials as icon tiles, and for one room its characters as small
// cards with their class, level, attributes and three slots, its chest with item upgrades priced
// in material icons, the world's group upgrades and the room's retirees.
import { button, el, select, setOptions } from './dom.js'
import { replaceKeepingFocus, section, settingSwitch } from './game-controls.js'
import { costEntries, formatAmount, formatShare, missingMaterials } from './game-format.js'
import { iconColor, slotIconId } from './game-icons.js'
import { chosenRoomId, holderName, joinedRooms, roomCharacters, worldById } from './game-model.js'
import { retireeName } from './game-names.js'
import { gameIcon } from './icon-view.js'
import {
  ARSENAL,
  ATTRIBUTE_LABEL,
  ATTRIBUTE_SHORT,
  characterFacts,
  holderText,
  levelShort,
  MATERIAL_LABEL,
  materialLabel,
  missingText,
  retireeBonusText,
  retireeFacts,
  roomTitle,
  SLOT_LABEL,
  slotText,
  tierLevel,
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
    ? settingSwitch(ARSENAL.autoSpend, ARSENAL.autoSpendHint, actions.setAutoSpend)
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
    const grid = el('ul', 'ac-game-materials')
    for (const id of Object.keys(MATERIAL_LABEL)) {
      const tile = el('li', 'ac-game-material')
      tile.style.setProperty('--ac-tile-color', iconColor(id))
      const amount = el('strong', 'ac-game-amount', formatAmount(world.materials?.[id]))
      const name = el('span', 'ac-game-material-name', materialLabel(id))
      tile.append(gameIcon(id, 'ac-game-material-icon'), amount, name)
      grid.append(tile)
    }
    return section(ARSENAL.materials(world.id, world.level), [grid])
  }

  /** The seven attributes as short pairs; each short name carries its full name. */
  function attributeList(character, name) {
    const list = el('dl', 'ac-game-attributes')
    list.setAttribute('aria-label', ARSENAL.attributesShort(name))
    for (const [id, label] of Object.entries(ATTRIBUTE_LABEL)) {
      const pair = el('div', 'ac-game-attribute')
      const term = el('dt', '')
      const short = el('abbr', '', ATTRIBUTE_SHORT[id])
      short.title = label
      term.append(short)
      pair.append(term, el('dd', '', String(character.attributes?.[id] ?? 0)))
      list.append(pair)
    }
    return list
  }

  /** The three slots of a character: slot icon, then the item and its tier and level. */
  function slotList(character) {
    const list = el('ul', 'ac-game-slots')
    list.setAttribute('aria-label', ARSENAL.equipment)
    for (const [slot, label] of Object.entries(SLOT_LABEL)) {
      const item = character.equipment?.[slot] ?? null
      const iconId = slotIconId(slot, slot === 'weapon' ? weaponType(character) : undefined)
      const row = el('li', 'ac-game-slot')
      row.append(gameIcon(iconId, 'ac-game-slot-icon'))
      const text = el('span', 'ac-game-slot-text')
      text.append(el('span', 'ac-visually-hidden', `${label}: `))
      if (item) {
        text.append(el('span', 'ac-game-slot-name', item.name), el('span', 'ac-muted', ` ${tierLevel(item)}`))
      } else {
        text.append(el('span', 'ac-muted', ARSENAL.emptySlot))
      }
      row.append(text)
      list.append(row)
    }
    return list
  }

  /** A Mage's weapon is a magical one; the others' are physical. */
  const weaponType = (character) => (character.class === 'magical' ? 'magical' : 'physical')

  function characterCard({ agent, character }) {
    const node = el('article', 'ac-game-hero')
    const top = el('div', 'ac-game-hero-head')
    const who = el('div', 'ac-game-hero-who')
    who.append(el('strong', 'ac-game-entry-name', agent.name))
    who.append(el('span', 'ac-muted', characterFacts(character)))
    top.append(gameIcon(character.class, 'ac-game-hero-icon'), who)
    node.append(top, attributeList(character, agent.name), slotList(character))
    return node
  }

  function charactersCard(roomId) {
    const { members, guests } = roomCharacters(state, roomId)
    const list = el('div', 'ac-game-heroes')
    list.append(...members.map(characterCard))
    const children = [list]
    if (!members.length) children.push(el('p', 'ac-game-card-line', ARSENAL.noCharacters))
    if (guests) children.push(el('p', 'ac-game-card-line', ARSENAL.guests(guests)))
    return section(ARSENAL.characters, children)
  }

  /** A price as material icons and amounts, each one short of it saying how much is missing. */
  function priceList(cost, materials) {
    const missing = new Map(missingMaterials(cost, materials).map(({ id, amount }) => [id, amount]))
    const list = el('ul', 'ac-game-price')
    list.setAttribute('aria-label', ARSENAL.nextLevel)
    for (const { id, amount } of costEntries(cost)) {
      const entry = el('li', 'ac-game-price-entry')
      entry.append(gameIcon(id), el('span', '', `${formatAmount(amount)} ${materialLabel(id)}`))
      if (missing.has(id)) {
        entry.classList.add('ac-game-price-short')
        entry.append(el('span', 'ac-game-missing', `(${ARSENAL.short(formatAmount(missing.get(id)))})`))
      }
      list.append(entry)
    }
    return list
  }

  /** The price of a purchase and its button; the button is off and says why while it cannot be paid. */
  function purchase({ cost, affordable, materials, label, ariaLabel, key, onBuy }) {
    const node = el('div', 'ac-game-buy')
    node.append(el('span', 'ac-game-cost', ARSENAL.nextLevel), priceList(cost, materials))
    if (!onBuy) return node
    const action = button(label, 'ac-button ac-game-buy-button', { onClick: onBuy })
    action.dataset.key = key
    action.setAttribute('aria-label', ariaLabel)
    const missing = missingMaterials(cost, materials)
    if (!affordable && missing.length) {
      action.disabled = true
      const reason = el('span', 'ac-visually-hidden', missingText(missing, formatAmount))
      reason.id = `ac-game-missing-${key}`
      action.setAttribute('aria-describedby', reason.id)
      node.append(reason)
    }
    node.append(action)
    return node
  }

  function itemCard(roomId, item, world) {
    const node = el('article', 'ac-game-item')
    const top = el('div', 'ac-game-item-head')
    const what = el('div', 'ac-game-item-what')
    const facts = `${slotText(item)} · ${tierLevel(item)}`
    what.append(el('strong', 'ac-game-entry-name', item.name), el('span', 'ac-muted', facts))
    top.append(gameIcon(slotIconId(item.slot, item.damageType), 'ac-game-item-icon'), what)
    node.append(top, el('span', 'ac-game-card-line', holderText(holderName(item, state, roomId))))
    node.append(purchase({
      cost: item.upgradeCost,
      affordable: item.affordable,
      materials: world.materials,
      label: ARSENAL.upgrade,
      ariaLabel: ARSENAL.upgradeItem(item.name),
      key: `item:${item.id}`,
      onBuy: actions.upgradeItem && (() => actions.upgradeItem(roomId, item.id))
    }))
    return node
  }

  function chestCard(roomId, room, world) {
    const list = el('div', 'ac-game-items')
    list.append(...(room.chest ?? []).map((item) => itemCard(roomId, item, world)))
    return section(ARSENAL.chest(room.chest?.length ?? 0, room.chestSize ?? 0), [list])
  }

  function upgradesCard(world) {
    const list = el('div', 'ac-game-items')
    for (const upgrade of world.upgrades ?? []) {
      const name = UPGRADE_LABEL[upgrade.id] ?? upgrade.id
      const node = el('article', 'ac-game-item')
      const top = el('div', 'ac-game-item-head')
      const what = el('div', 'ac-game-item-what')
      what.append(el('strong', 'ac-game-entry-name', name), el('span', 'ac-muted', levelShort(upgrade.level)))
      top.append(gameIcon(upgrade.id, 'ac-game-item-icon'), what)
      node.append(top, el('span', 'ac-game-card-line', upgradeEffectText(upgrade, formatShare)))
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
    const bonus = retireeBonusText(room.bonus ?? 0, room.retiredCount ?? 0, formatShare)
    const children = [el('p', 'ac-game-card-line', bonus)]
    const list = el('ul', 'ac-game-retirees')
    for (const retiree of room.retirees ?? []) {
      const item = el('li', 'ac-game-retiree')
      const facts = el('span', 'ac-game-retiree-facts')
      facts.append(el('strong', '', retireeName(retiree.nameId)))
      facts.append(el('span', 'ac-muted', retireeFacts(retiree)))
      item.append(gameIcon(retiree.class, 'ac-game-retiree-icon'), facts)
      if (retiree.title) facts.append(el('span', 'ac-game-retiree-title', ARSENAL.title(retiree.title)))
      list.append(item)
    }
    if (room.retirees?.length) children.push(list)
    else children.push(el('p', 'ac-game-card-line', ARSENAL.noRetirees))
    const older = (room.retiredCount ?? 0) - (room.retirees?.length ?? 0)
    if (older > 0 && room.retirees?.length) {
      children.push(el('p', 'ac-game-card-line', ARSENAL.moreRetirees(older)))
    }
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

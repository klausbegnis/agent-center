// The Arsenal's Party section: the room's characters as cards with class, level and progress,
// the seven attributes and the three equipment slots drawn like the chest's, then the retirees
// and the bonus they leave the project.
import { el } from './dom.js'
import { meter, replaceKeepingFocus, section } from './game-controls.js'
import { clampShare, formatShare } from './game-format.js'
import { roomCharacters } from './game-model.js'
import { retireeName } from './game-names.js'
import { gameIcon } from './icon-view.js'
import { itemSlot } from './item-slot-view.js'
import {
  ARSENAL,
  ATTRIBUTE_LABEL,
  ATTRIBUTE_SHORT,
  characterFacts,
  equipmentSlotLabel,
  retireeBonusText,
  retireeFacts,
  SLOT_LABEL
} from './labels.js'

/** A Mage's weapon is a magical one; the others' are physical. */
const weaponType = (character) => (character.class === 'magical' ? 'magical' : 'physical')

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

/** The three slots of a character, each a small chest slot with the item's name beside it. */
function slotList(character) {
  const list = el('ul', 'ac-game-slots')
  list.setAttribute('aria-label', ARSENAL.equipment)
  for (const slot of Object.keys(SLOT_LABEL)) {
    const item = character.equipment?.[slot] ?? null
    const row = el('li', 'ac-game-slot')
    row.append(itemSlot({
      item,
      slot,
      damageType: slot === 'weapon' ? weaponType(character) : null,
      label: equipmentSlotLabel(slot, item),
      isSmall: true
    }))
    const name = item
      ? el('span', 'ac-game-slot-text', item.name)
      : el('span', 'ac-game-slot-text ac-muted', ARSENAL.emptySlot)
    name.setAttribute('aria-hidden', 'true')
    row.append(name)
    list.append(row)
  }
  return list
}

function characterCard({ agent, character }) {
  const node = el('article', 'ac-game-hero')
  const top = el('div', 'ac-game-hero-head')
  const who = el('div', 'ac-game-hero-who')
  who.append(
    el('strong', 'ac-game-entry-name', agent.name),
    el('span', 'ac-muted', characterFacts(character))
  )
  top.append(gameIcon(character.class, 'ac-game-hero-icon'), who)
  const progress = meter('ac-game-hero-progress', ARSENAL.levelProgress(agent.name))
  const share = clampShare(character.levelProgress)
  progress.set(share, formatShare(share))
  node.append(top, progress.element, attributeList(character, agent.name), slotList(character))
  return node
}

function charactersCard(state, roomId) {
  const { members, guests } = roomCharacters(state, roomId)
  const children = []
  if (members.length) {
    const list = el('div', 'ac-game-heroes')
    list.append(...members.map(characterCard))
    children.push(list)
  } else {
    children.push(el('p', 'ac-game-card-line', ARSENAL.noCharacters))
  }
  if (guests) children.push(el('p', 'ac-game-card-line', ARSENAL.guests(guests)))
  return section(ARSENAL.characters, children, 'ac-game-party-card')
}

function retireesCard(room) {
  const retirees = room.retirees ?? []
  if (!retirees.length) {
    const empty = el('p', 'ac-game-card-line', ARSENAL.noRetirees)
    return section(ARSENAL.retirees, [empty], 'ac-game-retirees-card')
  }
  const bonus = retireeBonusText(room.bonus ?? 0, room.retiredCount ?? 0, formatShare)
  const children = [el('p', 'ac-game-card-line', bonus)]
  const list = el('ul', 'ac-game-retirees')
  for (const retiree of retirees) {
    const item = el('li', 'ac-game-retiree')
    const facts = el('span', 'ac-game-retiree-facts')
    facts.append(el('strong', '', retireeName(retiree.nameId)), el('span', 'ac-muted', retireeFacts(retiree)))
    if (retiree.title) facts.append(el('span', 'ac-game-retiree-title', ARSENAL.title(retiree.title)))
    item.append(gameIcon(retiree.class, 'ac-game-retiree-icon'), facts)
    list.append(item)
  }
  children.push(list)
  const older = (room.retiredCount ?? 0) - retirees.length
  if (older > 0) children.push(el('p', 'ac-game-card-line', ARSENAL.moreRetirees(older)))
  return section(ARSENAL.retirees, children, 'ac-game-retirees-card')
}

/**
 * @returns {{ element: HTMLElement,
 *   update: (next: { state: object, roomId: string, room: object }) => void }}
 */
export function createPartyView() {
  const element = el('div', 'ac-game-party-section')
  let drawn = null
  return {
    element,
    update({ state, roomId, room }) {
      // Only what the cards show: an agent changing activity does not redraw them.
      const { members, guests } = roomCharacters(state, roomId)
      const shown = members.map(({ agent, character }) => [
        agent.name,
        character.class,
        character.level,
        character.levelProgress,
        character.attributes,
        character.equipment
      ])
      const signature = JSON.stringify([roomId, shown, guests, room.retirees, room.retiredCount, room.bonus])
      if (signature === drawn) return
      drawn = signature
      replaceKeepingFocus(element, [charactersCard(state, roomId), retireesCard(room)])
    }
  }
}

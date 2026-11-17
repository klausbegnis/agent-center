// The Party tab: what the room's idle characters gather, "Best gear for everyone here", the
// characters as cards with class, level, progress, trade picker, the seven attributes and the
// three equipment slots, each opening a picker of the chest's items (equip-view.js), then the
// retirees and the bonus they leave the project.
import { button, el } from './dom.js'
import { meter, replaceKeepingFocus, section } from './game-controls.js'
import { clampShare, formatShare } from './game-format.js'
import { roomCharacters } from './game-model.js'
import { retireeName } from './game-names.js'
import { gameIcon } from './icon-view.js'
import { EQUIP } from './equip-labels.js'
import { createEquipSlots } from './equip-view.js'
import {
  ARSENAL,
  ATTRIBUTE_LABEL,
  ATTRIBUTE_SHORT,
  characterFacts,
  retireeBonusText,
  retireeFacts,
  roomTitle,
  skillLabel
} from './labels.js'
import { TRADES_TEXT } from './trade-labels.js'
import { canChooseTrades, characterTradeOptions, pickerValue, roomTradeOptions } from './trade-model.js'
import { tradePicker } from './trade-picker.js'

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

/** A character's card, kept while the character stays, so its trade picker is never rebuilt. */
function createCharacterCard({ roomId, sessionId, name, actions, openSlot }) {
  const node = el('article', 'ac-game-hero')
  const top = el('div', 'ac-game-hero-head')
  const who = el('div', 'ac-game-hero-who')
  const nameText = el('strong', 'ac-game-entry-name')
  const facts = el('span', 'ac-muted')
  who.append(nameText, facts)
  let classIcon = el('span')
  // Holds the picker, or on a page that cannot choose, the trade as text.
  const tradeSlot = el('span', 'ac-game-trade-slot')
  top.append(classIcon, who, tradeSlot)
  const picker = tradePicker({
    key: `trade:${sessionId}`,
    onPick: (choice) => actions.setCharacterTrade(roomId, sessionId, choice)
  })
  const tradeText = el('span', 'ac-game-trade')
  const progress = meter('ac-game-hero-progress', ARSENAL.levelProgress(name))
  const details = el('div', 'ac-game-hero-details')
  const attributes = el('div', 'ac-game-hero-attributes')
  const equip = createEquipSlots({ roomId: () => roomId, sessionId, name, actions, open: openSlot })
  details.append(attributes, equip.element)
  node.append(top, progress.element, details)
  let drawnDetails = null
  return {
    element: node,
    equip,
    update({ agent, character }, { roomChoice, canChoose, canEquip, state, room }) {
      nameText.textContent = agent.name
      facts.textContent = characterFacts(character)
      if (classIcon.dataset.iconId !== character.class) {
        const nextIcon = gameIcon(character.class, 'ac-game-hero-icon')
        nextIcon.dataset.iconId = character.class
        classIcon.replaceWith(nextIcon)
        classIcon = nextIcon
      }
      const share = clampShare(character.levelProgress)
      progress.set(share, formatShare(share))
      if (canChoose) {
        picker.set({
          label: TRADES_TEXT.characterTrade(agent.name),
          options: characterTradeOptions(character, roomChoice),
          value: pickerValue(character.tradeChoice),
          iconId: character.trade ?? null
        })
      } else {
        tradeText.replaceChildren(gameIcon(character.trade, 'ac-game-trade-icon'),
          el('span', '', character.trade ? skillLabel(character.trade) : ''))
      }
      const shown = canChoose ? picker.element : tradeText
      if (tradeSlot.firstChild !== shown) tradeSlot.replaceChildren(shown)
      equip.update({ state, room, character, canChoose: canEquip })
      const shownDetails = JSON.stringify([agent.name, character.attributes])
      if (shownDetails === drawnDetails) return
      drawnDetails = shownDetails
      attributes.replaceChildren(attributeList(character, agent.name))
    }
  }
}

/** The room-wide picker: what every character here without a choice of its own gathers. */
function createRoomTradeRow(actions, getRoomId) {
  const element = el('div', 'ac-game-field ac-game-room-trade')
  const label = el('span', 'ac-game-field-label', TRADES_TEXT.roomTrade)
  const picker = tradePicker({
    key: 'trade:room',
    onPick: (choice) => actions.setRoomTrade(getRoomId(), choice)
  })
  label.setAttribute('aria-hidden', 'true')
  element.append(label, picker.element)
  return { element, set: picker.set }
}

/** "Best gear for everyone here", and the line that says what it changed. */
function createBestGearRow(actions, getRoomId) {
  const element = el('div', 'ac-game-row ac-game-best-gear')
  const result = el('span', 'ac-game-card-line')
  result.setAttribute('role', 'status')
  const run = button(EQUIP.bestGear, 'ac-button', {
    onClick: async () => {
      const answer = await actions.bestGear(getRoomId())
      if (answer) result.textContent = EQUIP.bestGearDone(answer.slotsChanged ?? 0)
    }
  })
  run.dataset.key = 'equip:best'
  run.title = EQUIP.bestGearHint
  element.append(run, result)
  return element
}

/** The Characters card: the room's picker, its note, then a card per character. */
function createCharactersCard(actions) {
  let roomId = null
  const cards = new Map()
  /** The one equipment picker open in the tab, as "sessionId|slot", or null. */
  const openSlot = {
    key: null,
    set(next) {
      openSlot.key = next
      for (const card of cards.values()) card.equip.redraw()
      if (next) cards.get(next.slice(0, next.lastIndexOf('|')))?.equip.focusPicker()
    }
  }
  const roomTrade = createRoomTradeRow(actions, () => roomId)
  const note = el('p', 'ac-game-card-line ac-muted', TRADES_TEXT.note)
  const bestGear = createBestGearRow(actions, () => roomId)
  const list = el('div', 'ac-game-heroes')
  const empty = el('p', 'ac-game-card-line', ARSENAL.noCharacters)
  const guestLine = el('p', 'ac-game-card-line')
  const element = section(ARSENAL.characters, [roomTrade.element, note, bestGear, list, empty, guestLine],
    'ac-game-party-card')
  return {
    element,
    update({ state, roomId: nextRoomId, room, actions: offered }) {
      if (nextRoomId !== roomId) {
        cards.clear()
        openSlot.key = null
      }
      roomId = nextRoomId
      const { members, guests } = roomCharacters(state, roomId)
      const canChoose = canChooseTrades(state.game, offered)
      const canEquip = state.game?.viewOnly !== true && typeof offered.setEquipment === 'function'
      bestGear.hidden = !canEquip || members.length === 0 || typeof offered.bestGear !== 'function'
      const roomChoice = room.tradeChoice ?? null
      roomTrade.element.hidden = !canChoose || members.length === 0
      note.hidden = roomTrade.element.hidden
      if (canChoose) {
        roomTrade.set({
          label: TRADES_TEXT.roomTradeLabel(roomName(state, roomId)),
          options: roomTradeOptions(),
          value: pickerValue(roomChoice),
          iconId: roomChoice
        })
      }
      const shown = members.map((member) => {
        const sessionId = member.character.sessionId
        if (!cards.has(sessionId)) {
          const name = member.agent.name
          cards.set(sessionId, createCharacterCard({ roomId, sessionId, name, actions, openSlot }))
        }
        const card = cards.get(sessionId)
        card.update(member, { roomChoice, canChoose, canEquip, state, room })
        return card.element
      })
      const kept = new Set(members.map((member) => member.character.sessionId))
      for (const sessionId of cards.keys()) if (!kept.has(sessionId)) cards.delete(sessionId)
      // Nodes move only when who is here changes, so a picker in use stays where it is.
      const isSame = shown.length === list.children.length && shown.every((node, index) => list.children[index] === node)
      if (!isSame) replaceKeepingFocus(list, shown)
      list.hidden = members.length === 0
      empty.hidden = members.length > 0
      guestLine.hidden = guests === 0
      guestLine.textContent = guests ? ARSENAL.guests(guests) : ''
    }
  }
}

/** The room's name as the room list shows it, for a picker's label. */
function roomName(state, roomId) {
  const shown = state.rooms.find((entry) => entry.id === roomId)
  return shown ? roomTitle(shown) : roomId
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
 * @param {{ actions: Record<string, (...args: unknown[]) => Promise<boolean>> }} options
 * @returns {{ element: HTMLElement,
 *   update: (next: { state: object, roomId: string, room: object }) => void }}
 */
export function createPartyView({ actions }) {
  const element = el('div', 'ac-game-party-section')
  const characters = createCharactersCard(actions)
  const retirees = el('div', 'ac-game-party-retirees')
  element.append(characters.element, retirees)
  let drawn = null
  return {
    element,
    update({ state, roomId, room }) {
      // The characters are changed in place; the retirees only when what they show changed.
      characters.update({ state, roomId, room, actions })
      const signature = JSON.stringify([roomId, room.retirees, room.retiredCount, room.bonus])
      if (signature === drawn) return
      drawn = signature
      replaceKeepingFocus(retirees, [retireesCard(room)])
    }
  }
}

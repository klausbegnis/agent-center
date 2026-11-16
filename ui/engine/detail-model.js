// What the selected agent's card says about its game character, worked out from the view state:
// nothing (no game, a subagent, an agent with no character), a guest's note, or the class, level,
// attributes, equipment and trade of a character. Never touches the DOM.
import { slotIconId } from './game-icons.js'
import { clampShare, formatShare } from './game-format.js'
import {
  ARSENAL,
  ATTRIBUTE_LABEL,
  ATTRIBUTE_SHORT,
  badgeDescription,
  characterFacts,
  equipmentSlotLabel,
  gatheringTrade,
  levelPlus,
  SLOT_LABEL
} from './labels.js'

/** A Mage's weapon is a magical one; the others' are physical. */
const weaponType = (classId) => (classId === 'magical' ? 'magical' : 'physical')

/** The text with its first letter upper-case, for a label used at the start of a line. */
const sentence = (text) => (text ? text[0].toUpperCase() + text.slice(1) : text)

/**
 * @typedef {{ kind: 'guest', text: string }} GuestCard
 * @typedef {{
 *   kind: 'member', classId: string, facts: string, progress: number, progressText: string,
 *   progressLabel: string, attributesLabel: string,
 *   attributes: { id: string, short: string, label: string, value: number }[],
 *   equipment: { slot: string, iconId: string, name: string, level: string, label: string, isEmpty: boolean }[],
 *   trade: string | null
 * }} MemberCard
 */

/**
 * What the card shows of the agent's character, or null when it shows nothing of the game.
 *
 * @param {{ game?: object } | null} state the view state
 * @param {{ id: string, name: string, parentId?: string | null } | null} agent the selected agent
 * @returns {null | GuestCard | MemberCard}
 */
export function agentCharacter(state, agent) {
  if (!agent || agent.parentId || state?.game?.status !== 'running') return null
  const character = state.game.characters?.[agent.id]
  if (!character) return null
  if (character.guest) return { kind: 'guest', text: sentence(badgeDescription({ kind: 'guest' })) }
  const progress = clampShare(character.levelProgress ?? 0)
  return {
    kind: 'member',
    classId: character.class,
    facts: characterFacts(character),
    progress,
    progressText: formatShare(progress),
    progressLabel: ARSENAL.levelProgress(agent.name),
    attributesLabel: ARSENAL.attributesShort(agent.name),
    attributes: Object.entries(ATTRIBUTE_LABEL).map(([id, label]) =>
      ({ id, short: ATTRIBUTE_SHORT[id], label, value: character.attributes?.[id] ?? 0 })),
    equipment: Object.keys(SLOT_LABEL).map((slot) => {
      const item = character.equipment?.[slot] ?? null
      return {
        slot,
        iconId: slotIconId(slot, slot === 'weapon' ? weaponType(character.class) : null),
        name: item ? item.name : ARSENAL.emptySlot,
        level: item ? levelPlus(item.level) : '',
        label: equipmentSlotLabel(slot, item),
        isEmpty: !item
      }
    }),
    // A character gathers its trade while its agent is idle (done); otherwise it fights or waits.
    trade: character.state === 'idle' && character.trade ? gatheringTrade(character.trade) : null
  }
}

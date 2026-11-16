// The card that describes the selected agent, and, while the game runs, its character: class,
// level and progress, attributes, equipment and trade, in two short rows under the agent's facts.
import { agentCharacter } from './detail-model.js'
import { button, el } from './dom.js'
import { meter } from './game-controls.js'
import { gameIcon } from './icon-view.js'
import { legendaryPicture } from './legendary-art.js'
import { activityLabel, since, subagentOf } from './labels.js'

/** The character's class, level, progress and trade on one line. */
function characterHead(card) {
  const head = el('div', 'ac-detail-hero')
  head.append(gameIcon(card.classId, 'ac-detail-icon'), el('strong', 'ac-detail-facts', card.facts))
  const progress = meter('ac-detail-progress', card.progressLabel)
  progress.set(card.progress, card.progressText)
  head.append(progress.element)
  if (card.trade) head.append(el('span', 'ac-muted ac-detail-trade', card.trade))
  return head
}

/** The seven attributes as short pairs, each short name carrying its full name. */
function attributeRow(card) {
  const list = el('dl', 'ac-detail-attributes')
  list.setAttribute('aria-label', card.attributesLabel)
  for (const attribute of card.attributes) {
    const pair = el('div', 'ac-detail-attribute')
    const short = el('abbr', '', attribute.short)
    short.title = attribute.label
    const term = el('dt', '')
    term.append(short)
    pair.append(term, el('dd', '', String(attribute.value)))
    list.append(pair)
  }
  return list
}

/**
 * The three slots, each its icon and the item's name with its upgrade level; a legendary item
 * shows its own picture and its name in gold.
 */
function equipmentRow(card, base) {
  const list = el('ul', 'ac-detail-equipment')
  for (const slot of card.equipment) {
    const row = el('li', slot.isEmpty ? 'ac-detail-slot ac-muted' : 'ac-detail-slot')
    row.title = slot.label
    row.setAttribute('aria-label', slot.label)
    const name = el('span', 'ac-detail-slot-name', slot.name)
    name.setAttribute('aria-hidden', 'true')
    const icon = slot.legendaryId
      ? legendaryPicture(base, slot.legendaryId, { glow: true, className: 'ac-detail-icon ac-detail-legendary-art' })
      : gameIcon(slot.iconId, 'ac-detail-icon')
    row.classList.toggle('ac-detail-slot-legendary', Boolean(slot.legendaryId))
    row.append(icon, name)
    if (slot.level) {
      const level = el('span', 'ac-detail-slot-level', slot.level)
      level.setAttribute('aria-hidden', 'true')
      row.append(level)
    }
    list.append(row)
  }
  return list
}

/** The room's active relic: its small picture and what it does. */
function relicRow(relic, base) {
  const row = el('div', 'ac-detail-relic')
  row.title = relic.line
  row.append(legendaryPicture(base, relic.id, { glow: true, className: 'ac-detail-icon ac-detail-legendary-art' }),
    el('span', 'ac-detail-relic-text', relic.line))
  return row
}

/** What the card adds for the agent's game character, or nothing. */
function characterPart(card, base) {
  if (!card) return []
  const part = el('div', 'ac-detail-game')
  if (card.kind === 'guest') part.append(el('span', 'ac-muted', card.text))
  else part.append(characterHead(card), attributeRow(card), equipmentRow(card, base))
  if (card.relic) part.append(relicRow(card.relic, base))
  return [part]
}

/**
 * @param {{ openWorkspace?: (workspaceId: string, agentId: string) => unknown }} transport
 * @param {{ onOpenWorkspace?: () => void }} [options] `onOpenWorkspace` runs after the button
 *   asked Orca to open the agent's workspace
 */
export function createDetail(transport, { onOpenWorkspace } = {}) {
  const element = el('aside', 'ac-detail')
  element.hidden = true

  return {
    element,
    /**
     * Shows an agent, or hides the card when there is none.
     *
     * @param {object | null} agent
     * @param {{ name: string } | null} [parent] the agent a subagent works for
     * @param {object | null} [state] the view state, for the agent's game character
     */
    show(agent, parent = null, state = null) {
      element.hidden = !agent
      element.replaceChildren()
      if (!agent) return

      const facts = [agent.kind, agent.folder, agent.branch, agent.parentId ? subagentOf(parent?.name) : null]
      const info = el('div', 'ac-detail-info')
      info.append(el('strong', '', agent.name), el('span', 'ac-muted', facts.filter(Boolean).join(' · ')))

      const status = el('div', 'ac-detail-status')
      status.append(
        el('strong', `ac-state-${agent.activity}`, activityLabel(agent.activity)),
        el('span', 'ac-muted', since(agent.since))
      )
      element.append(info, status)

      if (transport.openWorkspace && agent.workspaceId) {
        element.append(
          button('Open workspace', 'ac-button ac-primary', {
            onClick: () => {
              transport.openWorkspace(agent.workspaceId, agent.id)
              onOpenWorkspace?.()
            }
          })
        )
      }
      element.append(...characterPart(agentCharacter(state, agent), transport.base ?? ''))
    }
  }
}

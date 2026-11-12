// The card that describes the selected agent.
import { button, el } from './dom.js'
import { activityLabel, since, subagentOf } from './labels.js'

/** @param {{ openWorkspace?: (workspaceId: string, agentId: string) => unknown }} transport */
export function createDetail(transport) {
  const element = el('aside', 'ac-detail')
  element.hidden = true

  return {
    element,
    /**
     * Shows an agent, or hides the card when there is none.
     *
     * @param {object | null} agent
     * @param {{ name: string } | null} [parent] the agent a subagent works for
     */
    show(agent, parent = null) {
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
            onClick: () => transport.openWorkspace(agent.workspaceId, agent.id)
          })
        )
      }
    }
  }
}

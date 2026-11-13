// The Skills tab: the world's level and attack speed, the five work skills and the six gathering
// skills with level, stars, progress and what each does, and prestige for a skill at the cap.
import { el, select, setOptions } from './dom.js'
import { confirmButton, meter, replaceKeepingFocus, section } from './game-controls.js'
import { clampShare, formatFactor, formatShare } from './game-format.js'
import { worldById } from './game-model.js'
import { prestigeQuestion, SKILLS, skillEffect, skillLabel, skillLevelText, starsLabel } from './labels.js'

/**
 * @param {{
 *   panel: HTMLElement,
 *   actions: Record<string, (...args: unknown[]) => Promise<boolean>>
 * }} options
 */
export function createSkillsView({ panel, actions }) {
  let wantedWorldId = null
  let state = null
  let drawn = null
  /** Prestige questions open now, by skill, so a redraw does not close one being read. */
  const openQuestions = new Set()

  const head = el('section', 'ac-game-card')
  const worldField = el('label', 'ac-game-field')
  const worldSelect = select('ac-select', SKILLS.world)
  worldSelect.removeAttribute('aria-label')
  worldSelect.addEventListener('change', () => {
    wantedWorldId = worldSelect.value
    draw()
  })
  worldField.append(el('span', 'ac-game-field-label', SKILLS.world), worldSelect)
  const summary = el('div', 'ac-game-summary')
  head.append(worldField, summary)
  const body = el('div', 'ac-game-panel-body')
  panel.append(head, body)

  function skillRow(world, skill, speedText) {
    const name = skillLabel(skill.id)
    const node = el('article', 'ac-game-entry ac-game-skill')
    const title = el('div', 'ac-game-entry-head')
    const label = el('strong', 'ac-game-entry-name', name)
    const stars = starsLabel(skill.stars)
    if (stars.short) {
      const mark = el('span', 'ac-game-stars', stars.short)
      mark.title = stars.full
      mark.setAttribute('aria-label', stars.full)
      label.append(' ', mark)
    }
    title.append(label, el('span', 'ac-muted', skillLevelText(skill)))
    const progress = meter('ac-game-progress', SKILLS.progress(name))
    const share = clampShare(skill.progress)
    progress.set(share, skill.canPrestige ? SKILLS.atCap : formatShare(share))
    node.append(title, progress.element, el('span', 'ac-game-card-line', skillEffect(skill.id, speedText)))
    if (skill.canPrestige && actions.prestigeSkill) {
      const key = `prestige:${skill.id}`
      node.append(confirmButton({
        label: SKILLS.prestige,
        ariaLabel: SKILLS.prestigeSkill(skill.id),
        question: prestigeQuestion(skill),
        confirm: SKILLS.confirmPrestige(skill.id),
        className: 'ac-primary',
        confirmClassName: 'ac-primary',
        key,
        isOpen: openQuestions.has(key),
        onOpenChange: (isOpen) => (isOpen ? openQuestions.add(key) : openQuestions.delete(key)),
        onConfirm: () => actions.prestigeSkill(world.id, skill.id)
      }))
    }
    return node
  }

  function skillsCard(title, note, world, skills, speedText) {
    const list = el('div', 'ac-game-list')
    list.append(...skills.map((skill) => skillRow(world, skill, speedText)))
    return section(title, [el('p', 'ac-game-card-line', note), list])
  }

  function draw() {
    if (!state) return
    const worlds = state.game.worlds ?? []
    setOptions(worldSelect, worlds.map((world) => [world.id, world.id]))
    worldField.hidden = worlds.length < 2
    const world = worldById(state.game, wantedWorldId) ?? worlds[0] ?? null
    if (world) worldSelect.value = world.id
    const signature = JSON.stringify(world)
    if (signature === drawn) return
    drawn = signature
    if (!world) {
      summary.replaceChildren()
      body.replaceChildren()
      return
    }
    const speedText = formatFactor(world.attackSpeed)
    summary.replaceChildren(
      el('strong', 'ac-game-summary-level', SKILLS.worldLevel(world.level)),
      el('span', 'ac-muted', SKILLS.attackSpeed(speedText)),
      el('p', 'ac-game-card-line', SKILLS.worldNote)
    )
    replaceKeepingFocus(body, [
      skillsCard(SKILLS.work, SKILLS.workNote, world, world.workSkills ?? [], speedText),
      skillsCard(SKILLS.gathering, SKILLS.gatheringNote, world, world.gatheringSkills ?? [], speedText)
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

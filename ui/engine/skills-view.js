// The Skills tab: the world's level and attack speed, then one row per skill, the five work
// skills and the six gathering skills in two groups. A row has the skill's icon, name, level,
// stars, a progress bar in the skill's colour and one line of what it does, and prestige for a
// skill at the cap.
import { el, select, setOptions } from './dom.js'
import { confirmButton, replaceKeepingFocus, section } from './game-controls.js'
import { clampShare, formatFactor, formatShare } from './game-format.js'
import { iconColor } from './game-icons.js'
import { worldById } from './game-model.js'
import { gameIcon, iconLabel } from './icon-view.js'
import {
  effectiveText,
  levelShort,
  prestigeQuestion,
  SKILLS,
  skillEffect,
  skillLabel,
  starsLabel
} from './labels.js'

/** Stars are drawn one by one up to this many; more are written as a count. */
const STARS_DRAWN = 5

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

  const head = el('section', 'ac-game-card ac-game-skills-head')
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

  /** The stars of a skill: a star icon each, or one star and a count when there are many. */
  function starsOf(stars) {
    const label = starsLabel(stars)
    const node = el('span', 'ac-game-stars')
    node.setAttribute('role', 'img')
    node.setAttribute('aria-label', label.full)
    node.title = label.full
    const drawnStars = stars > STARS_DRAWN ? 1 : stars
    for (let index = 0; index < drawnStars; index += 1) node.append(gameIcon('star', 'ac-game-star'))
    if (stars > STARS_DRAWN) node.append(el('span', 'ac-game-stars-count', `×${stars}`))
    return node
  }

  function skillRow(world, skill, speedText) {
    const name = skillLabel(skill.id)
    const node = el('article', 'ac-game-skill')
    node.style.setProperty('--ac-skill-color', iconColor(skill.id) ?? 'var(--ac-game-good)')
    const title = el('div', 'ac-game-skill-title')
    title.append(gameIcon(skill.id, 'ac-game-skill-icon'), el('strong', 'ac-game-skill-name', name))
    if (skill.stars) title.append(starsOf(skill.stars))
    const level = el('span', 'ac-game-skill-level', levelShort(skill.level))
    const effective = effectiveText(skill)
    if (effective) level.append(el('span', 'ac-muted', ` · ${effective}`))

    const share = clampShare(skill.progress)
    const bar = el('span', 'ac-game-skill-bar')
    bar.setAttribute('role', 'progressbar')
    bar.setAttribute('aria-label', SKILLS.progress(name))
    bar.setAttribute('aria-valuemin', '0')
    bar.setAttribute('aria-valuemax', '100')
    bar.setAttribute('aria-valuenow', String(Math.round(share * 100)))
    const fill = el('span', 'ac-game-skill-fill')
    fill.style.width = `${share * 100}%`
    bar.append(fill)
    const percent = el('span', 'ac-game-skill-percent', skill.canPrestige ? SKILLS.atCap : formatShare(share))

    const effect = el('span', 'ac-game-skill-effect', skillEffect(skill.id, speedText))
    node.append(title, level, bar, percent, effect)
    if (skill.canPrestige && actions.prestigeSkill) node.append(prestigeControl(world, skill))
    return node
  }

  function prestigeControl(world, skill) {
    const key = `prestige:${skill.id}`
    const control = confirmButton({
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
    })
    control.classList.add('ac-game-skill-prestige')
    return control
  }

  function skillsCard(title, note, world, skills, speedText) {
    const list = el('div', 'ac-game-skill-list')
    list.append(...skills.map((skill) => skillRow(world, skill, speedText)))
    return section(title, [el('p', 'ac-game-card-line', note), list])
  }

  function drawSummary(world, speedText) {
    const level = el('div', 'ac-game-summary-item')
    level.append(
      el('span', 'ac-game-summary-label', SKILLS.worldLevelName),
      el('strong', 'ac-game-summary-value', String(world.level))
    )
    const speed = el('div', 'ac-game-summary-item')
    speed.append(
      iconLabel('engineering', SKILLS.attackSpeedName, 'ac-game-summary-label'),
      el('strong', 'ac-game-summary-value', speedText)
    )
    speed.title = SKILLS.attackSpeedNote
    summary.replaceChildren(level, speed, el('p', 'ac-game-card-line', SKILLS.worldNote))
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
    drawSummary(world, speedText)
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

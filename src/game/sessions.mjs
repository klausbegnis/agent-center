// What a session does to the save outside of fights: the tokens it spends become experience for
// its world and its character (creating the project and the character when needed), and closing
// it retires the character.
import { createCharacter, grantCharacterXp } from './characters.mjs'
import { addToChest, equipFromChest } from './chest.mjs'
import { createItem } from './items.mjs'
import { heldEffects, legendaryIndexOf, relicEffects, tokenBonuses } from './legendary-effects.mjs'
import { equipLegendary } from './legendary-equip.mjs'
import { emptySkill, grantSkillXp, worldLevel, xpFromTokens } from './progression.mjs'
import { comeBack, retire } from './retirement.mjs'
import { CLASSES, skillForActivity } from './skills.mjs'
import { effectiveTrade } from './trades.mjs'
import { worldEffectsOf } from './world-effects.mjs'
import { emptyProject, withCharacter, withProjectIn, withWorld, worldIdOf } from './worlds.mjs'

/** The lowest generic tier of a slot (and damage type), for a new project's starting chest. */
function starterEntry(items, slot, damageType) {
  const fitting = items.filter((entry) => entry.themes === undefined && entry.slot === slot &&
    (damageType === undefined || entry.damageType === damageType))
  return fitting.reduce((low, entry) => (low === null || entry.tier < low.tier ? entry : low), null)
}

/**
 * A project joining the game: its wave at the world level, and a chest with a plain weapon for
 * each class, an outfit and a tool, so every upgrade has something to work on from the start.
 */
function newProject(wave, content) {
  const wanted = [
    ...CLASSES.map((className) => ['weapon', className === 'magical' ? 'magical' : 'physical']),
    ['outfit'],
    ['tool']
  ]
  let chest = []
  for (const [slot, damageType] of wanted) {
    const entry = starterEntry(content.items.items, slot, damageType)
    if (entry) chest = addToChest(chest, createItem(entry))
  }
  return { ...emptyProject({ wave }), chest }
}

/** The fields the engine adds to a character, filled in for one that came back from an older record. */
const withEngineFields = (character) => ({
  skillXp: {}, gatherCarry: 0, title: null, state: 'idle', tradeChoice: null, ...character
})

/**
 * The session's character, created, or back from retirement, and equipped from the chest:
 * legendary equipment made for it first (legendary-equip.mjs).
 */
function ensureCharacter(project, { sessionId, skills, now, index }) {
  if (project.characters[sessionId]) return project
  const back = comeBack(project, sessionId, { now })
  const livingClasses = Object.values(project.characters).map((character) => character.class)
  const base = back ? back.project : project
  const born = back ? back.character : createCharacter({ sessionId, livingClasses, skills, now })
  const character = withEngineFields(born)
  const picker = { ...character, trade: effectiveTrade(character, base) }
  const { chest, equipment } = equipLegendary(equipFromChest(base.chest, character), picker, index)
  return withCharacter({ ...base, chest }, { ...character, equipment })
}

/**
 * The work skill a character earned most experience in; ties go to the first in alphabetical order.
 *
 * @param {{ skillXp?: Record<string, number> }} character
 * @returns {string | null}
 */
export function mainSkillOf(character) {
  let chosen = null
  for (const [skillId, xp] of Object.entries(character.skillXp ?? {}).sort()) {
    if (chosen === null || xp > character.skillXp[chosen]) chosen = skillId
  }
  return chosen
}

/**
 * Counts the tokens a session spent since the last reading.
 *
 * @param {object} save
 * @param {{ projectId: string, sessionId: string, tokens: number, activity: string, now: number,
 *   themeId?: string | null, title?: string | null, guest?: boolean }} reading
 * @param {{ items: { items: object[] }, legendary?: object }} content the parsed game content; the
 *   room's relic and the character's legendary equipment can make the experience worth more
 * @returns {object}
 */
export function applyTokens(save, reading, content) {
  const { projectId, sessionId, tokens, activity, now, themeId = null, title = null, guest = false } = reading
  const worldId = worldIdOf(save, projectId)
  const xp = xpFromTokens(tokens)
  if (guest || worldId === null || xp <= 0) return save
  return withWorld(save, worldId, (world) => {
    const skillId = skillForActivity(activity)
    const fresh = !world.projects[projectId]
    let project = fresh ? newProject(worldLevel(world.skills), content) : world.projects[projectId]
    project = { ...project, themeId: themeId ?? project.themeId }
    const index = legendaryIndexOf(content)
    project = ensureCharacter(project, { sessionId, skills: world.skills, now, index })
    const held = heldEffects(project, project.characters[sessionId], index)
    const bonus = tokenBonuses([...relicEffects(project, index), ...worldEffectsOf(world, content)], held, skillId)
    const character = grantCharacterXp(project.characters[sessionId], xp * bonus.characterFactor, activity)
    const skillXp = skillId
      ? { ...character.skillXp, [skillId]: (character.skillXp[skillId] ?? 0) + xp }
      : character.skillXp
    const keptTitle = save.settings.keepTitles && title ? title : character.title
    const tokensSpent = character.tokens + tokens
    const updated = { ...character, tokens: tokensSpent, lastSeenAt: now, skillXp, title: keptTitle }
    const skills = skillId
      ? { ...world.skills, [skillId]: grantSkillXp(world.skills[skillId] ?? emptySkill(), xp * bonus.skillFactor) }
      : world.skills
    const lastTokenAt = Math.max(world.lastTokenAt ?? now, now)
    return withProjectIn({ ...world, skills, lastTokenAt }, projectId, withCharacter(project, updated))
  })
}

/**
 * Retires a closed session's character.
 *
 * @param {object} save
 * @param {{ projectId: string, sessionId: string, now: number, title?: string | null }} closing
 * @returns {object}
 */
export function closeSession(save, { projectId, sessionId, now, title = null }) {
  const worldId = worldIdOf(save, projectId)
  const project = worldId === null ? null : save.worlds[worldId]?.projects[projectId]
  const character = project?.characters[sessionId]
  if (!character) return save
  const keepTitle = save.settings.keepTitles
  const kept = title ?? character.title ?? null
  const details = { now, mainSkill: mainSkillOf(character), title: kept, keepTitle }
  const retired = retire(project, sessionId, details)
  return withWorld(save, worldId, (world) => withProjectIn(world, projectId, retired))
}

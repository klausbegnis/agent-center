// Retirement: a closed session's character leaves its project, puts its items back in the chest
// and leaves a record behind; the same session can come back from it.
import { releaseItems } from './chest.mjs'
import { RETIREE_BONUS, RETIREE_BONUS_MAX, RETIREES_KEPT } from './constants.mjs'
import { hashOf } from './hash.mjs'
import { tradeChoiceOf } from './trades.mjs'

/**
 * The record a retiring character leaves. Beyond the fields docs/GAME.md lists, it keeps the
 * character's trade, the trade chosen for it and its birth time so a session that comes back is
 * the same character.
 */
function retireeOf(character, { now, mainSkill, title, keepTitle }) {
  return {
    sessionId: character.sessionId,
    nameId: hashOf(character.sessionId),
    class: character.class,
    level: character.level,
    xp: character.xp,
    attributes: { ...character.attributes },
    tokens: character.tokens,
    mainSkill,
    retiredAt: now,
    title: keepTitle ? title : null,
    trade: character.trade ?? null,
    tradeChoice: tradeChoiceOf(character.tradeChoice),
    bornAt: character.bornAt ?? null
  }
}

/**
 * Retires a session's character. A project with no such character is returned as it is.
 *
 * @param {object} project
 * @param {string} sessionId
 * @param {{ now: number, mainSkill: string, title?: string | null, keepTitle?: boolean }} details
 *   `mainSkill` is the work skill the character earned most experience in.
 * @returns {object} the new project
 */
export function retire(project, sessionId, { now, mainSkill, title = null, keepTitle = false }) {
  const character = project.characters[sessionId]
  if (!character) return project
  const characters = { ...project.characters }
  delete characters[sessionId]
  const record = retireeOf(character, { now, mainSkill, title, keepTitle })
  const retirees = [record, ...project.retirees.filter((retiree) => retiree.sessionId !== sessionId)]
  const dropped = Math.max(0, retirees.length - RETIREES_KEPT)
  return {
    ...project,
    characters,
    chest: releaseItems(project.chest, sessionId),
    retirees: retirees.slice(0, RETIREES_KEPT),
    retiredCount: project.retiredCount + dropped
  }
}

/**
 * Brings a retired session back with its level, experience, attributes and tokens. Its
 * equipment is empty: the caller equips it from the chest, where its old items are when free.
 *
 * @param {object} project
 * @param {string} sessionId
 * @param {{ now: number }} clock
 * @returns {{ project: object, character: object } | null} null when that session never retired
 *   here or its record was folded into the counter
 */
export function comeBack(project, sessionId, { now }) {
  const record = project.retirees.find((retiree) => retiree.sessionId === sessionId)
  if (!record) return null
  const character = {
    sessionId,
    class: record.class,
    level: record.level,
    xp: record.xp,
    attributes: { ...record.attributes },
    levelActivityXp: {},
    equipment: { weapon: null, outfit: null, tool: null },
    trade: record.trade ?? null,
    tradeChoice: tradeChoiceOf(record.tradeChoice),
    tokens: record.tokens,
    bornAt: record.bornAt ?? now,
    lastSeenAt: now
  }
  return {
    project: {
      ...project,
      characters: { ...project.characters, [sessionId]: character },
      retirees: project.retirees.filter((retiree) => retiree.sessionId !== sessionId)
    },
    character
  }
}

/**
 * What the project's retirees add to its gathering, kept records and folded ones alike.
 *
 * @param {{ retirees: object[], retiredCount: number }} project
 * @returns {number} a share, such as 0.12 for +12%
 */
export function retireeBonus(project) {
  return Math.min(RETIREE_BONUS_MAX, RETIREE_BONUS * (project.retirees.length + project.retiredCount))
}

/**
 * Drops every retiree's session title, for when the setting that allows keeping them is turned
 * off.
 *
 * @param {object} project
 * @returns {object}
 */
export function forgetTitles(project) {
  return { ...project, retirees: project.retirees.map((retiree) => ({ ...retiree, title: null })) }
}

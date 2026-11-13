// Every piece of text the engine shows. Kept in one place so wording stays consistent.
import { RANDOM_THEME } from './room-themes.js'

export const ACTIVITY_LABEL = {
  write: 'Writing code',
  read: 'Reading files',
  run: 'Running a command',
  think: 'Thinking',
  delegate: 'Delegating',
  wait: 'Waiting for you',
  blocked: 'Blocked',
  done: 'Finished, not seen yet',
  sleep: 'Done'
}

/** What floats above a character's head for the states that need attention. */
export const BUBBLE = { wait: '?', blocked: '!', done: '✓', sleep: 'zz' }

export function activityLabel(activity) {
  return ACTIVITY_LABEL[activity] ?? activity
}

/** What a subagent is called next to its other facts: "subagent of Fix checkout rounding". */
export function subagentOf(parentName) {
  return parentName ? `subagent of ${parentName}` : 'subagent'
}

/**
 * What a screen reader says for a character: "Explore: Reading files", and for a subagent
 * "Explore: Reading files, subagent of Fix checkout rounding".
 *
 * @param {{ name: string, activity: string, parentId: string | null }} agent
 * @param {string} [parentName]
 */
export function actorDescription(agent, parentName) {
  const description = `${agent.name}: ${activityLabel(agent.activity)}`
  return agent.parentId === null ? description : `${description}, ${subagentOf(parentName)}`
}

/** "just now", "4 min ago", "2 h ago". */
export function since(timestamp, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - timestamp) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  return `${Math.floor(minutes / 60)} h ago`
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

/** "3 agents · 1 subagent", or "empty". */
export function occupancy(agents) {
  if (agents.length === 0) return 'empty'
  const mains = agents.filter((agent) => agent.parentId === null).length
  const subs = agents.length - mains
  return subs ? `${plural(mains, 'agent')} · ${plural(subs, 'subagent')}` : plural(mains, 'agent')
}

/**
 * The marker for the subagents a crowded agent has no room to show: "+3", spelled out as
 * "3 more subagents".
 *
 * @returns {{ short: string, full: string }}
 */
export function hiddenSubagents(count) {
  return { short: `+${count}`, full: plural(count, 'more subagent') }
}

/** "turbo-waffle · build-box"; the host is left out for this machine. */
export function roomTitle(room) {
  return room.host && room.host !== 'local' ? `${room.name} · ${room.host}` : room.name
}

/** What the choice that gives each room a theme of its own is called. */
export const RANDOM_THEME_LABEL = 'Random'

const themeOptions = (themes) => themes.map((theme) => [theme.id, theme.name])

/** What the default theme is called: "Random", a theme's name, or the id of one that is gone. */
export function defaultThemeName(state) {
  if (state.theme === RANDOM_THEME) return RANDOM_THEME_LABEL
  return state.themes.find((theme) => theme.id === state.theme)?.name ?? state.theme
}

/**
 * The choices for the default theme: Random first, then every theme.
 *
 * @returns {[value: string, label: string][]}
 */
export function defaultThemeOptions(state) {
  return [[RANDOM_THEME, RANDOM_THEME_LABEL], ...themeOptions(state.themes)]
}

/**
 * The choices for one room: "Default (Random)" or "Default (<theme name>)" under the empty
 * value, then every theme.
 *
 * @returns {[value: string, label: string][]}
 */
export function roomThemeOptions(state) {
  return [['', `Default (${defaultThemeName(state)})`], ...themeOptions(state.themes)]
}

/** What is shown instead of the rooms when no theme loaded for the default. */
export function themeLoadFailure(state) {
  if (state.theme === RANDOM_THEME) return 'Could not load any theme.'
  return `Could not load the theme "${state.theme}".`
}

// The game. Its wording is kept here with the rest; the game's own facts come from the view state.

/** The game's tabs. */
export const GAME_TAB_LABEL = { rooms: 'Rooms', arsenal: 'Arsenal', skills: 'Skills' }
export const GAME_TABS_NAME = 'Game views'

/** The small marker by the tabs, and what it means, when token totals are not reported. */
export const ESTIMATED_MARKER = 'Estimated'
export const ESTIMATED_NOTE =
  'Progress is estimated from working time because this Orca does not report token totals yet.'

/**
 * What the Arsenal and Skills tabs say when the game cannot run.
 *
 * @param {string} status the view state's `game.status`
 * @returns {{ title: string, lines: string[] }}
 */
export function gameUnavailable(status) {
  const rooms = 'The rooms work as usual.'
  if (status === 'needs-permission') {
    return {
      title: 'The game needs to count tokens',
      lines: [
        'Game mode turns the tokens your sessions spend into progress. To count them, the plugin ' +
          'needs Orca\'s permission to read this computer\'s session history. It reads only the ' +
          'token total of each session, never a conversation or a file.',
        'Grant the permission in Orca\'s plugin settings, or turn game mode off there.',
        rooms
      ]
    }
  }
  if (status === 'unsupported') {
    return {
      title: 'This Orca cannot run the game',
      lines: ['This version of Orca does not offer the session history the game counts tokens from.', rooms]
    }
  }
  if (status === 'newer-save') {
    return {
      title: 'The game was saved by a newer version',
      lines: ['Update Agent Center to carry on. Nothing in the save was changed.', rooms]
    }
  }
  return { title: 'The game is not available', lines: [rooms] }
}

const ACTION_NAMES = {
  prestigeSkill: 'Prestige',
  upgradeItem: 'The upgrade',
  buyGroupUpgrade: 'The purchase',
  moveRoomToWorld: 'Moving the room',
  resetWorld: 'The reset',
  setAutoSpend: 'Changing auto-spend',
  setKeepTitles: 'Changing the titles setting'
}

/** "The upgrade did not go through. Try again in a moment." */
export function gameActionFailed(action) {
  return `${ACTION_NAMES[action] ?? 'That'} did not go through. Try again in a moment.`
}

/** What is said when the worker took an action but nothing changed, such as an upgrade it could not pay for. */
export function gameActionUnchanged(action) {
  return `${ACTION_NAMES[action] ?? 'That'} changed nothing: the game has moved on since this was drawn.`
}

/** The four classes, by their id in the game. */
export const CLASS_LABEL = { physical: 'Fighter', magical: 'Mage', defense: 'Guardian', support: 'Healer' }

/** Work and gathering skills; a gathering trade is called by its skill. */
export const SKILL_LABEL = {
  forge: 'Forge',
  lore: 'Lore',
  engineering: 'Engineering',
  arcana: 'Arcana',
  command: 'Command',
  mining: 'Mining',
  fishing: 'Fishing',
  farming: 'Farming',
  woodcutting: 'Woodcutting',
  hunting: 'Hunting',
  runecraft: 'Runecraft'
}

/** What a room's party is doing, and the longer reason given on hover. */
export const PARTY_LABEL = { fighting: 'Fighting', resting: 'Resting', paused: 'Paused', idle: 'Idle' }
const PARTY_REASON = {
  fighting: 'The working agents are fighting.',
  resting: 'The party ran out of stamina and is resting before it fights on.',
  paused: 'An agent is waiting for you, so this room\'s fight waits too.',
  idle: 'No agent is working; idle characters gather materials.'
}

const MONSTER_KIND_LABEL = { common: 'Common', armored: 'Armored', ethereal: 'Ethereal', boss: 'Boss' }
const AFFIX_LABEL = {
  regenerating: 'Regenerating',
  enraged: 'Enraged',
  thorny: 'Thorny',
  swift: 'Swift',
  armored: 'Armored',
  ethereal: 'Ethereal'
}

const labelOf = (table, id) => table[id] ?? id ?? ''
export const classLabel = (classId) => labelOf(CLASS_LABEL, classId)
export const skillLabel = (skillId) => labelOf(SKILL_LABEL, skillId)
export const partyLabel = (party) => labelOf(PARTY_LABEL, party)
export const partyReason = (party) => PARTY_REASON[party] ?? ''

/** "Wave 15". */
export const waveLabel = (wave) => `Wave ${wave}`

/** "2/16" kills towards the next wave, spelled out as "2 of 16 kills to pass wave 15". */
export function waveKillsLabel({ wave, waveKills, killsToPass }) {
  return {
    short: `${waveKills}/${killsToPass}`,
    full: `${waveKills} of ${killsToPass} ${killsToPass === 1 ? 'kill' : 'kills'} to pass wave ${wave}`
  }
}

/** The tag a monster wears when it is not a common one: "Boss", "Elite · Thorny", or null. */
export function monsterTag(monster) {
  if (!monster) return null
  if (monster.kind === 'boss') return MONSTER_KIND_LABEL.boss
  if (monster.affix) return `Elite · ${labelOf(AFFIX_LABEL, monster.affix)}`
  return null
}

/** "Lv 15". */
export const levelShort = (level) => `Lv ${level}`

/** What a screen reader says for a monster: "Iron-Bound Practice Dummy, level 15, armored, 12% health". */
export function monsterDescription(monster, healthText) {
  const parts = [monster.name, `level ${monster.level}`]
  if (monster.kind === 'boss') parts.push('boss')
  else if (monster.kind && monster.kind !== 'common') parts.push(labelOf(MONSTER_KIND_LABEL, monster.kind).toLowerCase())
  if (monster.affix && monster.kind !== 'boss') parts.push(`elite, ${labelOf(AFFIX_LABEL, monster.affix).toLowerCase()}`)
  parts.push(`${healthText} health`)
  return parts.join(', ')
}

/** The labels of a room's fight that are not the monster's. */
export const NO_MONSTER = 'No foe in sight'
export const HEALTH_NAME = 'Health'
export const STAMINA_NAME = 'Stamina'
export const GUEST_MARK = 'guest'

/**
 * What a character's mark adds to its description: "level 9 Healer", "level 9 Healer,
 * gathering Fishing", or "guest, keeps no progress".
 */
export function badgeDescription(badge) {
  if (badge.kind === 'guest') return 'guest, keeps no progress'
  const base = `level ${badge.level} ${classLabel(badge.classId)}`
  return badge.isGathering ? `${base}, gathering ${skillLabel(badge.trade)}` : base
}

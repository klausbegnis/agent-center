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

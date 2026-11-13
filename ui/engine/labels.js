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
      title: 'The game could not start',
      lines: ['Its content files did not load. Reinstalling the plugin should bring them back.', rooms]
    }
  }
  if (status === 'newer-save') {
    return {
      title: 'The game was saved by a newer version',
      lines: ['Update Agent Center to carry on. Nothing in the save was changed.', rooms]
    }
  }
  return { title: 'The game is not running', lines: ['Game mode is on, but the game cannot run now.', rooms] }
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

/** What is said when the worker took an action but nothing changed, such as an unpaid upgrade. */
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

/**
 * What a room's party is doing (see partyStatusOf in game-model.js), and the longer reason given
 * on hover. A paused party says why in its label.
 */
export const PARTY_LABEL = {
  fighting: 'Fighting',
  resting: 'Resting',
  idle: 'Idle',
  starting: 'Getting ready',
  waiting: 'Waits for you',
  blocked: 'Agent blocked'
}
const PARTY_REASON = {
  fighting: 'The working agents are fighting.',
  resting: 'The party ran out of stamina and is resting before it fights on.',
  idle: 'No agent is working; idle characters gather materials.',
  starting: 'The party has just formed; its first foe arrives in a moment.',
  waiting: 'An agent is waiting for you, so this room\'s fight waits too.',
  blocked: 'An agent is blocked and needs you, so this room\'s fight waits too.'
}
/** What the band says where the monster would be, when there is none, by the party's status. */
const NO_MONSTER_LABEL = {
  idle: 'Party idle, gathering',
  starting: 'A foe approaches',
  waiting: 'Fight on hold',
  blocked: 'Fight on hold'
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
  else if (monster.kind && monster.kind !== 'common') {
    parts.push(labelOf(MONSTER_KIND_LABEL, monster.kind).toLowerCase())
  }
  if (monster.affix && monster.kind !== 'boss') {
    parts.push(`elite, ${labelOf(AFFIX_LABEL, monster.affix).toLowerCase()}`)
  }
  parts.push(`${healthText} health`)
  return parts.join(', ')
}

/** What stands in for the monster's name while there is none: "Party idle, gathering". */
export const noMonsterLabel = (party) => NO_MONSTER_LABEL[party] ?? NO_MONSTER_LABEL.starting

/** The labels of a room's fight that are not the monster's. */
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

/** Materials, the work ones first, then the gathering ones. */
export const MATERIAL_LABEL = {
  bars: 'Bars',
  pages: 'Pages',
  gears: 'Gears',
  crystals: 'Crystals',
  seals: 'Seals',
  ore: 'Ore',
  fish: 'Fish',
  crops: 'Crops',
  logs: 'Logs',
  hides: 'Hides',
  runes: 'Runes'
}
export const materialLabel = (id) => labelOf(MATERIAL_LABEL, id)

export const SLOT_LABEL = { weapon: 'Weapon', outfit: 'Outfit', tool: 'Tool' }
export const ATTRIBUTE_LABEL = {
  strength: 'Strength',
  arcane: 'Arcane',
  agility: 'Agility',
  precision: 'Precision',
  resilience: 'Resilience',
  medicine: 'Medicine',
  luck: 'Luck'
}
const DAMAGE_LABEL = { physical: 'physical', magical: 'magical' }
export const UPGRADE_LABEL = { campfire: 'Campfire', workbench: 'Workbench', runeCircle: 'Rune circle' }

/**
 * "120 Bars, 40 Logs".
 *
 * @param {{ id: string, amount: number }[]} entries
 * @param {(amount: number) => string} format
 */
export function materialsText(entries, format) {
  return entries.map(({ id, amount }) => `${format(amount)} ${materialLabel(id)}`).join(', ')
}

/** "Needs 115 more Bars, 12 more Hides". */
export function missingText(entries, format) {
  return `Needs ${entries.map(({ id, amount }) => `${format(amount)} more ${materialLabel(id)}`).join(', ')}`
}

/** "Weapon · magical · Tier 2 · Lv 3". */
export function itemFacts(item) {
  const slot = labelOf(SLOT_LABEL, item.slot)
  return [slot, DAMAGE_LABEL[item.damageType], `Tier ${item.tier}`, levelShort(item.level)]
    .filter(Boolean)
    .join(' · ')
}

/** Who holds an item: "Held by Fix checkout rounding", "In use", or "Free: the next arrival takes it". */
export function holderText(name) {
  if (name === null) return 'Free: the next arrival takes it'
  return name ? `Held by ${name}` : 'In use'
}

/** "Whittled Cudgel, Tier 1 · Lv 0", or "nothing" for an empty slot. */
export function equipmentText(item) {
  return item ? `${item.name}, Tier ${item.tier} · ${levelShort(item.level)}` : 'nothing'
}

/** What a group upgrade does now, from its effect in the view state. */
export function upgradeEffectText(upgrade, formatShare) {
  const effect = upgrade.effect ?? {}
  if (upgrade.id === 'campfire') {
    return upgrade.level
      ? `Restores ${formatShare(effect.staminaAfterKill)} of missing stamina after each kill`
      : 'Once built, restores stamina after each kill'
  }
  if (upgrade.id === 'workbench') {
    return upgrade.level ? `Item upgrades cost ${formatShare(effect.upgradeCostFactor)} of their price`
      : 'Once built, makes item upgrades cheaper'
  }
  if (upgrade.id === 'runeCircle') {
    return upgrade.level ? `Monsters arrive with ${formatShare(effect.monsterHealthCut)} less health`
      : 'Once built, takes health off every new monster'
  }
  return ''
}

/** "Retirees add +10% to gathering (20 retired in all)". */
export function retireeBonusText(bonus, count, formatShare) {
  return `Retirees add +${formatShare(bonus)} to gathering (${count} retired in all)`
}

/** "Mage · Lv 10 · mostly Command". */
export function retireeFacts(retiree) {
  const skill = retiree.mainSkill ? `mostly ${skillLabel(retiree.mainSkill)}` : null
  return [classLabel(retiree.class), levelShort(retiree.level), skill]
    .filter(Boolean)
    .join(' · ')
}

export const ARSENAL = {
  room: 'Room',
  noRooms: 'No room has joined the game yet. A room joins with its first tokens.',
  autoSpend: 'Auto-spend',
  autoSpendHint: 'Buys the cheapest useful upgrade whenever the world can pay for it.',
  materials: (worldId, level) => `Materials · world ${worldId}, level ${level}`,
  characters: 'Characters',
  noCharacters: 'No character in this room right now.',
  guests: (count) => `${plural(count, 'guest')}: they help fight but keep nothing.`,
  attributes: 'Attributes',
  equipment: 'Equipment',
  chest: (shown, size) => (shown < size ? `Chest · ${shown} of ${size} items` : `Chest · ${size} items`),
  upgrade: 'Upgrade',
  upgradeItem: (name) => `Upgrade ${name}`,
  upgradeCost: (text) => `Next level: ${text}`,
  groupUpgrades: (worldId) => `Group upgrades · world ${worldId}`,
  buy: 'Build',
  buyUpgrade: (name, level) => `Build ${name} level ${level}`,
  retirees: 'Retirees',
  noRetirees: 'No character has retired here yet.',
  moreRetirees: (count) => `and ${plural(count, 'older retiree')}`,
  title: (title) => `was "${title}"`
}

/** "Fighter · Lv 9", the class and level of a living character. */
export function characterFacts(character) {
  return `${classLabel(character.class)} · ${levelShort(character.level)}`
}

/** What each skill is grown by and what it does. Engineering's factor is filled in. */
const WORK_SKILL_EFFECT = {
  forge: 'Grows while agents write code. Strengthens physical attacks.',
  arcana: 'Grows while agents think. Strengthens magical attacks.',
  lore: 'Grows while agents read. Strengthens the Guardians\' defence.',
  command: 'Grows while agents delegate. Strengthens the Healers\' support.'
}
const TRADE_MATERIAL = {
  mining: 'ore',
  fishing: 'fish',
  farming: 'crops',
  woodcutting: 'logs',
  hunting: 'hides',
  runecraft: 'runes'
}

/**
 * What a skill does: "Grows while agents write code. Strengthens physical attacks."
 *
 * @param {string} skillId
 * @param {string} attackSpeed the party's attack speed as written, for Engineering: "×1.11"
 */
export function skillEffect(skillId, attackSpeed) {
  if (skillId === 'engineering') {
    return `Grows while agents run commands. Sets the party's attack speed, now ${attackSpeed}.`
  }
  if (WORK_SKILL_EFFECT[skillId]) return WORK_SKILL_EFFECT[skillId]
  const material = TRADE_MATERIAL[skillId]
  return material ? `Idle characters with this trade gather ${material}, and it grows as they do.` : ''
}

/** Stars as shown, "★★", or "★×7" when there are many, with the words for screen readers. */
export function starsLabel(stars) {
  if (!stars) return { short: '', full: '' }
  return { short: stars > 5 ? `★×${stars}` : '★'.repeat(stars), full: plural(stars, 'star') }
}

/** "Lv 27", or "Lv 3 · effective 102" once a skill has stars. */
export function skillLevelText(skill) {
  const level = levelShort(skill.level)
  return skill.stars ? `${level} · effective ${skill.effectiveLevel}` : level
}

/** What prestiging a skill does, said before it is done. */
export function prestigeQuestion(skill) {
  const name = skillLabel(skill.id)
  return `${name} goes back to level 1 and earns a star (${plural(skill.stars + 1, 'star')} in all). ` +
    `Nothing gets weaker: its effective level stays ${skill.effectiveLevel}, the experience banked at ` +
    'the cap is poured back in, and every star makes it grow faster.'
}

export const SKILLS = {
  world: 'World',
  worldLevel: (level) => `World level ${level}`,
  worldNote: 'The mean of the five work skills. Monsters and prices follow it.',
  attackSpeed: (speed) => `Attack speed ${speed}`,
  work: 'Work skills',
  workNote: 'They grow with the tokens agents spend, by what they spend them on.',
  gathering: 'Gathering skills',
  gatheringNote: 'They grow while idle characters gather.',
  progress: (name) => `${name} progress to the next level`,
  atCap: 'At the cap',
  prestige: 'Prestige',
  prestigeSkill: (skillId) => `Prestige ${skillLabel(skillId)}`,
  confirmPrestige: (skillId) => `Prestige ${skillLabel(skillId)}`
}

export const SETTINGS = {
  open: 'Game settings',
  title: 'Game settings',
  close: 'Close',
  keepTitles: 'Keep session titles',
  keepTitlesHint: 'Off: a retiree keeps only a generated name, its level and what it did. Turning it off ' +
    'forgets the titles already kept.',
  worlds: 'Worlds',
  worldsNote: 'Each world keeps its own skills, materials and upgrades. A room out of the game counts ' +
    'no tokens.',
  roomWorld: (room) => `World for the ${room} room`,
  outOfGame: 'Out of the game',
  newWorld: 'New world…',
  newWorldName: 'Name of the new world',
  create: 'Create',
  cancel: 'Cancel',
  newWorldError: {
    empty: 'Give the world a name with at least one letter or digit.',
    taken: 'There is already a world with that name.',
    full: 'There are already eight worlds, the most there can be.'
  },
  reset: 'Reset this world',
  resetWorld: 'World to reset',
  resetQuestion: (worldId) => `Reset world "${worldId}"? Its skills, materials and group upgrades, and ` +
    'every room\'s wave, chest and retirees in it, go back to the start. This cannot be undone.',
  resetConfirm: (worldId) => `Reset ${worldId}`,
  local: 'Everything stays on this computer.'
}

/** "main · level 11" as a choice of world. */
export const worldChoice = (world) => `${world.id} · level ${world.level}`

/** What the game's events say as they play over a room. */
export const EFFECT = {
  hit: (share) => `−${share}`,
  defeated: (count) => (count > 1 ? `Defeated ×${count}` : 'Defeated!'),
  loot: (text) => `+ ${text}`,
  level: (level) => `Level ${level}!`,
  retired: (name, level) => `${name} retired at level ${level}`,
  arrived: (name, items) =>
    (items.length ? `${name} arrived and took ${items.join(', ')}` : `${name} arrived`),
  found: (name) => `Found ${name}`,
  upgraded: (name, level) => `Upgraded ${name} to Lv ${level}`,
  built: (name, level) => `Built ${name} level ${level}`
}

/** A name for an item id the state has no name for: "ashwood-wand" becomes "Ashwood wand". */
export function nameFromId(id) {
  const words = String(id ?? '').split('-').filter(Boolean)
  const text = words.join(' ')
  return text ? text[0].toUpperCase() + text.slice(1) : ''
}

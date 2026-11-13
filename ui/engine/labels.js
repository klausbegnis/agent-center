// Every piece of text the engine shows. Kept in one place so wording stays consistent.
import { monsterRank } from './monster-rank.js'
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
  if (status === 'loading-save') {
    return { title: 'Opening the saved game', lines: ['Your progress shows in a moment.', rooms] }
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
  setTravel: 'Changing the scene setting',
  setKeepTitles: 'Changing the titles setting',
  exportSave: 'The export',
  importSave: 'The import',
  moveOrphanItems: 'Moving the items'
}

/**
 * "The upgrade did not go through. Try again in a moment.", or with the worker's reason when it
 * gave one a person can act on: "The import did not go through: the save file is damaged…".
 *
 * @param {string} action
 * @param {string} [reason]
 */
export function gameActionFailed(action, reason = '') {
  const name = ACTION_NAMES[action] ?? 'That'
  if (reason) return `${name} did not go through: ${reason.replace(/[.\s]+$/, '')}.`
  return `${name} did not go through. Try again in a moment.`
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

/** The word for each rank above a normal monster. */
const RANK_LABEL = {
  veteran: 'Veteran',
  elite: 'Elite',
  champion: 'Champion',
  boss: 'Boss',
  legendary: 'Legendary'
}

/** The rank word with the affix after it when there is one: "Champion · Thorny". */
function rankWithAffix(monster, rank) {
  const word = RANK_LABEL[rank]
  return monster.affix ? `${word} · ${labelOf(AFFIX_LABEL, monster.affix)}` : word
}

/** The tag a monster wears above a normal one: "Veteran", "Elite · Thorny", "Boss", or null. */
export function monsterTag(monster) {
  const rank = monsterRank(monster)
  if (!monster || rank === 'normal') return null
  return rankWithAffix(monster, rank)
}

/**
 * The word a monster in a room wears over its health bar: its rank, or for an elite its affix
 * alone (the glow already says elite), or null for a normal monster.
 */
export function foeTag(monster) {
  const rank = monsterRank(monster)
  if (!monster || rank === 'normal') return null
  if (rank === 'elite') return labelOf(AFFIX_LABEL, monster.affix)
  return rankWithAffix(monster, rank)
}

/** What a monster in a room says under its health bar when its fight does not go on. */
const FOE_STATE = { resting: 'Party resting', waiting: 'On hold', blocked: 'On hold', idle: 'Party away' }
export const foeState = (party) => FOE_STATE[party] ?? ''

/**
 * A monster's health as written: "412 / 3,430" when the worker sends the points, "12%" when it
 * sends only the share.
 *
 * @param {{ hp: number | null, maxHp: number | null, health: number }} fight
 * @param {(amount: number) => string} formatAmount
 * @param {(share: number) => string} formatShare
 */
export function healthText({ hp, maxHp, health }, formatAmount, formatShare) {
  return hp !== null && maxHp ? `${formatAmount(hp)} / ${formatAmount(maxHp)}` : formatShare(health)
}

/** "Lv 15". */
export const levelShort = (level) => `Lv ${level}`

/** What a screen reader says for a monster: "Iron-Bound Practice Dummy, level 15, armored, 12% health". */
export function monsterDescription(monster, healthText) {
  const parts = [monster.name, `level ${monster.level}`]
  if (monster.kind && monster.kind !== 'common' && monster.kind !== 'boss') {
    parts.push(labelOf(MONSTER_KIND_LABEL, monster.kind).toLowerCase())
  }
  const rank = monsterRank(monster)
  if (rank !== 'normal') parts.push(RANK_LABEL[rank].toLowerCase())
  if (monster.affix) parts.push(labelOf(AFFIX_LABEL, monster.affix).toLowerCase())
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

/** "Gathering Fishing", what a character does while its agent is done. */
export const gatheringTrade = (trade) => `Gathering ${skillLabel(trade)}`

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
/** Attributes as they fit a narrow card; the full name is given with each. */
export const ATTRIBUTE_SHORT = {
  strength: 'Str',
  arcane: 'Arc',
  agility: 'Agi',
  precision: 'Pre',
  resilience: 'Res',
  medicine: 'Med',
  luck: 'Luck'
}
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

/** "Tier 2 · Lv 3". */
export const tierLevel = (item) => `Tier ${item.tier} · ${levelShort(item.level)}`

/** "Weapon, magical" or "Outfit": an item's slot as a word beside its icon. */
export function slotText(item) {
  const slot = labelOf(SLOT_LABEL, item.slot)
  return DAMAGE_LABEL[item.damageType] ? `${slot}, ${DAMAGE_LABEL[item.damageType]}` : slot
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
  spending: 'Spending',
  world: (worldId, level) => `World ${worldId} · ${levelShort(level)}`,
  materials: (worldId, level) => `Materials · world ${worldId}, level ${level}`,
  sections: 'Arsenal sections',
  characters: 'Characters',
  noCharacters: 'Nobody is in this room right now. A character joins when an agent works here.',
  levelProgress: (name) => `Progress of ${name} to the next level`,
  guests: (count) => `${plural(count, 'guest')}: they help fight but keep nothing.`,
  chestSlots: 'Chest slots',
  noItems: 'The chest is empty. Monsters drop items as the party wins fights.',
  pickItem: 'Choose a slot to see its item and upgrade it.',
  canUpgrade: 'can upgrade now',
  chestLegend: 'T tier · +N level · ● held · ▲ can upgrade now',
  now: 'Now',
  notBuilt: 'Not built yet',
  heldBy: 'Holder',
  effect: 'Effect',
  attributes: 'Attributes',
  equipment: 'Equipment',
  chest: (shown, size) => (shown < size ? `Chest · ${shown} of ${size} items` : `Chest · ${size} items`),
  upgrade: 'Upgrade',
  upgradeItem: (name) => `Upgrade ${name}`,
  upgradeCost: (text) => `Next level: ${text}`,
  nextLevel: 'Next level',
  cost: 'Cost',
  short: (amount) => `${amount} short`,
  attributesShort: (character) => `Attributes of ${character}`,
  emptySlot: 'nothing',
  groupUpgrades: (worldId) => `Group upgrades · world ${worldId}`,
  buy: 'Build',
  buyUpgrade: (name, level) => `Build ${name} level ${level}`,
  retirees: 'Retirees',
  noRetirees: 'No character has retired here yet. A character retires at the level cap and leaves a bonus.',
  moreRetirees: (count) => `and ${plural(count, 'older retiree')}`,
  orphans: 'Chests left behind',
  orphansNote: 'Rooms no longer on screen keep their chest and retirees in this world. Move them into ' +
    'this room to use them again.',
  orphanFacts: (orphan) => `${plural(orphan.chestSize, 'item')} · ${plural(orphan.retiredCount, 'retiree')}`,
  moveHere: 'Move here',
  moveHereLabel: (name, room) => `Move what ${name} left behind into ${room}`,
  moveQuestion: (orphan, room) => `Move ${plural(orphan.chestSize, 'item')} and ` +
    `${plural(orphan.retiredCount, 'retiree')} from ${orphan.name} into ${room}? Copies of an item past ` +
    `what a chest keeps are salvaged into materials, and ${orphan.name} leaves the game. This cannot be undone.`,
  moveConfirm: (room) => `Move into ${room}`,
  title: (title) => `was "${title}"`
}

/** The Arsenal's sections, as their tabs name them. */
export const ARSENAL_SECTION_LABEL = { items: 'Items', party: 'Party', camp: 'Camp' }

/** "T3", a tier as the corner of a slot shows it. */
export const tierShort = (tier) => `T${tier}`
/** "+4", an upgrade level as the corner of a slot shows it. */
export const levelPlus = (level) => `+${level}`

/**
 * What a chest slot says to a screen reader and in its tooltip: "Whittled Cudgel: Weapon,
 * physical, Tier 1, +0, held by Fix login. Can upgrade now".
 *
 * @param {{ name: string, slot: string, damageType?: string | null, tier: number, level: number }} item
 * @param {string | null} holder the holder's name, '' for one not on screen, null for a free item
 * @param {boolean} canUpgrade
 */
export function itemSlotLabel(item, holder, canUpgrade) {
  const who = holder === null ? 'free' : holder ? `held by ${holder}` : 'in use'
  const base = `${item.name}: ${slotText(item)}, Tier ${item.tier}, ${levelPlus(item.level)}, ${who}`
  return canUpgrade ? `${base}. Can upgrade now` : base
}

/** "Weapon: Whittled Cudgel, Tier 1, +0", or "Weapon: nothing", for a character's slot. */
export function equipmentSlotLabel(slot, item) {
  const slotName = labelOf(SLOT_LABEL, slot)
  if (!item) return `${slotName}: nothing`
  return `${slotName}: ${item.name}, Tier ${item.tier}, ${levelPlus(item.level)}`
}

/** What an item adds, by slot, with its factor filled in: "×1.33 to hits". */
const ITEM_EFFECT = {
  weapon: (factor) => `${factor} to hits`,
  outfit: (factor) => `${factor} outfit power, for a larger stamina pool`,
  tool: (factor) => `${factor} to gathering`
}
export function itemEffectText(slot, factorText) {
  return (ITEM_EFFECT[slot] ?? ((factor) => factor))(factorText)
}

/**
 * A material tile of the strip as a screen reader hears it: "Bars 60", and when a price on
 * screen is short of it, "Bars 60, short: a price needs 70 more".
 *
 * @param {string} id
 * @param {string} amountText
 * @param {null | { prices: number, mostText: string }} short
 */
export function materialTileLabel(id, amountText, short) {
  const base = `${materialLabel(id)} ${amountText}`
  if (!short) return base
  const who = short.prices === 1 ? 'a price needs' : `${short.prices} prices need up to`
  return `${base}, short: ${who} ${short.mostText} more`
}

/** "Fighter · Lv 9", the class and level of a living character. */
export function characterFacts(character) {
  return `${classLabel(character.class)} · ${levelShort(character.level)}`
}

/** What each skill is grown by and what it does, in one line. Engineering's factor is filled in. */
const WORK_SKILL_EFFECT = {
  forge: 'Grows while agents write code; stronger physical attacks',
  arcana: 'Grows while agents think; stronger magical attacks',
  lore: 'Grows while agents read; stronger Guardians',
  command: 'Grows while agents delegate; stronger Healers'
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
 * What a skill does, in one line: "Grows while agents write code; stronger physical attacks".
 *
 * @param {string} skillId
 * @param {string} attackSpeed the party's attack speed as written, for Engineering: "×1.11"
 */
export function skillEffect(skillId, attackSpeed) {
  if (skillId === 'engineering') return `Grows while agents run commands; attack speed, now ${attackSpeed}`
  if (WORK_SKILL_EFFECT[skillId]) return WORK_SKILL_EFFECT[skillId]
  const material = TRADE_MATERIAL[skillId]
  return material ? `Idle characters with this trade gather ${material}` : ''
}

/** Stars as shown, "★★", or "★×7" when there are many, with the words for screen readers. */
export function starsLabel(stars) {
  if (!stars) return { short: '', full: '' }
  return { short: stars > 5 ? `★×${stars}` : '★'.repeat(stars), full: plural(stars, 'star') }
}

/** "effective 102" for a skill with stars, whose level alone undersells it; '' otherwise. */
export const effectiveText = (skill) => (skill.stars ? `effective ${skill.effectiveLevel}` : '')

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
  worldLevelName: 'World level',
  worldNote: 'The mean of the five work skills. Monsters and prices follow it.',
  attackSpeed: (speed) => `Attack speed ${speed}`,
  work: 'Work skills',
  workNote: 'They grow with the tokens agents spend, by what they spend them on.',
  gathering: 'Gathering skills',
  gatheringNote: 'They grow while idle characters gather.',
  progress: (name) => `${name} progress to the next level`,
  attackSpeedName: 'Attack speed',
  attackSpeedNote: 'Set by Engineering: how often the party strikes.',
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
  travel: 'New scene after each monster',
  travelHint: 'Each room that plays and has no theme of its own moves to another theme when its ' +
    'monster dies, as if the party travelled on. Its monsters fit the scene.',
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

/** The "Save file" card of the game settings: export the game, or import one in its place. */
export const SAVE_FILE = {
  title: 'Save file',
  note: 'Keep a copy of the game, or carry it to another computer. Token counts are not in the ' +
    'file: after an import, counting starts again from now.',
  export: 'Export',
  exporting: 'Exporting…',
  exported: 'A download of the file was started. If none came, copy the text below and keep it in a file.',
  exportText: 'Exported save file',
  copy: 'Copy',
  copied: 'Copied.',
  copySelected: 'The text is selected: press Ctrl+C or ⌘C to copy it.',
  import: 'Import',
  importFile: 'Save file to import',
  importText: 'Or paste a save file here',
  importQuestion: 'Replace the whole game with this file? All progress on this computer, in every ' +
    'world, is replaced by the file\'s. This cannot be undone.',
  importConfirm: 'Replace the game',
  imported: 'The game was replaced by the file.',
  readFailed: 'The file could not be read.',
  textError: {
    empty: 'Choose a file or paste a save file first.',
    invalid: 'This is not valid JSON, so it cannot be a save file.',
    notObject: 'This is not a save file: it should be one JSON object.'
  }
}

/** "main · level 11" as a choice of world. */
export const worldChoice = (world) => `${world.id} · level ${world.level}`

/** What the game's events say as they play over a room. */
export const EFFECT = {
  damage: (amount) => `−${amount}`,
  mend: '+',
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

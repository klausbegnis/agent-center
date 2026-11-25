// The words of legendary loot: what each effect does, worded from the effect itself (the same
// data the engine plays by, so the two cannot drift apart), and the labels of the Relics card, a
// legendary item's details, the agent card and the room. Never touches the DOM.
import { CLASS_LABEL, SKILL_LABEL } from './labels.js'

const percent = (amount) => `${Math.round(amount * 1000) / 10}%`
/** Hours as a person says them: "15 min" under an hour, "2 h" from one. */
export const hoursText = (hours) => (hours < 1 ? `${Math.round(hours * 60)} min` : `${hours} h`)

/** "ore", "crops and fish", "logs, hides and runes". */
export function listText(words) {
  if (words.length <= 1) return words.join('')
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`
}

/** Monster ranks as an effect names them. */
const RANK_WORDS = {
  normal: 'plain monsters', veteran: 'veterans', elite: 'elites', champion: 'champions', boss: 'bosses',
  legendary: 'legendary bosses'
}
/** Who a piece of equipment acts for, by slot. */
const HOLDER_WORD = { weapon: 'wielder', outfit: 'wearer', tool: 'holder' }
/** What a character does to gather a material: "while the holder mines". */
const GATHER_VERB = { ore: 'mines', fish: 'fishes', crops: 'farms', logs: 'cuts wood', hides: 'hunts', runes: 'carves runes' }

/** A race id as a plural when no name is given: "skeletons", "lizardfolk". */
const pluralRace = (id) => (id.endsWith('folk') ? id : `${id}s`)
const ranksText = (ranks) => listText(ranks.map((rank) => RANK_WORDS[rank] ?? rank))
const materialsText = (materials) => listText(materials)

/** Each effect type's words: `party` for a relic, `holder` for equipment, given its amount and who. */
const EFFECT_TEXT = {
  attackSpeed: {
    party: (effect) => `+${percent(effect.amount)} attack speed for the party, past the Engineering limit`,
    holder: (effect, who) => `+${percent(effect.amount)} attack speed for the ${who}`
  },
  damage: {
    party: (effect) => {
      if (effect.ranks) return `+${percent(effect.amount)} damage against ${ranksText(effect.ranks)}`
      const type = effect.damageType ? `${effect.damageType} ` : ''
      return `+${percent(effect.amount)} ${type}damage for the whole party`
    },
    holder: (effect, who) => `+${percent(effect.amount)} ${effect.damageType ? `${effect.damageType} ` : ''}damage from the ${who}`
  },
  critChance: { holder: (effect, who) => `+${percent(effect.amount)} critical chance for the ${who}` },
  critDamage: { party: (effect) => `Critical hits deal ${percent(effect.amount)} more damage` },
  staminaDrain: {
    party: (effect) => `Monsters drain ${percent(effect.amount)} less stamina`,
    holder: (effect, who) => `While the ${who} fights, monsters drain ${percent(effect.amount)} less stamina`
  },
  staminaPool: { party: (effect) => `+${percent(effect.amount)} party stamina pool` },
  outfitStamina: {
    holder: (effect, who) => `The ${who}'s outfit adds ${percent(effect.amount)} more to the party's stamina`
  },
  restTime: { party: (effect) => `The party's rests last ${effect.amount} s less` },
  staminaPerKill: { party: (effect) => `Each kill restores ${percent(effect.amount)} of the party's stamina` },
  healing: { holder: (effect, who) => `+${percent(effect.amount)} healing from the ${who}` },
  supportAura: { holder: (effect, who) => `The ${who}'s support aura is ${percent(effect.amount)} stronger` },
  affixWeakening: {
    party: (effect) => `Affixes of elites, champions and legendary bosses are ${percent(effect.amount)} weaker`
  },
  thorns: { party: (effect) => `Thorns: monsters take ${percent(effect.amount)} of the stamina share they drain as damage` },
  runeCircle: { party: (effect) => `The rune circle's health cut on each new monster is ${percent(effect.amount)} larger` },
  itemDrop: { party: (effect) => `+${percent(effect.amount)} chance that a kill drops an item` },
  killMaterials: {
    party: (effect) => (effect.materials
      ? `Kills drop ${percent(effect.amount)} more ${materialsText(effect.materials)}`
      : `Kills give ${percent(effect.amount)} more materials`)
  },
  gatherYield: {
    party: (effect) => (effect.materials
      ? `+${percent(effect.amount)} ${materialsText(effect.materials)} from gathering`
      : `Idle characters gather ${percent(effect.amount)} more of every material`),
    holder: (effect, who) => (effect.materials
      ? `+${percent(effect.amount)} ${materialsText(effect.materials)} while the ${who} ${GATHER_VERB[effect.materials[0]] ?? 'gathers'}`
      : `+${percent(effect.amount)} to what the ${who} gathers`)
  },
  gatherHours: { party: (effect) => `Idle characters keep gathering ${hoursText(effect.amount)} longer after the last tokens` },
  gatherXp: { party: (effect) => `+${percent(effect.amount)} experience to gathering skills` },
  characterXp: { party: (effect) => `+${percent(effect.amount)} experience for every character in the room` },
  skillXp: {
    party: (effect) =>
      `Every character's tokens give ${percent(effect.amount)} more ${(SKILL_LABEL[effect.skill] ?? effect.skill).toLowerCase()} experience`,
    holder: (effect, who) =>
      `The ${who}'s tokens give ${percent(effect.amount)} more ${(SKILL_LABEL[effect.skill] ?? effect.skill).toLowerCase()} experience`
  },
  upgradeCost: { party: (effect) => `Item upgrades cost ${percent(effect.amount)} fewer materials` },
  raceDamage: {
    party: (effect, who, { raceNames = {} } = {}) => `+${percent(effect.amount)} damage against ` +
      listText((effect.races ?? []).map((id) => (raceNames[id] ?? pluralRace(id)).toLowerCase())),
    world: (effect, who, { raceNames = {} } = {}) => `+${percent(effect.amount)} damage against ` +
      listText((effect.races ?? []).map((id) => (raceNames[id] ?? id).toLowerCase()))
  },
  legendaryPity: {
    world: (effect) => `+${percent(effect.amount)} to the extra legendary chance each boss without a drop adds`
  },
  marketFee: { world: (effect) => `The market's fee is ${percent(effect.amount)} lower` }
}
/**
 * The party effects the bestiary gives a whole world (scope `world`) read as a relic's do: they act
 * on every party of the world the way a relic acts on its room's.
 */
const WORLD_AS_PARTY = [
  'damage', 'critDamage', 'staminaDrain', 'staminaPool', 'restTime', 'staminaPerKill', 'affixWeakening', 'thorns',
  'runeCircle', 'itemDrop', 'killMaterials', 'gatherHours', 'gatherXp', 'characterXp', 'upgradeCost'
]
for (const type of WORLD_AS_PARTY) EFFECT_TEXT[type].world = EFFECT_TEXT[type].party

/**
 * What an effect does, in words: "Monsters drain 5% less stamina", "+4% critical chance for the
 * wielder", "+3% damage against orcs". '' for an effect this version cannot word.
 *
 * @param {{ effect: string, scope: string, amount: number }} effect
 * @param {string} [slot] the equipment's slot, for who a holder effect acts for
 * @param {{ raceNames?: Record<string, string> }} [context] the names of the races a bestiary
 *   effect names, by id
 */
export function effectText(effect, slot, context = {}) {
  const words = EFFECT_TEXT[effect?.effect]?.[effect.scope]
  return words ? words(effect, HOLDER_WORD[slot] ?? 'holder', context) : ''
}

/** The effect types this module can word, for a test to compare with the engine's. */
export const WORDED_EFFECTS = Object.fromEntries(Object.entries(EFFECT_TEXT).map(([type, scopes]) => [type, Object.keys(scopes)]))

/** What each kind of legendary loot is called. */
export const KIND_LABEL = { relic: 'Relic', 'boss-relic': 'Boss relic', equipment: 'Legendary', 'instance-relic': 'Instance relic' }

/** Where an entry comes from, for its details: "Gorrath's own, never sold". */
export function sourceText(entry) {
  if (entry.instance) return `Won by clearing ${entry.instance.name} the first time, never sold`
  if (entry.boss) return entry.kind === 'equipment' ? `Dropped by ${entry.boss.name}` : `${entry.boss.name}'s own, never sold`
  return 'Dropped by legendary bosses'
}

/** Who gathers a trade, for a tool made for it. */
const TRADE_WORKER = {
  mining: 'a miner', fishing: 'an angler', farming: 'a farmer', woodcutting: 'a woodcutter', hunting: 'a hunter',
  runecraft: 'a runecrafter'
}

/** Who a piece of legendary equipment is made for: "Made for a Fighter", "Made for a miner". */
export function madeForText(entry) {
  if (entry.trade) return `Made for ${TRADE_WORKER[entry.trade] ?? `whoever gathers ${SKILL_LABEL[entry.trade] ?? entry.trade}`}`
  return entry.class ? `Made for a ${CLASS_LABEL[entry.class] ?? entry.class}` : ''
}

export const RELICS = {
  title: 'Relics',
  active: 'Active relic',
  noneActive: 'No relic is active. Pick one below.',
  owned: (count, total) => `${count} of ${total} found`,
  slots: 'Relics the room owns',
  emptySlot: 'An empty relic slot: legendary bosses drop relics, and some bosses guard one of their own',
  teaser: 'No relics yet. The first boss this room beats leaves one; legendary bosses drop more, and a ' +
    'few bosses guard a relic of their own.',
  hint: 'At most one relic is active at a time and helps the whole party. Pick one to make it active, ' +
    'or "No active relic" for none.',
  slotLabel: (name, text, isActive) => `${name}: ${text}${isActive ? '. Active' : '. Make it active'}`,
  nowActive: (name) => `${name} is now the active relic.`,
  /** The control that leaves the room with no active relic. */
  deactivate: 'No active relic',
  deactivateLabel: (name) => `Put ${name} away: no relic is active`,
  noneNow: 'No relic is active now.',
  pictureAlt: (name) => name
}

export const LEGENDARY_ITEM = {
  buff: 'Buff',
  source: 'Source',
  madeFor: 'For',
  heldOnly: 'Its buff works only while a character holds it.',
  slotNote: 'legendary'
}

/** A relic on a city's stall. */
export const STALL_RELIC = {
  kicker: 'Relic',
  ownsAll: 'A relic of this city is on offer, but the room it would go to owns them both.',
  soldToday: 'Today\'s relic is sold. Another comes now and then.',
  buyLabel: (name, price) => `Buy the relic ${name} for ${price}`
}

export const LEGENDARY_EVENT = {
  found: (name) => `Legendary! ${name}`
}

/** The agent card's line about the room's active relic: "Relic: Rimeheart · Monsters drain 5% less stamina". */
export const relicLine = (name, text) => `Relic: ${name} · ${text}`
/** The band's mark of an active relic, as a tooltip and to a screen reader. */
export const bandRelicLabel = (name, text) => `Active relic: ${name}. ${text}`

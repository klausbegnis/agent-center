// A project's fight over some ticks of working time: the party its working members make, the
// monster it meets, kills, rests, rewards and drops. Pure; works on copies and returns them.
import { bestiaryIndexOf } from './bestiary-content.mjs'
import { findItem } from './chest.mjs'
import { fightTick, referenceStamina, rewardFor } from './combat.mjs'
import { GEAR_GROWTH, OUTFIT_STAMINA_WEIGHT, REST_SECONDS, TICK_SECONDS } from './constants.mjs'
import { addDrop, droppedEntry } from './drops.mjs'
import { waveRosterOf } from './instance-regions.mjs'
import { rollLegendaryDrops } from './legendary-drops.mjs'
import { itemFactor, referenceGearLevel } from './items.mjs'
import {
  heldEffects,
  legendaryIndexOf,
  memberBonuses,
  partyBonuses,
  relicEffects,
  runeCircleFactorOf,
  withKillMaterials
} from './legendary-effects.mjs'
import { killsToPass, monsterFor, rankOf } from './monsters.mjs'
import { characterHit, engineeringSpeed, partyHits, referenceAttributes } from './power.mjs'
import { inScene } from './scenes.mjs'
import { campfireShare, groupLevel, runeCircleShare } from './spending.mjs'
import { traitIndexOf } from './trait-content.mjs'
import { traitPartyBonuses, withTraitEffects } from './trait-effects.mjs'
import { settleScrollDrop } from './traits.mjs'
import { featuredRaceOf, noteWeeklyKill } from './weekly.mjs'
import { worldEffectsOf } from './world-effects.mjs'
import { addMaterials } from './worlds.mjs'

const REST_TICKS = Math.ceil(REST_SECONDS / TICK_SECONDS)

/**
 * @typedef {{ character: object, tokensPerMinute: number }} Member a working character; a guest
 *   is a newcomer character that is not in the save
 * @typedef {{ hits: { physical: number, magical: number }, luck: number, outfitFactor: number,
 *   defenders: number[], supporters: number[], size: number,
 *   hitsAgainst: (monster: object) => { physical: number, magical: number },
 *   legendary: import('./legendary-effects.mjs').PartyBonuses }} Party `hits` are against a monster
 *   no effect singles out; `hitsAgainst` against a given monster, whose rank or race a relic, a
 *   piece of equipment or the bestiary may single out; `legendary` the party bonuses of the
 *   relic, the equipment and the bestiary
 */

/** The party's hits by damage type against a monster of `rank` and `race` (null: any). */
function hitsAgainstMonster(hitters, rank, race) {
  const scaled = hitters.map((hitter) => ({ ...hitter, amount: hitter.amount * hitter.bonuses.hitFactor(hitter.type, rank, race) }))
  const { physical, magical } = partyHits(scaled)
  return { physical, magical }
}

/**
 * The party's hits against each rank and race met, worked out once for each: a fight meets few.
 *
 * @returns {(monster: object) => { physical: number, magical: number }}
 */
function hitsByMonster(hitters) {
  const known = new Map()
  return (monster) => {
    const rank = rankOf(monster)
    const race = typeof monster?.race === 'string' ? monster.race : null
    const key = `${rank}|${race ?? ''}`
    if (!known.has(key)) known.set(key, hitsAgainstMonster(hitters, rank, race))
    return known.get(key)
  }
}

/**
 * What a working party brings to every tick, whatever the monster: its hits by damage type, its
 * luck, its outfits, the resilience of its defenders and medicine of its supporters, and what its
 * room's active relic, its members' legendary equipment and its world's bestiary add.
 *
 * @param {Member[]} members
 * @param {{ skills: object }} world
 * @param {{ chest: object[] }} project
 * @param {{ legendary?: object }} [content] the game content, for its legendary loot
 * @returns {Party}
 */
export function partyOf(members, world, project, content) {
  const itemOf = (id) => (id ? findItem(project.chest, id) : null)
  const speed = engineeringSpeed(world.skills)
  const index = legendaryIndexOf(content)
  // The world's bestiary acts on the party as the relic does, and adds to it under the same caps.
  const relic = [...relicEffects(project, index), ...worldEffectsOf(world, content)]
  // A member's traits act on it as its equipment does (trait-effects.mjs).
  const held = members.map(({ character }) => withTraitEffects(heldEffects(project, character, index), project, character, content))
  const bonuses = held.map((own) => memberBonuses(relic, own))
  const hitters = members.map(({ character, tokensPerMinute }, at) => {
    const weaponFactor = itemFactor(itemOf(character.equipment?.weapon))
    const { critChance: critBonus, critDamage: critDamageBonus, auraFactor } = bonuses[at]
    const options = { character, skills: world.skills, weaponFactor, tokensPerMinute, speed, critBonus, critDamageBonus }
    return { class: character.class, ...characterHit(options), auraFactor, bonuses: bonuses[at] }
  })
  const ofClass = (className, attribute) => members
    .map(({ character }, at) => ({ character, at }))
    .filter(({ character }) => character.class === className)
    .map(({ character, at }) => (character.attributes[attribute] ?? 0) *
      (attribute === 'medicine' ? bonuses[at].healingFactor : 1))
  const outfits = members.map(({ character }, at) =>
    itemFactor(itemOf(character.equipment?.outfit)) * bonuses[at].outfitFactor)
  return {
    hits: hitsAgainstMonster(hitters, null, null),
    hitsAgainst: hitsByMonster(hitters),
    luck: members.reduce((sum, { character }) => sum + (character.attributes.luck ?? 0), 0),
    outfitFactor: outfits.reduce((sum, factor) => sum + factor, 0) / Math.max(1, outfits.length),
    defenders: ofClass('defense', 'resilience'),
    supporters: ofClass('support', 'medicine'),
    size: members.length,
    legendary: partyBonuses(relic, held),
    traits: traitPartyBonuses(project, members.map(({ character }) => character), content)
  }
}

/** The party's hits against a monster: its own when the party knows them, its plain ones otherwise. */
const hitsAgainst = (party, monster) => party.hitsAgainst?.(monster) ?? party.hits

/**
 * The party against a monster of a level: defence and healing as ratios of the reference
 * character's at that level, and a stamina pool scaled by its outfits against the reference gear
 * (softened by OUTFIT_STAMINA_WEIGHT).
 *
 * @param {Party} party
 * @param {number} level
 */
export function partyAgainst(party, level) {
  const resilience = referenceAttributes('defense', level).resilience
  const medicine = referenceAttributes('support', level).medicine
  const behind = party.outfitFactor / GEAR_GROWTH ** referenceGearLevel(level)
  const outfitShare = behind ** OUTFIT_STAMINA_WEIGHT
  return {
    defenders: party.defenders.map((value) => ({ resilience: value / resilience })),
    supporters: party.supporters.map((value) => ({ medicine: value / medicine })),
    maxStamina: referenceStamina(level) * outfitShare * (party.legendary?.poolFactor ?? 1)
  }
}

/**
 * The project's next monster, measured against a party of the working party's size, with the
 * rune circle's head start taken off its health.
 *
 * @param {{ worldId: string, projectId: string, project: object, world: object,
 *   content: { monsters: object }, referencePartyHit: (level: number) => object,
 *   partySize: number }} where
 * @returns {object} the monster, at full health less the rune circle's cut
 */
export function spawnMonster({ worldId, projectId, project, world, content, referencePartyHit, partySize }) {
  const monster = monsterFor({
    worldId,
    projectId,
    wave: project.wave,
    kill: project.waveKills,
    themeId: project.themeId,
    content: content.monsters,
    races: content.races,
    // The bosses of later regions are met only in their instances (instance-regions.mjs).
    bosses: waveRosterOf(content),
    referencePartyHit,
    partySize,
    featuredRace: featuredRaceOf(world, content)
  })
  const runeFactor = runeCircleFactorOf(project, legendaryIndexOf(content), worldEffectsOf(world, content))
  const runeCut = runeCircleShare(groupLevel(world.upgrades, 'runeCircle')) * runeFactor
  const hp = monster.maxHp * (1 - runeCut)
  return { ...monster, hp }
}

/**
 * A boss kill's legendary drops, put in the fight's working copy of the project: relics and pity
 * in its `legendary`, equipment in its chest. Returns what dropped.
 */
function settleLegendaryDrops(state, { monster, seed, content, pityFactor }) {
  const found = rollLegendaryDrops(state, { monster, seed, index: legendaryIndexOf(content), pityFactor })
  if (found.project === state) return []
  state.chest = found.project.chest
  if (found.project.legendary) state.legendary = found.project.legendary
  else delete state.legendary
  return found.drops
}

/**
 * What a kill changes: reward, drop, legendary drops, the world's bestiary, campfire, the wave's
 * and the room's counts, the scene of a travelling room, and the next monster, which fits that scene.
 */
function settleKill(state, context) {
  const { worldId, projectId, world, content, party, worldLevel, events } = context
  const { monster } = state
  const seed = `${worldId}|${projectId}|${monster.level}|${state.waveKills}`
  const loot = party.legendary
  const dropBonus = (loot?.itemDrop ?? 0) + (party.traits?.raceDrop(monster.race ?? null) ?? 0)
  const reward = rewardFor(monster, { luck: party.luck, seed, dropBonus })
  const killMaterials = withKillMaterials(reward.materials, loot?.killMaterials ?? [])
  state.materials = addMaterials(state.materials, killMaterials)
  const roll = { level: monster.level, themeId: state.themeId, seed }
  const entry = reward.itemDrop ? droppedEntry(content.items, roll) : null
  let salvage = {}
  if (entry) {
    const dropped = addDrop(state.chest, entry, worldLevel)
    state.chest = dropped.chest
    salvage = dropped.salvage
    state.materials = addMaterials(state.materials, salvage)
  }
  const pityFactor = 1 + (loot?.legendaryPity ?? 0)
  const legendary = settleLegendaryDrops(state, { monster, seed, content, pityFactor })
  const scroll = settleScrollDrop(state, { monster, seed, scrollFind: party.traits?.scrollFind ?? 0 }, traitIndexOf(content))
  // A race week counts its race once more half the time (weekly.mjs).
  const featuredRace = featuredRaceOf(world, content)
  const noted = noteWeeklyKill(context.tally.bestiary, monster, { day: context.day, index: bestiaryIndexOf(content), featuredRace, seed })
  context.tally.bestiary = noted.bestiary
  events.push({
    type: 'kill', projectId, wave: state.wave, kind: monster.kind, rank: rankOf(monster), race: monster.race ?? null,
    affix: monster.affix, ticks: state.fightTicks, rested: state.fightRested,
    materials: addMaterials(killMaterials, salvage), item: entry?.id ?? null,
    ...(legendary.length ? { legendary } : {}),
    ...(scroll ? { scroll } : {}),
    ...(noted.news.length ? { bestiary: noted.news } : {})
  })
  state.stamina += (1 - state.stamina) * campfireShare(groupLevel(world.upgrades, 'campfire'))
  state.stamina = Math.min(1, state.stamina + (loot?.staminaPerKill ?? 0))
  state.waveKills += 1
  state.kills = (state.kills ?? 0) + 1
  if (context.scenes) state.themeId = inScene(state, projectId, context.scenes).themeId
  if (state.waveKills >= killsToPass(state.wave, worldLevel)) {
    state.wave += 1
    state.waveKills = 0
  }
  state.fightTicks = 0
  state.fightRested = false
  const { referencePartyHit } = context
  const partySize = party.size
  state.monster = spawnMonster({ worldId, projectId, project: state, world, content, referencePartyHit, partySize })
}

/** One tick: rest if resting, otherwise strike and be struck. */
function playTick(state, context) {
  state.fightTicks += 1
  if (state.restTicks > 0) {
    state.restTicks -= 1
    if (state.restTicks === 0) state.stamina = 1
    return
  }
  const against = context.against(state.monster.level)
  const result = fightTick({
    monster: state.monster,
    hits: hitsAgainst(context.party, state.monster),
    defenders: against.defenders,
    supporters: against.supporters,
    stamina: state.stamina * against.maxStamina,
    maxStamina: against.maxStamina,
    legendary: context.party.legendary
  })
  state.stamina = result.stamina / against.maxStamina
  state.monster = result.monster
  if (result.killed) return settleKill(state, context)
  if (result.exhausted) {
    state.restTicks = context.party.legendary?.restTicks ?? REST_TICKS
    state.fightRested = true
  }
}

/**
 * Plays a project's fight for some ticks.
 *
 * @param {object} options
 * @param {string} options.worldId
 * @param {string} options.projectId
 * @param {object} options.project
 * @param {object} options.world
 * @param {number} options.worldLevel
 * @param {Party} options.party
 * @param {number} options.ticks
 * @param {{ monsters: object, items: object }} options.content
 * @param {(level: number) => object} options.referencePartyHit
 * @param {string[] | null} [options.scenes] the themes a travelling project moves through
 * @param {number} [options.day] the game day the kills are counted on in the world's bestiary
 * @returns {{ project: object, materials: Record<string, number>, events: object[],
 *   bestiary: object | null }} `bestiary` is the world's with this fight's kills counted
 */
export function playFight(options) {
  const { worldId, projectId, project, world, worldLevel, party, ticks, content, referencePartyHit } = options
  const scenes = options.scenes ?? null
  const day = options.day ?? 0
  const tally = { bestiary: world.bestiary ?? null }
  const events = []
  const cache = new Map()
  const against = (level) => {
    if (!cache.has(level)) cache.set(level, partyAgainst(party, level))
    return cache.get(level)
  }
  const state = { ...project, materials: {} }
  const context = {
    worldId, projectId, world, content, party, worldLevel, events, against, referencePartyHit, scenes, day, tally
  }
  if (!state.monster) {
    const where = { worldId, projectId, project: state, world, content }
    state.monster = spawnMonster({ ...where, referencePartyHit, partySize: party.size })
  }
  for (let tick = 0; tick < ticks; tick++) playTick(state, context)
  const { materials, ...next } = state
  return { project: next, materials, events, bestiary: tally.bestiary }
}

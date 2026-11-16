// A project's fight over some ticks of working time: the party its working members make, the
// monster it meets, kills, rests, rewards and drops. Pure; works on copies and returns them.
import { findItem } from './chest.mjs'
import { fightTick, referenceStamina, rewardFor } from './combat.mjs'
import { GEAR_GROWTH, OUTFIT_STAMINA_WEIGHT, REST_SECONDS, TICK_SECONDS } from './constants.mjs'
import { addDrop, droppedEntry } from './drops.mjs'
import { itemFactor, referenceGearLevel } from './items.mjs'
import { killsToPass, monsterFor, rankOf } from './monsters.mjs'
import { characterHit, engineeringSpeed, partyHits, referenceAttributes } from './power.mjs'
import { inScene } from './scenes.mjs'
import { campfireShare, groupLevel, runeCircleShare } from './spending.mjs'
import { addMaterials } from './worlds.mjs'

const REST_TICKS = Math.ceil(REST_SECONDS / TICK_SECONDS)

/**
 * @typedef {{ character: object, tokensPerMinute: number }} Member a working character; a guest
 *   is a newcomer character that is not in the save
 * @typedef {{ hits: { physical: number, magical: number }, luck: number, outfitFactor: number,
 *   defenders: number[], supporters: number[], size: number }} Party
 */

/**
 * What a working party brings to every tick, whatever the monster: its hits by damage type, its
 * luck, its outfits, and the resilience of its defenders and medicine of its supporters.
 *
 * @param {Member[]} members
 * @param {{ skills: object }} world
 * @param {{ chest: object[] }} project
 * @returns {Party}
 */
export function partyOf(members, world, project) {
  const itemOf = (id) => (id ? findItem(project.chest, id) : null)
  const speed = engineeringSpeed(world.skills)
  const hitters = members.map(({ character, tokensPerMinute }) => {
    const weaponFactor = itemFactor(itemOf(character.equipment?.weapon))
    const hit = characterHit({ character, skills: world.skills, weaponFactor, tokensPerMinute, speed })
    return { class: character.class, ...hit }
  })
  const { physical, magical } = partyHits(hitters)
  const ofClass = (className, attribute) => members
    .filter(({ character }) => character.class === className)
    .map(({ character }) => character.attributes[attribute] ?? 0)
  const outfits = members.map(({ character }) => itemFactor(itemOf(character.equipment?.outfit)))
  return {
    hits: { physical, magical },
    luck: members.reduce((sum, { character }) => sum + (character.attributes.luck ?? 0), 0),
    outfitFactor: outfits.reduce((sum, factor) => sum + factor, 0) / Math.max(1, outfits.length),
    defenders: ofClass('defense', 'resilience'),
    supporters: ofClass('support', 'medicine'),
    size: members.length
  }
}

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
    maxStamina: referenceStamina(level) * outfitShare
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
    bosses: content.bosses,
    referencePartyHit,
    partySize
  })
  const hp = monster.maxHp * (1 - runeCircleShare(groupLevel(world.upgrades, 'runeCircle')))
  return { ...monster, hp }
}

/**
 * What a kill changes: reward, drop, campfire, the wave's and the room's counts, the scene of a
 * travelling room, and the next monster, which fits that scene.
 */
function settleKill(state, context) {
  const { worldId, projectId, world, content, party, worldLevel, events } = context
  const { monster } = state
  const seed = `${worldId}|${projectId}|${monster.level}|${state.waveKills}`
  const reward = rewardFor(monster, { luck: party.luck, seed })
  state.materials = addMaterials(state.materials, reward.materials)
  const roll = { level: monster.level, themeId: state.themeId, seed }
  const entry = reward.itemDrop ? droppedEntry(content.items, roll) : null
  let salvage = {}
  if (entry) {
    const dropped = addDrop(state.chest, entry, worldLevel)
    state.chest = dropped.chest
    salvage = dropped.salvage
    state.materials = addMaterials(state.materials, salvage)
  }
  events.push({
    type: 'kill', projectId, wave: state.wave, kind: monster.kind, rank: rankOf(monster),
    affix: monster.affix, ticks: state.fightTicks, rested: state.fightRested,
    materials: addMaterials(reward.materials, salvage), item: entry?.id ?? null
  })
  state.stamina += (1 - state.stamina) * campfireShare(groupLevel(world.upgrades, 'campfire'))
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
    hits: context.party.hits,
    defenders: against.defenders,
    supporters: against.supporters,
    stamina: state.stamina * against.maxStamina,
    maxStamina: against.maxStamina
  })
  state.stamina = result.stamina / against.maxStamina
  state.monster = result.monster
  if (result.killed) return settleKill(state, context)
  if (result.exhausted) {
    state.restTicks = REST_TICKS
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
 * @returns {{ project: object, materials: Record<string, number>, events: object[] }}
 */
export function playFight(options) {
  const { worldId, projectId, project, world, worldLevel, party, ticks, content, referencePartyHit } = options
  const scenes = options.scenes ?? null
  const events = []
  const cache = new Map()
  const against = (level) => {
    if (!cache.has(level)) cache.set(level, partyAgainst(party, level))
    return cache.get(level)
  }
  const state = { ...project, materials: {} }
  const context = {
    worldId, projectId, world, content, party, worldLevel, events, against, referencePartyHit, scenes
  }
  if (!state.monster) {
    const where = { worldId, projectId, project: state, world, content }
    state.monster = spawnMonster({ ...where, referencePartyHit, partySize: party.size })
  }
  for (let tick = 0; tick < ticks; tick++) playTick(state, context)
  const { materials, ...next } = state
  return { project: next, materials, events }
}

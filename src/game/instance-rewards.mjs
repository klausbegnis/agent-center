// What a run pays beyond its kills: the vault's loot as the party walks in, and the clear: the
// world's progress, the signature relic on the first clear, the purse, bestiary points for the
// instance's races and the boss's own item at better odds than on waves. Works on the run's copy of
// the project, like the fight; every roll is a hash of the run. Pure.
import { bestiaryIndexOf } from './bestiary-content.mjs'
import { noteKill } from './bestiary.mjs'
import { addToChest } from './chest.mjs'
import { rewardFor } from './combat.mjs'
import { REWARD_GROWTH } from './constants.mjs'
import { chanceOf, hashOf } from './hash.mjs'
import {
  INSTANCE_BESTIARY_CHAMPIONS,
  INSTANCE_BOSS_ITEM_CHANCE,
  INSTANCE_BOSS_ITEM_MAX,
  INSTANCE_BOSS_ITEM_TIER_STEP,
  INSTANCE_PURSE_COINS,
  INSTANCE_PURSE_KILLS,
  INSTANCE_PURSE_TIER_STEP,
  INSTANCE_RELIC_COINS,
  INSTANCE_VAULT_ITEM_CHANCE,
  INSTANCE_VAULT_ITEM_MAX,
  INSTANCE_VAULT_ITEM_TIER_STEP,
  INSTANCE_VAULT_KILLS
} from './instance-constants.mjs'
import { runLevel } from './instance-monsters.mjs'
import { progressOf, runContext } from './instance-run.mjs'
import { legendaryItemFor, rollBossItem } from './legendary-drops.mjs'
import { legendaryIndexOf } from './legendary-effects.mjs'
import { ownsLegendary, withRelic } from './legendary.mjs'
import { addMaterials } from './worlds.mjs'

/** A tier's share more of a purse: INSTANCE_PURSE_TIER_STEP for each tier above the first. */
export const tierFactor = (tier) => 1 + INSTANCE_PURSE_TIER_STEP * (tier - 1)

/** The boss's chance to leave its own item at a tier, before pity and boons. */
export const bossItemChance = (tier) =>
  Math.min(INSTANCE_BOSS_ITEM_MAX, INSTANCE_BOSS_ITEM_CHANCE + INSTANCE_BOSS_ITEM_TIER_STEP * (tier - 1))

/** The vault's chance to hold a legendary item of its pool at a tier. */
export const vaultItemChance = (tier) =>
  Math.min(INSTANCE_VAULT_ITEM_MAX, INSTANCE_VAULT_ITEM_CHANCE + INSTANCE_VAULT_ITEM_TIER_STEP * (tier - 1))

/** Materials worth `kills` plain kills of a level, split by the instance's loot. */
const materialsWorth = (instance, level, kills, seed) =>
  rewardFor({ level, reward: kills, loot: instance.loot, dropFactor: 0 }, { luck: 0, seed }).materials

/** Adds to what the run found: materials and coins also go to the world with the advance. */
function addFound(state, context, { materials = {}, coins = 0, legendary = [] }) {
  const was = state.run.found
  state.materials = addMaterials(state.materials, materials)
  context.tally.coins = (context.tally.coins ?? 0) + coins
  const found = { ...was, materials: addMaterials(was.materials, materials), coins: was.coins + coins, legendary: [...was.legendary, ...legendary] }
  state.run = { ...state.run, found }
}

/** A legendary entry put in the room: a relic among its relics, equipment in its chest. */
function gain(state, entry, level) {
  if (entry.kind === 'equipment') state.chest = addToChest(state.chest, legendaryItemFor(entry, level))
  else Object.assign(state, withRelic(state, entry.id))
}

/**
 * The vault, as the party walks in: materials, and sometimes a legendary item of its pool that the
 * room lacks (never a second copy).
 *
 * @param {object} state the run's working copy of the project
 * @param {object} context the run's (instance-fight.mjs)
 * @param {string} seed the vault's
 * @returns {string[]} the legendary ids it gave
 */
export function vaultLoot(state, context, seed) {
  const run = state.run
  const { instance } = runContext(run, context.index)
  const level = runLevel(context.worldLevel, run.tier)
  const legendary = []
  const index = legendaryIndexOf(context.content)
  const missing = index ? instance.vault.filter((id) => index.byId.has(id) && !ownsLegendary(state, id)) : []
  if (missing.length && chanceOf(`${seed}|vault-item`) < vaultItemChance(run.tier)) {
    const entry = index.byId.get(missing[hashOf(`${seed}|vault-pick`) % missing.length])
    gain(state, entry, level)
    legendary.push(entry.id)
  }
  addFound(state, context, { materials: materialsWorth(instance, level, INSTANCE_VAULT_KILLS, `${seed}|vault`), legendary })
  return legendary
}

/**
 * The boss's own item, rolled again with a boon. A wave boss's roll for a city's relic is left out,
 * and so is the waves' pity: a run meets its boss far more often than the waves do, and those
 * relics are the stalls' to sell. The Seeker's Candle makes the chance larger by its share.
 */
function bossLoot(state, context, { monster, seed, bonuses, tier }) {
  const index = legendaryIndexOf(context.content)
  if (!index) return []
  const drops = []
  const chance = Math.min(1, bossItemChance(tier) * (1 + bonuses.bossItem))
  for (let roll = 0; roll <= bonuses.rewardRolls; roll++) {
    const own = rollBossItem(state, {
      rank: 'boss', seed: roll ? `again-${roll}|${seed}` : seed, index, bossId: monster.id, level: monster.level, chance, withPity: false
    })
    Object.assign(state, own.project)
    if (own.drop) {
      drops.push(own.drop.id)
      break
    }
  }
  return drops
}

/** Each of the instance's races counted as having lost champions to the party: bestiary points. */
function creditRaces(context, instance, tier) {
  const bestiaryIndex = bestiaryIndexOf(context.content)
  if (!bestiaryIndex) return
  for (const race of instance.races) {
    for (let count = 0; count < INSTANCE_BESTIARY_CHAMPIONS * tier; count++) {
      const champion = { id: race, race, rank: 'champion', kind: 'common' }
      context.tally.bestiary = noteKill(context.tally.bestiary, champion, { day: context.day, index: bestiaryIndex }).bestiary
    }
  }
}

/**
 * The clear: the world counts it and its best tier; the first clear gives the room the instance's
 * relic (coins when it owns it already); every clear its purse, champions of its races for the
 * bestiary and the boss's rolls.
 *
 * @param {object} state the run's working copy of the project
 * @param {object} context the run's (instance-fight.mjs)
 * @param {{ monster: object, seed: string }} kill the boss and its kill's seed
 * @returns {string[]} the legendary ids it gave
 */
export function clearRewards(state, context, { monster, seed }) {
  const run = state.run
  const { instance, bonuses } = runContext(run, context.index)
  const progress = progressOf({ instances: context.tally.instances }, run.instance)
  const level = runLevel(context.worldLevel, run.tier)
  const legendary = []
  let coins = 0
  if (progress.clears === 0) {
    const entry = legendaryIndexOf(context.content)?.byId.get(instance.relic)
    if (entry && !ownsLegendary(state, entry.id)) {
      gain(state, entry, level)
      legendary.push(entry.id)
    } else {
      coins += Math.round(INSTANCE_RELIC_COINS * REWARD_GROWTH ** level)
    }
  }
  legendary.push(...bossLoot(state, context, { monster, seed, bonuses, tier: run.tier }))
  const share = tierFactor(run.tier) * (1 + bonuses.purse)
  coins += Math.round(INSTANCE_PURSE_COINS * REWARD_GROWTH ** level * share)
  addFound(state, context, { materials: materialsWorth(instance, level, INSTANCE_PURSE_KILLS * share, `${seed}|purse`), coins, legendary })
  creditRaces(context, instance, run.tier)
  context.tally.instances = {
    ...context.tally.instances,
    [run.instance]: { ...progress, clears: progress.clears + 1, bestTier: Math.max(progress.bestTier, run.tier) }
  }
  return legendary
}

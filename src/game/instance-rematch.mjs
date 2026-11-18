// Boss rematches (docs/GAME.md, "Rematches"): once an instance's boss is beaten, a world may go back
// for Rematch I to X, each a run of the same instance at a fixed, higher tier with a tougher boss,
// opened by the world's level (real progress, never by repeating runs) and the rematch below it.
// The first clear of each rematch pays a tier-clear reward once; every rematch clear rolls for the
// boss's own item at better odds. Records the best rematch cleared per instance. Pure.
import { REWARD_GROWTH } from './constants.mjs'

/** The ladder's length: Rematch I to X. A finite goal the roadmap can show as a badge. */
export const REMATCH_TIERS = 10
/** Rematch I plays at this tier, each one above two tiers higher: X plays at tier 21. */
export const REMATCH_FIRST_TIER = 3
export const REMATCH_TIER_STEP = 2
/** The rematch's boss has this share more health for each rematch: X's boss has twice as much. */
export const REMATCH_BOSS_HP_STEP = 0.1
/**
 * Rematch n opens when the world reaches the instance's level × (1 + this × n): the Sunken Crypt's
 * X at World Lv 20, Wyrmrest Spire's at 184. Only tokens raise the world's level, so the ladder
 * follows a person's real progress and clearing it again and again opens nothing.
 */
export const REMATCH_LEVEL_SHARE = 0.3
/** The boss's own item: this much more chance per rematch, up to the most (the waves' pity on top). */
export const REMATCH_ITEM_STEP = 0.02
export const REMATCH_ITEM_MAX = 0.45
/**
 * The first clear of rematch n pays, once per world: materials worth this many plain kills × n, coins
 * this many × n × REWARD_GROWTH ** level, and this many champions × n of each of its races for the
 * bestiary. Later clears of the same rematch pay the usual purse only.
 */
export const REMATCH_FIRST_KILLS = 12
export const REMATCH_FIRST_COINS = 300
export const REMATCH_CHAMPIONS = 2

/** Why a rematch cannot be entered, as the actions and the Roadmap say it. */
export const REMATCH_REFUSALS = Object.freeze({
  rematch: 'not a rematch: they run from I to X',
  notBeaten: 'beat its boss once before a rematch',
  order: 'clear the rematch below it first',
  level: 'the world\'s level is too low for this rematch'
})

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
/** A rematch's number as the roadmap writes it: 3 is "III". */
export const romanOf = (rematch) => ROMAN[rematch - 1] ?? String(rematch)

/** Whether a value is a rematch of the ladder. */
export const isRematch = (value) => Number.isInteger(value) && value >= 1 && value <= REMATCH_TIERS

/** The tier a rematch plays at. */
export const rematchTier = (rematch) => REMATCH_FIRST_TIER + REMATCH_TIER_STEP * (rematch - 1)

/** The world level a rematch of an instance opens at. */
export const rematchOpensAt = (instance, rematch) => Math.ceil(instance.opensAt * (1 + REMATCH_LEVEL_SHARE * rematch))

/** The best rematch a world has cleared in an instance, 0 for none. */
export const bestRematch = (progress) => progress?.rematch ?? 0

/**
 * Why a world cannot go for a rematch of an instance, or null when it can (the room's own checks,
 * the instance's openness and cooldowns are instance-run.mjs's).
 *
 * @param {{ clears: number, rematch?: number }} progress the world's progress there
 * @param {{ opensAt: number }} instance
 * @param {number} rematch
 * @param {number} level the world's level
 * @returns {string | null}
 */
export function rematchProblem(progress, instance, rematch, level) {
  if (!isRematch(rematch)) return REMATCH_REFUSALS.rematch
  if (progress.clears === 0) return REMATCH_REFUSALS.notBeaten
  if (rematch > bestRematch(progress) + 1) return REMATCH_REFUSALS.order
  if (level < rematchOpensAt(instance, rematch)) return REMATCH_REFUSALS.level
  return null
}

/** What a rematch adds to a run's numbers: its boss's health factor (1 outside a rematch). */
export const rematchBonuses = (run) => ({ bossHp: 1 + REMATCH_BOSS_HP_STEP * (run?.rematch ?? 0) })

/** The boss's chance to leave its own item in a rematch, given the run's usual chance. */
export const rematchItemChance = (chance, rematch) =>
  (rematch ? Math.min(REMATCH_ITEM_MAX, chance + REMATCH_ITEM_STEP * rematch) : chance)

/**
 * What a rematch's clear adds: nothing outside a rematch or for one cleared before; for a first
 * clear of rematch n its tier-clear reward, as plain kills of materials, coins and champions per race.
 *
 * @param {{ rematch?: number }} run
 * @param {{ rematch?: number }} progress the world's progress before this clear
 * @param {number} level the run's level
 * @returns {{ kills: number, coins: number, champions: number }}
 */
export function rematchReward(run, progress, level) {
  const rematch = run.rematch ?? 0
  if (!rematch || rematch <= bestRematch(progress)) return { kills: 0, coins: 0, champions: 0 }
  return {
    kills: REMATCH_FIRST_KILLS * rematch,
    coins: Math.round(REMATCH_FIRST_COINS * rematch * REWARD_GROWTH ** level),
    champions: REMATCH_CHAMPIONS * rematch
  }
}

/** The world's progress after a clear: a rematch records the best one, a normal run its best tier. */
export function progressAfterClear(progress, run) {
  const clears = progress.clears + 1
  if (!run.rematch) return { ...progress, clears, bestTier: Math.max(progress.bestTier, run.tier) }
  return { ...progress, clears, rematch: Math.max(bestRematch(progress), run.rematch) }
}

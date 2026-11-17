// The bestiary's ladders: points needed for each level of a race's mastery and of the world's
// hunter rank. A ladder has no top: level n needs `firstCost × (growth^n − 1) / (growth − 1)`
// points in all (times a scale), so the first step is cheap and each costs `growth` times the one
// before. A race's mastery gives power up to its last powered level and only a rank of prestige
// after it. Pure.

/** Beyond this many levels a ladder is not followed: no world gets near it (2^53 points). */
const LADDER_LEVELS_MAX = 400

/**
 * @typedef {{ firstCost: number, growth: number, scale?: number }} Ladder
 */

/**
 * The points needed in all to reach level `n` of a ladder: whole, rising, 0 for level 0.
 *
 * @param {Ladder} ladder
 * @param {number} n
 * @returns {number}
 */
export function pointsForLevel({ firstCost, growth, scale = 1 }, n) {
  if (n <= 0) return 0
  return Math.max(n, Math.round((scale * firstCost * (growth ** n - 1)) / (growth - 1)))
}

/**
 * The level reached with some points, and the points the level began at and the next one needs.
 *
 * @param {Ladder} ladder
 * @param {number} points from 0
 * @returns {{ level: number, from: number, to: number }}
 */
export function ladderPlace(ladder, points) {
  let level = 0
  while (level < LADDER_LEVELS_MAX && pointsForLevel(ladder, level + 1) <= points) level += 1
  return { level, from: pointsForLevel(ladder, level), to: pointsForLevel(ladder, level + 1) }
}

/**
 * The level reached with some points.
 *
 * @param {Ladder} ladder
 * @param {number} points
 */
export const ladderLevel = (ladder, points) => ladderPlace(ladder, points).level

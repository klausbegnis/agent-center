// Gathering: what an idle character brings in per hour of its trade, for how long, and turning a
// fractional rate into whole units without losing the remainder.
import { GATHER_PER_HOUR, GATHER_SKILL_BONUS, GATHER_STOPS_AFTER_HOURS, REWARD_GROWTH } from './constants.mjs'

const MS_PER_HOUR = 3_600_000
/** Absorbs floating point error so 2.9999999999 units count as 3, not 2 and a carry of 0.99. */
const WHOLE_UNIT_TOLERANCE = 1e-9

/**
 * Units per hour one idle character gathers (docs/GAME.md, "Gathering").
 *
 * @param {{ tradeLevel: number, effect?: number, worldLevel?: number, toolFactor?: number,
 *   seasoning?: number, retireeBonus?: number }} input `tradeLevel` is the effective level of
 *   the character's gathering skill and `effect` its star effect multiplier.
 * @returns {number}
 */
export function gatherRate({
  tradeLevel, effect = 1, worldLevel = 0, toolFactor = 1, seasoning = 1, retireeBonus = 0
}) {
  const skill = (1 + GATHER_SKILL_BONUS * tradeLevel) * effect
  return GATHER_PER_HOUR * REWARD_GROWTH ** worldLevel * skill * toolFactor * seasoning * (1 + retireeBonus)
}

/**
 * The hours of `from..to` (milliseconds) during which gathering still runs: it stops
 * `GATHER_STOPS_AFTER_HOURS` after the world last received tokens, and never ran in a world that
 * never did.
 *
 * @param {{ from: number, to: number, lastTokenAt: number | null }} interval
 * @returns {number}
 */
export function activeHours({ from, to, lastTokenAt }) {
  if (lastTokenAt === null || lastTokenAt === undefined) return 0
  const stopsAt = lastTokenAt + GATHER_STOPS_AFTER_HOURS * MS_PER_HOUR
  return Math.max(0, Math.min(to, stopsAt) - from) / MS_PER_HOUR
}

/**
 * Whole units gathered over some hours. The fraction is handed back as `carry` for the next call,
 * so many short calls add up to the same as one long one.
 *
 * @param {{ ratePerHour: number, hours: number, carry?: number }} input
 * @returns {{ units: number, carry: number }}
 */
export function gather({ ratePerHour, hours, carry = 0 }) {
  const total = ratePerHour * hours + carry
  const units = Math.floor(total + WHOLE_UNIT_TOLERANCE)
  return { units, carry: Math.max(0, total - units) }
}

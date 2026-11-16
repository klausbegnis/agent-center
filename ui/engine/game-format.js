// Numbers of the game as they are shown: amounts such as "29 M", shares as "12%", factors as
// "×1.11". Never touches the DOM.

/** Amounts from here on are shortened with a unit. */
const SHORTEN_FROM = 10_000
const UNITS = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'k']
]
/** A shortened amount below this keeps one decimal: "2.5 M", but "29 M". */
const ONE_DECIMAL_BELOW = 10

/** Puts a comma between groups of three digits: 1204 becomes "1,204". */
function groupDigits(whole) {
  return String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** Drops a trailing ".0". */
const trimmed = (text) => text.replace(/\.0$/, '')

/**
 * An amount of materials or tokens: "86", "1,204", "12 k", "2.5 M", "29 M".
 *
 * @param {number} value
 */
export function formatAmount(value) {
  const whole = Math.max(0, Math.floor(Number(value) || 0))
  if (whole < SHORTEN_FROM) return groupDigits(whole)
  const [size, unit] = UNITS.find(([threshold]) => whole >= threshold)
  const scaled = whole / size
  const digits = scaled < ONE_DECIMAL_BELOW ? 1 : 0
  // Rounded down, so an amount is never shown as more than there is.
  const factor = 10 ** digits
  return `${trimmed((Math.floor(scaled * factor) / factor).toFixed(digits))} ${unit}`
}

/** A number between 0 and 1, whatever arrives. */
export function clampShare(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.min(1, Math.max(0, number))
}

/**
 * A share as a percentage: "12%", and "4.5%" for a small one that would otherwise round away.
 *
 * @param {number} share
 */
export function formatShare(share) {
  const percent = Number(share) * 100 || 0
  if (percent !== 0 && Math.abs(percent) < 10) return `${trimmed(percent.toFixed(1))}%`
  return `${Math.round(percent)}%`
}

/** A factor such as the party's attack speed: "×1.11". */
export function formatFactor(factor) {
  return `×${(Number(factor) || 0).toFixed(2)}`
}

/**
 * The materials a price asks for, in the order the game gives them.
 *
 * @param {Record<string, number> | null | undefined} cost
 * @returns {{ id: string, amount: number }[]}
 */
export function costEntries(cost) {
  return Object.entries(cost ?? {}).map(([id, amount]) => ({ id, amount }))
}

/**
 * What is still missing to pay a price: each material short, with how much more is needed.
 *
 * @param {Record<string, number> | null | undefined} cost
 * @param {Record<string, number>} materials what the world has
 * @returns {{ id: string, amount: number }[]} empty when the price can be paid
 */
export function missingMaterials(cost, materials) {
  return costEntries(cost)
    .map(({ id, amount }) => ({ id, amount: Math.ceil(amount - (materials?.[id] ?? 0)) }))
    .filter(({ amount }) => amount > 0)
}

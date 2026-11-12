// Text that comes from outside (terminal titles, conversation names) and is shown as a label.
// Any program can set its terminal's title, so a label is cleaned and kept short before it is
// stored, served or drawn.

/** Control characters: line breaks, tabs, bells, escapes. They become a space. */
const CONTROL = /\p{Cc}/gu
/**
 * Format characters, such as bidi overrides that can disguise text. They are dropped, except the
 * zero-width joiner that holds an emoji sequence together.
 */
const FORMAT = /(?!\u200D)\p{Cf}/gu

/**
 * A label safe to show: no control or format characters, whitespace collapsed, at most `limit`
 * characters. Null when nothing is left.
 *
 * @param {unknown} value
 * @param {number} limit
 * @returns {string | null}
 */
export function displayText(value, limit) {
  if (typeof value !== 'string') return null
  const text = value.replace(CONTROL, ' ').replace(FORMAT, '').replace(/\s+/g, ' ').trim()
  if (text === '') return null
  const characters = [...text]
  return characters.length > limit ? `${characters.slice(0, limit - 1).join('').trimEnd()}…` : text
}

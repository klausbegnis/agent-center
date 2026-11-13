// The save file as the settings handle it: the name a download gets, the text shown to copy, and
// reading a pasted or chosen file before it is sent. Never touches the DOM.

const pad = (number) => String(number).padStart(2, '0')

/**
 * The name a downloaded save file gets, from the local date: "agent-center-save-2026-01-05.json".
 *
 * @param {Date} date
 */
export function saveFileName(date) {
  return `agent-center-save-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`
}

/**
 * The text of a save file, indented so a person can read it.
 *
 * @param {object} file what the worker's export answered
 */
export function saveFileText(file) {
  return `${JSON.stringify(file, null, 2)}\n`
}

/**
 * A pasted or chosen file read as a save file to send to the worker, or why it cannot be one.
 * Only the JSON is checked here; the worker checks everything else and says why it refuses.
 *
 * @param {string} text
 * @returns {{ file: object } | { error: 'empty' | 'invalid' | 'notObject' }}
 */
export function readSaveText(text) {
  const trimmed = String(text ?? '').trim()
  if (!trimmed) return { error: 'empty' }
  let value
  try {
    value = JSON.parse(trimmed)
  } catch {
    return { error: 'invalid' }
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { error: 'notObject' }
  return { file: value }
}

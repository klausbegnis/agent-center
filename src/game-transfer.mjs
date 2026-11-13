// The saved game as a file a person keeps or moves to another computer: what an export holds, and
// whether a file brought back can replace the game. Pure; the actions in game-actions.mjs apply it.
import { MAX_STORED_BYTES, STORED_VERSION, isNewer } from './game-save.mjs'

/** Names what the file is, so a file of anything else is refused before it is read. */
export const SAVE_FILE_FORMAT = 'agent-center-game'

/**
 * The file an export gives: the engine's save, the auto-spend setting and "new scene after each
 * monster" (`travel`). Never the bridge's token
 * baselines or `watchedUntil`: they describe this computer's sessions at this moment and would
 * count tokens wrongly anywhere else.
 *
 * @param {{ save: object, autoSpend: boolean, travel?: boolean, at: number }} input `at` is the time
 *   of the export
 * @returns {{ format: string, version: number, exportedAt: string, save: object, autoSpend: boolean,
 *   travel: boolean }}
 */
export function buildSaveFile({ save, autoSpend, travel = false, at }) {
  return {
    format: SAVE_FILE_FORMAT,
    version: STORED_VERSION,
    exportedAt: new Date(at).toISOString(),
    save,
    autoSpend: autoSpend === true,
    travel: travel === true
  }
}

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Bytes the value takes as JSON, or Infinity for a value that cannot be written as JSON. */
function sizeOf(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value))
  } catch {
    return Infinity
  }
}

/**
 * Reads a save file brought back (already parsed). It is refused when it is not one, when it is
 * from a newer plugin, when it is larger than the plugin can store, or when any part of its save
 * is not what the engine writes.
 *
 * @param {unknown} value
 * @param {{
 *   saveVersion: number,
 *   migrate: (value: unknown) => object,
 *   cleanSave: (save: object) => { ok: true, save: object } | { ok: false, problem: string },
 *   maxBytes?: number
 * }} engine the engine's save version, `migrate` and `cleanSave`
 * @returns {{ ok: true, save: object, autoSpend: boolean, travel: boolean } | { ok: false, reason: string }}
 *   a file from before `travel` existed turns it off
 */
export function readSaveFile(value, { saveVersion, migrate, cleanSave, maxBytes = MAX_STORED_BYTES }) {
  if (!isPlainObject(value) || value.format !== SAVE_FILE_FORMAT) {
    return { ok: false, reason: 'this is not an Agent Center save file' }
  }
  if (isNewer(value, saveVersion)) {
    return { ok: false, reason: 'the save file is from a newer version of Agent Center; update the plugin first' }
  }
  if (sizeOf(value) > maxBytes) return { ok: false, reason: 'the save file is larger than the plugin can keep' }
  if (!isPlainObject(value.save) || !Number.isInteger(value.save.version)) {
    return { ok: false, reason: 'the save file holds no saved game' }
  }
  // An older save version is brought up to this one first; migrate never throws.
  const migrated = migrate(value.save)
  // Migrate turns a version it has no way up from into an empty save: a file must not empty the game.
  const hadWorlds = isPlainObject(value.save.worlds) && Object.keys(value.save.worlds).length > 0
  if (hadWorlds && Object.keys(migrated.worlds).length === 0) {
    return { ok: false, reason: 'the save file is from a version of Agent Center this one cannot read' }
  }
  const cleaned = cleanSave(migrated)
  if (!cleaned.ok) return { ok: false, reason: `the save file is damaged: ${cleaned.problem}` }
  return { ok: true, save: cleaned.save, autoSpend: value.autoSpend === true, travel: value.travel === true }
}

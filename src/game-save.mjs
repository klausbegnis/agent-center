// The game's progress and what the worker needs to read tokens fairly across restarts, kept
// under one key of the plugin's own storage. Loaded once, written a while after it changes and
// when the plugin stops. A storage that fails never stops the game; a save from a newer version
// of the plugin is never overwritten.
import { normalizeBaselines } from './domain/game-tokens.mjs'

export const GAME_STORAGE_KEY = 'game'
/** The version of the stored wrapper. The engine's save inside it has a version of its own. */
export const STORED_VERSION = 1
/** Rounds come every half minute; writing at most this often keeps disk work low. */
const WRITE_DELAY_MS = 30_000
/** Orca keeps at most 256 KiB under one storage key; this leaves room to spare. */
export const MAX_STORED_BYTES = 240 * 1024
/** Baselines kept when the save is too large: the history window the worker reads. */
const BASELINES_KEPT_WHEN_LARGE = 200
/**
 * Retiree records kept per room when the save is too large, tried in turn. A record that goes is
 * folded into the room's count, which is what its bonus is computed from, so nothing is lost
 * but the chance for that old session to come back with its level.
 */
const RETIREES_KEPT_WHEN_LARGE = [25, 10, 0]

/**
 * @typedef {{ baselines: Record<string, { total: number, at: number }>, watchedUntil: number | null,
 *   autoSpend: boolean, tokenSource: 'history' | 'estimated' | null }} Bridge what the worker keeps
 *   beside the engine's save; `baselines` and `watchedUntil` belong to `tokenSource`
 * @typedef {{ save: object, bridge: Bridge }} GameData
 */

/** @returns {Bridge} */
export function emptyBridge() {
  return { baselines: {}, watchedUntil: null, autoSpend: false, tokenSource: null }
}

const TOKEN_SOURCES = new Set(['history', 'estimated'])

function normalizeBridge(value) {
  const bridge = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const watchedUntil = Number.isFinite(bridge.watchedUntil) ? bridge.watchedUntil : null
  // A save from before the estimate existed was watched through the session history.
  const formerSource = watchedUntil === null ? null : 'history'
  return {
    baselines: normalizeBaselines(bridge.baselines),
    watchedUntil,
    autoSpend: bridge.autoSpend === true,
    tokenSource: TOKEN_SOURCES.has(bridge.tokenSource) ? bridge.tokenSource : formerSource
  }
}

/** A timer that does not keep the worker alive on its own. */
function startUnrefTimer(run, ms) {
  const timer = setTimeout(run, ms)
  timer.unref?.()
  return timer
}

const sizeOf = (value) => Buffer.byteLength(JSON.stringify(value))

function foldRetirees(save, kept) {
  const worlds = Object.fromEntries(Object.entries(save.worlds).map(([worldId, world]) => [worldId, {
    ...world,
    projects: Object.fromEntries(Object.entries(world.projects).map(([projectId, project]) => {
      const dropped = Math.max(0, project.retirees.length - kept)
      if (dropped === 0) return [projectId, project]
      const retirees = project.retirees.slice(0, kept)
      return [projectId, { ...project, retirees, retiredCount: project.retiredCount + dropped }]
    }))
  }]))
  return { ...save, worlds }
}

/**
 * The stored value made to fit `maxBytes`: first the baselines of old sessions go, then old
 * retiree records are folded into their room's count (see RETIREES_KEPT_WHEN_LARGE).
 *
 * @param {{ version: number, save: object, bridge: Bridge }} value
 * @param {number} [maxBytes]
 * @returns {{ value: object, fits: boolean }}
 */
export function fitForStorage(value, maxBytes = MAX_STORED_BYTES) {
  if (sizeOf(value) <= maxBytes) return { value, fits: true }
  const newest = Object.entries(value.bridge.baselines).sort((a, b) => b[1].at - a[1].at)
  let fitted = {
    ...value,
    bridge: { ...value.bridge, baselines: Object.fromEntries(newest.slice(0, BASELINES_KEPT_WHEN_LARGE)) }
  }
  for (const kept of RETIREES_KEPT_WHEN_LARGE) {
    if (sizeOf(fitted) <= maxBytes) return { value: fitted, fits: true }
    fitted = { ...fitted, save: foldRetirees(fitted.save, kept) }
  }
  return { value: fitted, fits: sizeOf(fitted) <= maxBytes }
}

/**
 * Whether a stored value (or an exported save file, which has the same `version` and `save`) was
 * written by a newer plugin than this one.
 *
 * @param {unknown} stored
 * @param {number} saveVersion the engine's save version
 */
export function isNewer(stored, saveVersion) {
  if (!stored || typeof stored !== 'object') return false
  const newerWrapper = Number.isInteger(stored.version) && stored.version > STORED_VERSION
  const newerSave = Number.isInteger(stored.save?.version) && stored.save.version > saveVersion
  return newerWrapper || newerSave
}

/**
 * @param {{
 *   storage: { get: (key: string) => Promise<unknown>, set: (key: string, value: unknown) => Promise<unknown> },
 *   migrate: (value: unknown) => object,
 *   saveVersion: number,
 *   log: (message: string) => void,
 *   delayMs?: number,
 *   setTimer?: (run: () => void, ms: number) => unknown,
 *   clearTimer?: (timer: unknown) => void
 * }} dependencies `migrate` and `saveVersion` are the engine's (src/game/worlds.mjs); the timer
 *   functions are replaced in tests
 */
export function createGameSave({
  storage,
  migrate,
  saveVersion,
  log,
  delayMs = WRITE_DELAY_MS,
  setTimer = startUnrefTimer,
  clearTimer = (timer) => clearTimeout(timer)
}) {
  /** @type {GameData} */
  let data = { save: migrate(null), bridge: emptyBridge() }
  let isLoaded = false
  // Nothing is written before the stored game has been read: an empty game must never replace it.
  let isWritable = false
  let failedReads = 0
  let isFromNewerVersion = false
  let isDirty = false
  let timer = null
  let failedWrites = 0

  /**
   * Reads the stored game once. Later calls return what is in memory. A read that fails is tried
   * again on the next call: right after the plugin is reloaded Orca refuses the storage for a
   * moment, and a game started empty then would show all progress as gone.
   */
  async function load() {
    if (isLoaded) return data
    let stored
    try {
      stored = await storage.get(GAME_STORAGE_KEY)
    } catch (error) {
      failedReads += 1
      // Report the first failure of a run of them, not every round.
      if (failedReads === 1) log(`game: could not read the save, trying again: ${error?.message ?? error}`)
      return data
    }
    isLoaded = true
    failedReads = 0
    if (isNewer(stored, saveVersion)) {
      isFromNewerVersion = true
      log('game: the save is from a newer version of the plugin; it is left as it is')
      return data
    }
    isWritable = true
    const wrapper = stored && typeof stored === 'object' ? stored : {}
    data = { save: migrate(wrapper.save ?? null), bridge: normalizeBridge(wrapper.bridge) }
    return data
  }

  async function flush() {
    if (timer !== null) clearTimer(timer)
    timer = null
    if (!isDirty || !isWritable) return
    isDirty = false
    const { value, fits } = fitForStorage({ version: STORED_VERSION, save: data.save, bridge: data.bridge })
    if (!fits) {
      // Writing would fail anyway, and a smaller older save beats none: keep what is stored.
      log('game: the save is larger than Orca keeps under one key; it was not written')
      return
    }
    try {
      await storage.set(GAME_STORAGE_KEY, value)
      failedWrites = 0
    } catch (error) {
      isDirty = true
      failedWrites += 1
      // Report the first failure of a run of them, not every round.
      if (failedWrites === 1) log(`game: could not write the save: ${error?.message ?? error}`)
    }
  }

  /**
   * Replaces the game in memory and writes it a while later.
   *
   * @param {GameData} next
   */
  function set(next) {
    data = next
    isDirty = true
    if (timer !== null || !isWritable) return
    timer = setTimer(() => {
      timer = null
      flush().catch((error) => log(`game: ${error?.message ?? error}`))
    }, delayMs)
  }

  return {
    load,
    set,
    flush,
    /** @returns {GameData} */
    get: () => data,
    /** False until the stored game has been read; the game waits for it. */
    isLoaded: () => isLoaded,
    /** True when the stored save is from a newer plugin, which this one must not touch. */
    isFromNewerVersion: () => isFromNewerVersion
  }
}

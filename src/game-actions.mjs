// What a person can do in the game, checked before it reaches the engine: every id must name
// something that exists (or, for a new world, be a well-formed name), so nothing made up is
// stored. Each action answers whether it changed anything.
import { emptyBridge } from './game-save.mjs'
import { buildSaveFile, readSaveFile } from './game-transfer.mjs'
import { findItem } from './game/chest.mjs'
import { GATHERING_SKILLS, WORK_SKILLS } from './game/skills.mjs'
import { GROUP_UPGRADE_IDS } from './game/spending.mjs'
import { SAVE_VERSION, assignProject, migrate, resetWorld, worldIdOf } from './game/worlds.mjs'

/** A world's id: lower-case words joined by dashes, short enough for a label. */
const WORLD_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/
const WORLD_ID_LIMIT = 32
/** Worlds split progress on purpose; a handful is plenty, and it bounds the save. */
export const MAX_WORLDS = 8
const SKILL_IDS = new Set([...WORK_SKILLS, ...GATHERING_SKILLS])

/** An error whose message names what was refused, cut so a long input cannot flood the log. */
const refuse = (what, value) => new Error(`${what}: ${String(value).slice(0, 80)}`)

/**
 * @param {{
 *   engine: ReturnType<typeof import('./game/engine.mjs').createEngine>,
 *   data: () => import('./game-save.mjs').GameData,
 *   commit: (next: import('./game-save.mjs').GameData) => void,
 *   isRunning: () => boolean,
 *   isLoaded: () => boolean,
 *   canWriteSave: () => boolean,
 *   load: () => Promise<unknown>,
 *   roomIds: () => string[],
 *   setKeepTitlesSetting: (value: boolean) => Promise<void>,
 *   replaceGame: (next: import('./game-save.mjs').GameData) => void,
 *   now: () => number
 * }} dependencies `replaceGame` commits an imported game and forgets everything read before it
 */
export function createGameActions(dependencies) {
  const { engine, data, commit, isRunning, canWriteSave, load, roomIds, setKeepTitlesSetting } = dependencies
  const { isLoaded, replaceGame, now } = dependencies
  function requireRunning() {
    if (!isRunning()) throw new Error('the game is not running')
  }

  function requireWorld(save, worldId) {
    if (typeof worldId !== 'string' || !Object.hasOwn(save.worlds, worldId)) throw refuse('unknown world', worldId)
  }

  /** Applies a change to the save; answers whether it changed anything. */
  function change(update) {
    requireRunning()
    const { save, bridge } = data()
    const next = update(save)
    if (next === save) return { changed: false }
    commit({ save: next, bridge })
    return { changed: true }
  }

  /** A room the store shows now or one that already plays: anything else is refused. */
  function requireRoom(save, roomId) {
    const plays = Object.values(save.worlds).some((world) => Object.hasOwn(world.projects, roomId))
    if (typeof roomId !== 'string' || !(roomIds().includes(roomId) || plays)) throw refuse('unknown room', roomId)
  }

  return {
    /** @param {{ worldId: string, skillId: string }} input */
    async prestigeSkill({ worldId, skillId }) {
      return change((save) => {
        requireWorld(save, worldId)
        if (!SKILL_IDS.has(skillId)) throw refuse('unknown skill', skillId)
        return engine.prestige(save, { worldId, skillId })
      })
    },

    /** @param {{ roomId: string, itemId: string }} input */
    async upgradeItem({ roomId, itemId }) {
      return change((save) => {
        const worldId = typeof roomId === 'string' ? worldIdOf(save, roomId) : null
        const project = worldId === null ? null : save.worlds[worldId]?.projects[roomId]
        if (!project) throw refuse('unknown room', roomId)
        if (typeof itemId !== 'string' || !findItem(project.chest, itemId)) throw refuse('unknown item', itemId)
        return engine.upgradeItem(save, { projectId: roomId, itemId })
      })
    },

    /** @param {{ worldId: string, upgradeId: string }} input */
    async buyGroupUpgrade({ worldId, upgradeId }) {
      return change((save) => {
        requireWorld(save, worldId)
        if (!GROUP_UPGRADE_IDS.includes(upgradeId)) throw refuse('unknown upgrade', upgradeId)
        return engine.buyGroupUpgrade(save, { worldId, upgradeId })
      })
    },

    /**
     * Puts a room in a world, a new one included, or out of the game with null.
     *
     * @param {{ roomId: string, worldId: string | null }} input
     */
    async assignRoom({ roomId, worldId }) {
      return change((save) => {
        requireRoom(save, roomId)
        if (worldId !== null) {
          const worlds = new Set([...Object.keys(save.worlds), ...Object.values(save.projectWorld).filter(Boolean)])
          const isKnown = worlds.has(worldId)
          const isWellFormed = typeof worldId === 'string' && worldId.length <= WORLD_ID_LIMIT && WORLD_ID.test(worldId)
          if (!isKnown && !isWellFormed) throw refuse('not a world name', worldId)
          if (!isKnown && worlds.size >= MAX_WORLDS) throw new Error(`at most ${MAX_WORLDS} worlds`)
        }
        if (worldIdOf(save, roomId) === worldId) return save
        return assignProject(save, roomId, worldId)
      })
    },

    /** Starts a world over. Its rooms stay in it and begin again. @param {{ worldId: string }} input */
    async resetWorld({ worldId }) {
      return change((save) => {
        requireWorld(save, worldId)
        return resetWorld(save, worldId)
      })
    },

    /**
     * Moves the chest and retirees of a project left behind (in the save, not on screen) into a
     * room on screen that plays in the same world.
     *
     * @param {{ fromRoomId: string, toRoomId: string }} input
     */
    async moveOrphanItems({ fromRoomId, toRoomId }) {
      return change((save) => {
        const onScreen = roomIds()
        const sourceWorldId = typeof fromRoomId === 'string'
          ? Object.keys(save.worlds).find((worldId) => Object.hasOwn(save.worlds[worldId].projects, fromRoomId))
          : undefined
        if (!sourceWorldId || onScreen.includes(fromRoomId)) throw refuse('not a room left behind', fromRoomId)
        const plays = typeof toRoomId === 'string' && onScreen.includes(toRoomId) &&
          worldIdOf(save, toRoomId) === sourceWorldId && Object.hasOwn(save.worlds[sourceWorldId].projects, toRoomId)
        if (!plays) throw refuse('not a room on screen in the same world', toRoomId)
        return engine.moveProjectItems(save, { fromProjectId: fromRoomId, toProjectId: toRoomId, now: now() })
      })
    },

    /** @param {boolean} autoSpend */
    async setAutoSpend(autoSpend) {
      requireRunning()
      const { save, bridge } = data()
      if (bridge.autoSpend === autoSpend) return { changed: false }
      const next = autoSpend ? engine.autoSpend(save) : save
      commit({ save: next, bridge: { ...bridge, autoSpend } })
      return { changed: true }
    },

    /**
     * The saved game as a file: the engine's save and auto-spend, never the token baselines. It
     * works whenever the save has been read, even before a round wrote anything.
     */
    async exportSave() {
      if (!isLoaded()) throw new Error('the saved game has not been read yet')
      if (!canWriteSave()) throw new Error('the saved game is from a newer version of the plugin')
      const { save, bridge } = data()
      return buildSaveFile({ save, autoSpend: bridge.autoSpend, at: now() })
    },

    /**
     * Replaces the whole game with a save file. Nothing read before it counts again: the token
     * baselines and `watchedUntil` start over, as when the game is turned off and on.
     *
     * @param {unknown} file the parsed save file
     */
    async importSave(file) {
      requireRunning()
      if (!canWriteSave()) throw new Error('the saved game is from a newer version of the plugin')
      const read = readSaveFile(file, { saveVersion: SAVE_VERSION, migrate, cleanSave: engine.cleanSave })
      if (!read.ok) throw new Error(read.reason)
      replaceGame({ save: read.save, bridge: { ...emptyBridge(), autoSpend: read.autoSpend } })
      return { changed: true }
    },

    /**
     * Keeps conversation titles on retirees, or forgets every title kept. It is a setting, so it
     * can change while the game is off; the save follows when it can be written.
     *
     * @param {boolean} keepTitles
     */
    async setKeepTitles(keepTitles) {
      await setKeepTitlesSetting(keepTitles)
      // Never write a save that was not read first: it would replace the stored one.
      await load()
      const { save, bridge } = data()
      if (!canWriteSave() || save.settings.keepTitles === keepTitles) return { changed: true }
      commit({ save: engine.setKeepTitles(save, keepTitles), bridge })
      return { changed: true }
    }
  }
}

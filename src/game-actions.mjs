// What a person can do in the game, checked before it reaches the engine: every id must name
// something that exists (or, for a new world, be a well-formed name), so nothing made up is
// stored. Each action answers whether it changed anything.
import { worldWorkMix } from './domain/skill-mix.mjs'
import { createChronicleActions } from './game-chronicle.mjs'
import { createCityActions } from './game-city-actions.mjs'
import { createInstanceActions } from './game-instance-actions.mjs'
import { emptyBridge } from './game-save.mjs'
import { createTraitActions } from './game-trait-actions.mjs'
import { buildSaveFile, readSaveFile } from './game-transfer.mjs'
import { findItem } from './game/chest.mjs'
import { EQUIPMENT_SLOTS, changedSlots } from './game/equip.mjs'
import { LAST_OFFER_INDEX } from './game/city-rank-constants.mjs'
import { MARKET_MAX_AMOUNT } from './game/constants.mjs'
import { legendaryOf } from './game/legendary.mjs'
import { rebalanceWorkSkills } from './game/rebalance.mjs'
import { GATHERING_SKILLS, MATERIALS, WORK_SKILLS } from './game/skills.mjs'
import { GROUP_UPGRADE_IDS } from './game/spending.mjs'
import { MAX_WORLDS, isWorldId } from './game/world-ids.mjs'
import { SAVE_VERSION, assignProject, migrate, resetWorld, worldIdOf } from './game/worlds.mjs'
const SKILL_IDS = new Set([...WORK_SKILLS, ...GATHERING_SKILLS])

/** An error whose message names what was refused, cut so a long input cannot flood the log. */
const refuse = (what, value) => new Error(`${what}: ${String(value).slice(0, 80)}`)

/** A trade to gather, or null for none chosen (Auto). */
function requireTrade(trade) {
  if (trade !== null && !GATHERING_SKILLS.includes(trade)) throw refuse('unknown trade', trade)
}

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
 *   now: () => number,
 *   tell?: (events: object[]) => void
 * }} dependencies `replaceGame` commits an imported game and forgets everything read before it;
 *   `tell` adds events an action makes (an instance entered, a boon chosen) to `recent`
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

  /** A city of the content: the engine then checks that it is open to the world. */
  function requireCity(cityId) {
    if (!engine.cityIds.includes(cityId)) throw refuse('unknown city', cityId)
  }

  function requireMaterial(materialId) {
    if (!MATERIALS.includes(materialId)) throw refuse('unknown material', materialId)
  }

  function requireAmount(amount) {
    if (!Number.isInteger(amount) || amount < 1 || amount > MARKET_MAX_AMOUNT) throw refuse('not an amount', amount)
  }

  /** A room on screen or in the save, which plays in the world: what a stall's piece goes into. */
  function requireRoomOf(save, worldId, roomId) {
    requireRoom(save, roomId)
    if (worldIdOf(save, roomId) !== worldId || !Object.hasOwn(save.worlds[worldId].projects, roomId)) {
      throw refuse('not a room that plays in this world', roomId)
    }
  }

  /** A room the store shows now or one that already plays: anything else is refused. */
  function requireRoom(save, roomId) {
    const plays = Object.values(save.worlds).some((world) => Object.hasOwn(world.projects, roomId))
    if (typeof roomId !== 'string' || !(roomIds().includes(roomId) || plays)) throw refuse('unknown room', roomId)
  }

  /** The project of a room that plays in its own world: anything else is refused. */
  function joinedProject(save, roomId) {
    const worldId = typeof roomId === 'string' ? worldIdOf(save, roomId) : null
    const project = worldId === null ? null : save.worlds[worldId]?.projects[roomId]
    if (!project) throw refuse('unknown room', roomId)
    return project
  }

  /**
   * Two rooms that play, the target on screen, in one world: what a sending goes between.
   * Anything else is refused.
   */
  function requireSending(save, roomId, toRoomId) {
    joinedProject(save, roomId)
    joinedProject(save, toRoomId)
    if (!roomIds().includes(toRoomId)) throw refuse('not a room on screen', toRoomId)
    if (roomId === toRoomId || worldIdOf(save, roomId) !== worldIdOf(save, toRoomId)) {
      throw refuse('not another room of the same world', toRoomId)
    }
    return { fromProjectId: roomId, toProjectId: toRoomId }
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
        const project = joinedProject(save, roomId)
        if (typeof itemId !== 'string' || !findItem(project.chest, itemId)) throw refuse('unknown item', itemId)
        return engine.upgradeItem(save, { projectId: roomId, itemId })
      })
    },

    /**
     * Builds the next level of a building of the world's settlement, in materials alone or, with
     * `useCoins`, partly in coins. A building not open yet, or coins asked of one that takes none
     * yet, is refused with the reason.
     *
     * @param {{ worldId: string, upgradeId: string, useCoins?: boolean }} input
     */
    async buyGroupUpgrade({ worldId, upgradeId, useCoins = false }) {
      return change((save) => {
        requireWorld(save, worldId)
        if (!GROUP_UPGRADE_IDS.includes(upgradeId)) throw refuse('unknown upgrade', upgradeId)
        const problem = engine.buildingProblem(save, { worldId, upgradeId, useCoins })
        if (problem) throw refuse(problem, upgradeId)
        return engine.buyGroupUpgrade(save, { worldId, upgradeId, useCoins })
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
          if (!isKnown && !isWorldId(worldId)) throw refuse('not a world name', worldId)
          if (!isKnown && worlds.size >= MAX_WORLDS) throw new Error(`at most ${MAX_WORLDS} worlds`)
        }
        if (worldIdOf(save, roomId) === worldId) return save
        return assignProject(save, roomId, worldId)
      })
    },

    /**
     * Makes one of a room's relics the active one, or none with null. Only a relic the room owns.
     *
     * @param {{ roomId: string, relicId: string | null }} input
     */
    async setActiveRelic({ roomId, relicId }) {
      return change((save) => {
        const worldId = typeof roomId === 'string' ? worldIdOf(save, roomId) : null
        const project = worldId === null ? null : save.worlds[worldId]?.projects[roomId]
        if (!project) throw refuse('unknown room', roomId)
        if (relicId !== null && !legendaryOf(project).relics.includes(relicId)) throw refuse('not a relic the room owns', relicId)
        return engine.setActiveRelic(save, { projectId: roomId, relicId })
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
     * Shares a world's work-skill experience again by the mix its unknown working time follows
     * (worldWorkMix), keeping its world level. Only when asked; never automatic.
     *
     * @param {{ worldId: string }} input
     */
    async rebalanceSkills({ worldId }) {
      const { bridge } = data()
      return change((save) => {
        requireWorld(save, worldId)
        const world = save.worlds[worldId]
        const skills = rebalanceWorkSkills(world.skills, worldWorkMix(bridge.workMix?.[worldId]).mix)
        const isSame = JSON.stringify(skills) === JSON.stringify(world.skills)
        return isSame ? save : { ...save, worlds: { ...save.worlds, [worldId]: { ...world, skills } } }
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

    /**
     * Sends items of a room's chest to another room on screen that plays in the same world. An item
     * a character holds goes only with `confirmHeld`, and that character's slot takes the best free
     * item at once. Answers how many items went, how many copies the target's cap salvaged (and how
     * many of them were sent ones), and what each holder took instead. A sending the rules refuse
     * says why.
     *
     * @param {{ roomId: string, toRoomId: string, itemIds: string[], confirmHeld?: boolean }} input
     */
    async sendItem({ roomId, toRoomId, itemIds, confirmHeld = false }) {
      let result = null
      let keptByTarget = new Set()
      const answer = change((save) => {
        const sending = requireSending(save, roomId, toRoomId)
        const chest = joinedProject(save, roomId).chest
        if (!Array.isArray(itemIds)) throw refuse('not a list of items', itemIds)
        for (const itemId of itemIds) {
          if (typeof itemId !== 'string' || !findItem(chest, itemId)) throw refuse('unknown item', itemId)
        }
        const full = { ...sending, itemIds, confirmHeld: confirmHeld === true }
        const problem = engine.sendItemProblem(save, full)
        if (problem) throw new Error(problem)
        keptByTarget = new Set(joinedProject(save, toRoomId).chest)
        result = engine.sendItemWithSalvage(save, full)
        return result.save
      })
      const repicks = (result?.repicks ?? []).map(({ sessionId, slot, itemId }) => {
        const item = itemId ? findItem(joinedProject(data().save, roomId).chest, itemId) : null
        return { sessionId, slot, itemName: item ? engine.itemName(item.entryId ?? item.id) : null }
      })
      return {
        ...answer,
        sent: answer.changed ? itemIds.length : 0,
        salvaged: result?.salvaged.length ?? 0,
        sentSalvaged: result?.sentSalvaged.length ?? 0,
        // By name, so the notice says what went to materials: a sent item or a copy the target had.
        salvagedItems: (result?.salvaged ?? []).map((item) => ({
          name: engine.itemName(item.entryId ?? item.id), level: item.level, isSent: !keptByTarget.has(item)
        })),
        repicks
      }
    },

    /**
     * What sending items would do, without sending them: why it would be refused (a reason a
     * person can act on), or the items the target's copies cap would salvage, by name and level and
     * whether each is one sent, and how many materials the world would get for them. Held items
     * are assumed confirmed, so the forecast comes before that question. Changes nothing.
     *
     * @param {{ roomId: string, toRoomId: string, itemIds: string[] }} input
     * @returns {Promise<{ problem: string | null, salvaged: { name: string, level: number, isSent: boolean }[],
     *   materials: number }>}
     */
    async previewSendItem({ roomId, toRoomId, itemIds }) {
      requireRunning()
      const { save } = data()
      const sending = requireSending(save, roomId, toRoomId)
      const chest = joinedProject(save, roomId).chest
      if (!Array.isArray(itemIds)) throw refuse('not a list of items', itemIds)
      for (const itemId of itemIds) {
        if (typeof itemId !== 'string' || !findItem(chest, itemId)) throw refuse('unknown item', itemId)
      }
      const forecast = engine.forecastSend(save, { ...sending, itemIds })
      if (forecast.problem) return { problem: forecast.problem, salvaged: [], materials: 0 }
      const salvaged = forecast.salvaged.map(({ item, isSent }) => ({
        name: engine.itemName(item.entryId ?? item.id),
        level: item.level,
        isSent
      }))
      const materials = Object.values(forecast.materials).reduce((sum, amount) => sum + amount, 0)
      return { problem: null, salvaged, materials }
    },

    /**
     * Sends a relic a room owns to another room on screen of the same world. Answers whether it
     * was the room's active one, which leaves the room with none active.
     *
     * @param {{ roomId: string, toRoomId: string, relicId: string }} input
     */
    async sendRelic({ roomId, toRoomId, relicId }) {
      let wasActive = false
      const answer = change((save) => {
        const sending = requireSending(save, roomId, toRoomId)
        if (typeof relicId !== 'string') throw refuse('unknown relic', relicId)
        const problem = engine.sendRelicProblem(save, { ...sending, relicId })
        if (problem) throw new Error(problem)
        wasActive = legendaryOf(joinedProject(save, roomId)).active === relicId
        return engine.sendRelic(save, { ...sending, relicId })
      })
      return { ...answer, wasActive }
    },

    /**
     * Sets what a living character of a room gathers while idle, or null to follow its room.
     *
     * @param {{ roomId: string, sessionId: string, trade: string | null }} input
     */
    async setCharacterTrade({ roomId, sessionId, trade }) {
      return change((save) => {
        const project = joinedProject(save, roomId)
        if (typeof sessionId !== 'string' || !Object.hasOwn(project.characters, sessionId)) {
          throw refuse('unknown character', sessionId)
        }
        requireTrade(trade)
        return engine.setCharacterTrade(save, { projectId: roomId, sessionId, trade })
      })
    },

    /**
     * Sets what a living character of a room holds in a slot: an item of the room's chest, null
     * for nothing, or 'auto' for the automatic pick. A choice the rules refuse says why.
     *
     * @param {{ roomId: string, sessionId: string, slot: string, itemId: string | null }} input
     */
    async setEquipment({ roomId, sessionId, slot, itemId }) {
      return change((save) => {
        const project = joinedProject(save, roomId)
        if (typeof sessionId !== 'string' || !Object.hasOwn(project.characters, sessionId)) {
          throw refuse('unknown character', sessionId)
        }
        if (!EQUIPMENT_SLOTS.includes(slot)) throw refuse('unknown slot', slot)
        if (itemId !== null && typeof itemId !== 'string') throw refuse('unknown item', itemId)
        const problem = engine.equipProblem(project, { sessionId, slot, itemId })
        if (problem) throw new Error(problem)
        return engine.equipItem(save, { projectId: roomId, sessionId, slot, itemId })
      })
    },

    /**
     * Re-runs the automatic pick for every slot of a room nobody pinned, and answers how many
     * slots changed.
     *
     * @param {{ roomId: string }} input
     */
    async bestGear({ roomId }) {
      let before = null
      let after = null
      const answer = change((save) => {
        before = joinedProject(save, roomId)
        const next = engine.bestGearForRoom(save, { projectId: roomId })
        after = next.worlds[worldIdOf(next, roomId)].projects[roomId]
        return next
      })
      return { ...answer, slotsChanged: changedSlots(before, after).length }
    },

    /** @param {{ worldId: string, cityId: string, materialId: string, amount: number }} input */
    async sellMaterial({ worldId, cityId, materialId, amount }) {
      return change((save) => {
        requireWorld(save, worldId)
        requireCity(cityId)
        requireMaterial(materialId)
        requireAmount(amount)
        return engine.sellMaterial(save, { worldId, cityId, materialId, amount })
      })
    },

    /** @param {{ worldId: string, cityId: string, fromId: string, toId: string, amount: number }} input */
    async tradeMaterial({ worldId, cityId, fromId, toId, amount }) {
      return change((save) => {
        requireWorld(save, worldId)
        requireCity(cityId)
        requireMaterial(fromId)
        requireMaterial(toId)
        requireAmount(amount)
        return engine.tradeMaterial(save, { worldId, cityId, fromId, toId, amount })
      })
    },

    /**
     * Sets what a room's idle characters gather when they have no choice of their own, or null
     * for the engine's own pick.
     *
     * @param {{ roomId: string, trade: string | null }} input
     */
    async setRoomTrade({ roomId, trade }) {
      return change((save) => {
        joinedProject(save, roomId)
        requireTrade(trade)
        return engine.setRoomTrade(save, { projectId: roomId, trade })
      })
    },

    /**
     * Buys an offer of a city's stall into a room's chest. `entryId` is the piece the person saw,
     * so a stall that changed since is not bought from by mistake.
     *
     * @param {{ worldId: string, cityId: string, offerIndex: number, entryId: string, roomId: string }} input
     */
    async buyStallOffer({ worldId, cityId, offerIndex, entryId, roomId }) {
      return change((save) => {
        requireWorld(save, worldId)
        requireCity(cityId)
        // The gear's offers, the relic's, then a ranked city's (city-rank-constants.mjs).
        if (!Number.isInteger(offerIndex) || offerIndex < 0 || offerIndex > LAST_OFFER_INDEX) throw refuse('unknown offer', offerIndex)
        if (typeof entryId !== 'string') throw refuse('unknown offer', entryId)
        requireRoomOf(save, worldId, roomId)
        return engine.buyStallOffer(save, { worldId, cityId, offerIndex, entryId, projectId: roomId })
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
     * Turns "new scene after each monster" on or off. A setting of the bridge, like auto-spend:
     * nothing in the engine's save changes until the next kill.
     *
     * @param {boolean} travel
     */
    async setTravel(travel) {
      requireRunning()
      const { save, bridge } = data()
      if (bridge.travel === travel) return { changed: false }
      commit({ save, bridge: { ...bridge, travel } })
      return { changed: true }
    },

    /**
     * The saved game as a file: the engine's save, auto-spend and travel, never the token
     * baselines. It works whenever the save has been read, even before a round wrote anything.
     */
    async exportSave() {
      if (!isLoaded()) throw new Error('the saved game has not been read yet')
      if (!canWriteSave()) throw new Error('the saved game is from a newer version of the plugin')
      const { save, bridge } = data()
      return buildSaveFile({ save, autoSpend: bridge.autoSpend, travel: bridge.travel, at: now() })
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
      const { autoSpend, travel } = read
      replaceGame({ save: read.save, bridge: { ...emptyBridge(), autoSpend, travel } })
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
    },

    // Entering an instance, choosing the vault's boon, recalling the party (game-instance-actions.mjs).
    ...createInstanceActions({ engine, change, joinedProject, tell: dependencies.tell ?? (() => {}) }),
    ...createChronicleActions({ engine, change, joinedProject, now }),
    // Teaching, swapping, the trait broker and sending scrolls (game-trait-actions.mjs).
    ...createTraitActions({ engine, change, joinedProject, requireSending, requireWorld, requireCity }),
    // Buying a city's charter (game-city-actions.mjs).
    ...createCityActions({ engine, change, requireWorld, requireCity })
  }
}

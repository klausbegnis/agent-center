// The traits' actions, checked before they reach the engine like the others in game-actions.mjs:
// teaching a scroll's trait, swapping a trait for a scroll, buying from and selling to a city's
// trait broker, and sending a scroll to another room. One entry point, `traitAction`, names the
// action in its input; `traitInputOf` is the controller's check of the kind of every value.

/** An error whose message names what was refused, cut so a long input cannot flood the log. */
const refuse = (what, value) => new Error(`${what}: ${String(value).slice(0, 80)}`)

/** The longest id a surface may send. */
const TEXT_LIMIT = 512
/** The fields each action takes, and whether each is text or a whole number. */
export const TRAIT_ACTION_FIELDS = Object.freeze({
  teach: { roomId: 'text', sessionId: 'text', traitId: 'text' },
  swap: { roomId: 'text', sessionId: 'text', oldTraitId: 'text', traitId: 'text' },
  buy: { worldId: 'text', cityId: 'text', offerIndex: 'whole', traitId: 'text', roomId: 'text' },
  sell: { worldId: 'text', cityId: 'text', roomId: 'text', traitId: 'text' },
  send: { roomId: 'text', toRoomId: 'text', traitId: 'text' }
})

/**
 * A trait action's input with every value of the kind it must be, and nothing else: the
 * controller's check. Throws on anything else.
 *
 * @param {unknown} input
 * @returns {{ action: string } & Record<string, string | number>}
 */
export function traitInputOf(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('invalid trait action')
  const fields = Object.hasOwn(TRAIT_ACTION_FIELDS, input.action) ? TRAIT_ACTION_FIELDS[input.action] : null
  if (!fields) throw refuse('unknown trait action', input.action)
  const checked = { action: input.action }
  for (const [field, kind] of Object.entries(fields)) {
    const value = input[field]
    const isText = typeof value === 'string' && value !== '' && value.length <= TEXT_LIMIT
    if (kind === 'text' ? !isText : !Number.isInteger(value)) throw new Error(`invalid ${field}`)
    checked[field] = value
  }
  return checked
}

/**
 * @param {{
 *   engine: ReturnType<typeof import('./game/engine.mjs').createEngine>,
 *   change: (update: (save: object) => object) => { changed: boolean },
 *   joinedProject: (save: object, roomId: string) => object,
 *   requireSending: (save: object, roomId: string, toRoomId: string) => { fromProjectId: string, toProjectId: string },
 *   requireWorld: (save: object, worldId: string) => void,
 *   requireCity: (cityId: string) => void
 * }} dependencies the checks game-actions.mjs makes for its own actions
 */
export function createTraitActions({ engine, change, joinedProject, requireSending, requireWorld, requireCity }) {
  /** A room of the world that plays in it: what a bought scroll goes into, or a sold one comes from. */
  const requireRoomOf = (save, worldId, roomId) => {
    joinedProject(save, roomId)
    if (!Object.hasOwn(save.worlds[worldId].projects, roomId)) throw refuse('not a room that plays in this world', roomId)
  }
  /** Runs a check that answers a reason, and refuses with it. */
  const unless = (problem) => {
    if (problem) throw new Error(problem)
  }
  const run = {
    teach: (save, input) => {
      joinedProject(save, input.roomId)
      const choice = { projectId: input.roomId, sessionId: input.sessionId, traitId: input.traitId }
      unless(engine.teachProblem(save, choice))
      return engine.teachTrait(save, choice)
    },
    swap: (save, input) => {
      joinedProject(save, input.roomId)
      const swap = { projectId: input.roomId, sessionId: input.sessionId, oldTraitId: input.oldTraitId, traitId: input.traitId }
      unless(engine.swapProblem(save, swap))
      return engine.swapTrait(save, swap)
    },
    buy: (save, input) => {
      requireWorld(save, input.worldId)
      requireCity(input.cityId)
      requireRoomOf(save, input.worldId, input.roomId)
      const purchase = { worldId: input.worldId, cityId: input.cityId, offerIndex: input.offerIndex, traitId: input.traitId,
        projectId: input.roomId }
      unless(engine.buyScrollProblem(save, purchase))
      return engine.buyTraitScroll(save, purchase)
    },
    sell: (save, input) => {
      requireWorld(save, input.worldId)
      requireCity(input.cityId)
      requireRoomOf(save, input.worldId, input.roomId)
      const sale = { worldId: input.worldId, cityId: input.cityId, projectId: input.roomId, traitId: input.traitId }
      unless(engine.sellScrollProblem(save, sale))
      return engine.sellTraitScroll(save, sale)
    },
    send: (save, input) => {
      const sending = { ...requireSending(save, input.roomId, input.toRoomId), traitId: input.traitId }
      unless(engine.sendScrollProblem(save, sending))
      return engine.sendScroll(save, sending)
    }
  }
  return {
    /**
     * One trait action, named by `action` (see TRAIT_ACTION_FIELDS). A choice the rules refuse
     * says why.
     *
     * @param {{ action: string } & Record<string, string | number>} input checked by `traitInputOf`
     */
    async traitAction(input) {
      if (!Object.hasOwn(run, input?.action)) throw refuse('unknown trait action', input?.action)
      return change((save) => run[input.action](save, input))
    }
  }
}

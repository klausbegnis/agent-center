// The instances' actions, checked before they reach the engine like the others in game-actions.mjs:
// entering an instance, choosing the vault's boon and recalling the party. Each answers whether it
// changed anything; a choice the rules refuse says why.
import { rematchTier } from './game/instance-rematch.mjs'

/** An error whose message names what was refused, cut so a long input cannot flood the log. */
const refuse = (what, value) => new Error(`${what}: ${String(value).slice(0, 80)}`)

/** The most a tier may be asked for; the engine says which are open. */
const MAX_TIER = 10_000

/**
 * @param {{
 *   engine: ReturnType<typeof import('./game/engine.mjs').createEngine>,
 *   change: (update: (save: object) => object) => { changed: boolean },
 *   joinedProject: (save: object, roomId: string) => object,
 *   tell: (events: object[]) => void
 * }} dependencies `change` applies an update to the save, `joinedProject` refuses a room that does
 *   not play, `tell` adds events to the view state's `recent`
 */
export function createInstanceActions({ engine, change, joinedProject, tell }) {
  return {
    /**
     * Sends a room's party into an open instance at a tier, or, with `rematch`, into that rematch
     * of its boss (it plays at its own tier).
     *
     * @param {{ roomId: string, instanceId: string, tier: number, rematch?: number }} input
     */
    async enterInstance({ roomId, instanceId, tier, rematch }) {
      let entered = null
      const answer = change((save) => {
        joinedProject(save, roomId)
        if (typeof instanceId !== 'string') throw refuse('unknown instance', instanceId)
        if (!Number.isInteger(tier) || tier < 1 || tier > MAX_TIER) throw refuse('not a tier', tier)
        if (rematch !== undefined && (!Number.isInteger(rematch) || rematch < 1 || rematch > MAX_TIER)) throw refuse('not a rematch', rematch)
        const entry = rematch === undefined ? { projectId: roomId, instanceId, tier } : { projectId: roomId, instanceId, tier, rematch }
        const problem = engine.enterProblem(save, entry)
        if (problem) throw new Error(problem)
        entered = entry
        return engine.enterInstance(save, entry)
      })
      if (answer.changed && entered) {
        const played = rematch === undefined ? { tier } : { tier: rematchTier(rematch), rematch }
        tell([{ type: 'instance', kind: 'enter', roomId, instance: instanceId, ...played, room: 0 }])
      }
      return answer
    },

    /**
     * Takes one of the two boons the vault offers a room's run.
     *
     * @param {{ roomId: string, boonId: string }} input
     */
    async chooseBoon({ roomId, boonId }) {
      let run = null
      const answer = change((save) => {
        run = joinedProject(save, roomId).run ?? null
        if (typeof boonId !== 'string') throw refuse('unknown boon', boonId)
        const problem = engine.boonProblem(save, { projectId: roomId, boonId })
        if (problem) throw new Error(problem)
        return engine.chooseBoon(save, { projectId: roomId, boonId })
      })
      if (answer.changed && run) {
        tell([{ type: 'instance', kind: 'boon', roomId, instance: run.instance, tier: run.tier, room: run.room, boon: boonId, chosenBy: 'person' }])
      }
      return answer
    },

    /**
     * Ends a room's run by hand: it keeps what it found and its wave comes back, with the
     * instance's cooldown as after a failed run.
     *
     * @param {{ roomId: string }} input
     */
    async recallParty({ roomId }) {
      let run = null
      const answer = change((save) => {
        run = joinedProject(save, roomId).run ?? null
        if (!run) throw new Error('the room is not inside an instance')
        return engine.recallParty(save, { projectId: roomId })
      })
      if (answer.changed && run) {
        tell([{ type: 'instance', kind: 'recalled', roomId, instance: run.instance, tier: run.tier, room: run.room, found: run.found }])
      }
      return answer
    }
  }
}

// The wording of where a world's split between work skills comes from, under the Skills tab's
// work skills, and of the "Rebalance work skills" setting with its before and after.
import { skillLabel } from './labels.js'

/** The line under the work skills, by where the split comes from (skillSplit.from). */
const SPLIT_FROM = {
  tools: 'Split from your agents\' tools.',
  activity: 'Split by what each agent is doing when its tokens are counted.',
  none: null
}

/** What the time no tool explains follows, by the world's mix (skillSplit.mix). */
const MIX_FOLLOWED = {
  observed: 'the tools your other agents were seen using',
  default: 'a default mix for coding work'
}

/**
 * The line that says where a world's split between work skills comes from now, or null when
 * there is nothing to say yet.
 *
 * @param {{ from?: string, mix?: string } | undefined} skillSplit
 * @returns {string | null}
 */
export function splitSourceLine(skillSplit) {
  const from = skillSplit?.from
  if (!from) return null
  if (Object.hasOwn(SPLIT_FROM, from)) return SPLIT_FROM[from]
  const followed = MIX_FOLLOWED[skillSplit.mix] ?? MIX_FOLLOWED.default
  return from === 'mix'
    ? `Estimated mix: tools are not visible for these agents, so their time follows ${followed}.`
    : `Estimated mix: tools are not visible for some agents, so their time follows ${followed}.`
}

/**
 * "Arcana 52 → 16, Forge 4 → 15, …" for the skills a rebalance changes, or null when it changes none.
 *
 * @param {{ skillId: string, from: number, to: number }[] | undefined} preview
 * @returns {string | null}
 */
export function rebalanceChanges(preview) {
  const changed = (preview ?? []).filter((entry) => entry.from !== entry.to)
  if (!changed.length) return null
  return changed.map((entry) => `${skillLabel(entry.skillId)} ${entry.from} → ${entry.to}`).join(', ')
}

export const REBALANCE = {
  title: 'Rebalance work skills',
  note: 'Shares this world\'s work-skill experience again by the mix your agents\' time follows ' +
    'now, for a world that grew lopsided. The world level stays the same.',
  world: 'World to rebalance',
  nothing: 'The work skills already follow the mix: a rebalance would change nothing.',
  question: (worldId, changes) => `Rebalance the work skills of "${worldId}"? ${changes}. ` +
    'The world level stays the same; experience beyond what that level holds is not kept, and ' +
    'stars stay where they are. This cannot be undone.',
  confirm: (worldId) => `Rebalance ${worldId}`,
  mix: { observed: 'Mix: the tools your agents were seen using.', default: 'Mix: a default for coding work.' }
}

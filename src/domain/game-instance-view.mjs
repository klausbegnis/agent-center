// Instances in the view state's `recent`: the engine's run events turned into what a room
// celebrates (entering, a room cleared, a check, the vault, a boon, the clear, a failure or a
// recall), with the legendary items a run gave as `legendary` events like a boss's drop. Pure.

/** The run's kinds of news a room tells; a retry is a step of a room, not news. */
const TOLD = new Set(['enter', 'room', 'check', 'vault', 'boon', 'cleared', 'failed', 'recalled'])

/**
 * The recent events of one run event of the engine.
 *
 * @param {{ type: 'instance', kind: string, projectId: string, worldId: string, instance: string,
 *   tier: number, room: number, drops?: { id: string, kind: string }[] }} event
 * @returns {object[]}
 */
export function instanceEventsOf(event) {
  const { type: _type, projectId, worldId, drops = [], ...details } = event
  if (!TOLD.has(details.kind)) return []
  const told = [{ type: 'instance', roomId: projectId, worldId, ...details, ...(drops.length ? { drops } : {}) }]
  for (const drop of drops) told.push({ type: 'legendary', roomId: projectId, worldId, item: drop.id, kind: drop.kind })
  return told
}

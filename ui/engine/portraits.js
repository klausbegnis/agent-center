// Which sprite a character's portrait on the Party tab shows: the theme its room is drawn in now
// and the id its look comes from, exactly as the room draws it, or why it shows a placeholder.
// Never touches the DOM.

/**
 * @typedef {{ kind: 'sprite', themeId: string, agentKind: string | null, lookId: string, key: string }
 *   | { kind: 'placeholder', reason: 'off-screen' | 'hidden' | 'loading', themeId: string | null,
 *   key: string }} Portrait `key` changes exactly when what is drawn changes
 */

/**
 * @param {{ rooms: { id: string, agents: object[] }[], hidden?: string[] }} state
 * @param {{ roomId: string, agentId: string, themeIds: Map<string, string>,
 *   isLoaded: (themeId: string) => boolean }} who `themeIds` is roomThemeIds' answer
 * @returns {Portrait}
 */
export function portraitOf(state, { roomId, agentId, themeIds, isLoaded }) {
  const room = state.rooms.find((entry) => entry.id === roomId)
  const agent = room?.agents.find((entry) => entry.id === agentId) ?? null
  if (!agent) return { kind: 'placeholder', reason: 'off-screen', themeId: null, key: 'off-screen' }
  if ((state.hidden ?? []).includes(roomId)) return { kind: 'placeholder', reason: 'hidden', themeId: null, key: 'hidden' }
  const themeId = themeIds.get(roomId) ?? null
  if (themeId === null || !isLoaded(themeId)) {
    return { kind: 'placeholder', reason: 'loading', themeId, key: `loading|${themeId}` }
  }
  // A subagent drawn as a character wears its parent's look, as in the room (actor-view.js).
  const lookId = agent.parentId ?? agent.id
  const agentKind = agent.kind ?? null
  return { kind: 'sprite', themeId, agentKind, lookId, key: `${themeId}|${agentKind}|${lookId}` }
}

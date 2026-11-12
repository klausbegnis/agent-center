// Finds agent sessions Orca has lost track of. After Orca restarts, a session that was already
// running keeps working in its terminal, but Orca no longer lists it as an agent and sends no
// events for it until it is started again. Its terminal still tells enough to show it: the
// title an agent CLI sets, and when the terminal last printed something.

/**
 * Agent CLIs mark their terminal title with a symbol in front of the conversation name: a
 * star-like glyph, or a spinner drawn with braille dots while working. A plain shell's title is
 * a path or a command and starts with neither.
 */
const AGENT_TITLE = /^[✳✴✶✻✽✢·⠀-⣿]\s*(.+)$/u

/** A terminal that printed within this long is taken as working; a spinner prints constantly. */
const WORKING_WITHIN_MS = 30_000

/**
 * Adds an agent to its workspace's row for every terminal that looks like an agent session and
 * that Orca's own list does not cover.
 *
 * @param {{ workspace: { path: string }, agents: { paneKey: string }[] }[]} rows from readHost
 * @param {{ paneKey: string, title: string | null, lastOutputAt: number | null,
 *   worktreePath: string | null }[]} terminals from readTerminals
 * @param {number} now
 * @returns {object[]} the rows, with the inferred agents added
 */
export function withUntrackedSessions(rows, terminals, now) {
  const tracked = new Set(rows.flatMap((row) => row.agents.map((agent) => agent.paneKey)))
  const extraByPath = new Map()
  for (const terminal of terminals ?? []) {
    const name = AGENT_TITLE.exec(terminal.title ?? '')?.[1]?.trim()
    if (!name || !terminal.worktreePath || tracked.has(terminal.paneKey)) continue
    const isWorking = terminal.lastOutputAt !== null && now - terminal.lastOutputAt < WORKING_WITHIN_MS
    const extra = extraByPath.get(terminal.worktreePath) ?? []
    extra.push({
      paneKey: terminal.paneKey,
      parentPaneKey: null,
      state: isWorking ? 'working' : 'done',
      agentType: null,
      conversationName: name,
      taskTitle: null,
      displayName: null,
      prompt: null,
      toolName: null,
      // Nobody can say whether it was seen; a session Orca does not track has no bell either.
      unread: false,
      mainAgent: null,
      activityStatus: null,
      stateStartedAt: terminal.lastOutputAt ?? now,
      hasLivePty: true
    })
    extraByPath.set(terminal.worktreePath, extra)
  }
  if (extraByPath.size === 0) return rows
  return rows.map((row) => {
    const extra = extraByPath.get(row.workspace.path)
    return extra ? { ...row, agents: [...row.agents, ...extra] } : row
  })
}

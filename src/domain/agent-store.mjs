// The agent state machine. It has no dependency on Orca: events go in, a snapshot ready to draw
// comes out. Everything here is synchronous and deterministic, so it is covered by unit tests.
import { activityForTool, isDelegateTool } from './activities.mjs'
import { basename, groupRooms } from './rooms.mjs'

const NO_PROJECT_ROOM = { id: 'no-project', name: 'No project', host: null }
const SUBAGENT_NAME_LIMIT = 40
/** An agent on no known host that sent nothing for this long is taken as gone. */
const ABANDONED_AFTER_MS = 30 * 60_000
/** A terminal link nobody confirmed for this long, leading to no agent, is forgotten. */
const TERMINAL_LINK_KEPT_MS = 5 * 60_000
/** How long a freshly seen agent is protected from removal by a snapshot that predates it. */
const SNAPSHOT_GRACE_MS = 10_000
/**
 * An agent has to be absent from this many snapshots in a row before it is taken to be gone.
 * One snapshot can miss an agent that is busy or still starting.
 */
const MISSED_SNAPSHOTS_BEFORE_REMOVAL = 2

/** Agent states, from the one that needs the person most to the one that needs them least. */
const URGENCY = { blocked: 3, waiting: 2, working: 1, done: 0 }

/**
 * Orca reports a state for the pane and another for its main agent, and they can differ: the
 * pane can be blocked on an approval while the main agent still counts as working. The state
 * that needs the person most is the one to show.
 *
 * @param {...(string | null | undefined)} states
 * @returns {string | undefined} undefined when none is a known state
 */
export function mostUrgentState(...states) {
  let chosen
  for (const state of states) {
    if (Object.hasOwn(URGENCY, state) && (chosen === undefined || URGENCY[state] > URGENCY[chosen])) chosen = state
  }
  return chosen
}

export function createAgentStore({ now = Date.now, sleepMs = 30 * 60_000 } = {}) {
  /** Agents by key; the key is the paneKey when known, otherwise the terminal id. */
  const agents = new Map()
  /** terminal id -> agent key, for the hooks, which only carry the terminal. */
  const terminals = new Map()
  /** terminal id -> when its link was last confirmed, to drop the links of closed terminals. */
  const terminalSeenAt = new Map()
  const workspaces = new Map()
  let rooms = new Map()
  let options = { sleepMs }

  function linkTerminal(terminalId, agentKey) {
    terminals.set(terminalId, agentKey)
    terminalSeenAt.set(terminalId, now())
  }

  /** Forgets links that were not confirmed for a while and lead to no agent: closed terminals. */
  function forgetStaleTerminals() {
    for (const [terminalId, agentKey] of terminals) {
      const isStale = now() - (terminalSeenAt.get(terminalId) ?? 0) > TERMINAL_LINK_KEPT_MS
      if (!isStale || agents.has(agentKey)) continue
      terminals.delete(terminalId)
      terminalSeenAt.delete(terminalId)
    }
  }

  function setWorkspaces(list) {
    workspaces.clear()
    const all = list ?? []
    for (const workspace of all) workspaces.set(workspace.id, workspace)
    rooms = groupRooms(all)
  }

  function findKey({ terminalId, paneKey, workspaceId, agent }) {
    if (paneKey) {
      if (terminalId) {
        // A hook may have created the agent with only the terminal before the first status.
        const byTerminal = agents.get(terminalId)
        if (byTerminal && !agents.has(paneKey)) {
          agents.delete(terminalId)
          byTerminal.id = paneKey
          agents.set(paneKey, byTerminal)
        }
        linkTerminal(terminalId, paneKey)
      }
      return paneKey
    }
    if (terminalId) return keyForTerminal(terminalId, workspaceId, agent)
    return soleAgentIn(workspaceId, agent)?.id ?? `ws:${workspaceId ?? 'none'}:${agent ?? 'agent'}`
  }

  /** The one agent of this kind in a workspace, or null when there are none or several. */
  function soleAgentIn(workspaceId, kind) {
    const candidates = [...agents.values()].filter(
      (entry) => entry.workspaceId === workspaceId && (!kind || !entry.kind || entry.kind === kind)
    )
    return candidates.length === 1 ? candidates[0] : null
  }

  /** The agent an event that only names a terminal belongs to. */
  function keyForTerminal(terminalId, workspaceId, kind) {
    const linked = terminals.get(terminalId)
    if (linked) return linked
    if (agents.has(terminalId)) return terminalId
    // Not linked to a pane yet. When the workspace holds a single agent the event is about that
    // one; a second entry under the terminal id would show the same agent twice.
    const only = soleAgentIn(workspaceId, kind)
    if (!only) return terminalId
    linkTerminal(terminalId, only.id)
    return only.id
  }

  /** Folds an agent that was created under its terminal id into the one known by its pane. */
  function adoptTerminalEntry(terminalId, paneKey) {
    const stray = agents.get(terminalId)
    if (!stray || terminalId === paneKey) return
    agents.delete(terminalId)
    const known = agents.get(paneKey)
    if (!known) {
      stray.id = paneKey
      agents.set(paneKey, stray)
      return
    }
    known.kind ??= stray.kind
    // The stray was fed by tool events, so whichever of the two changed last is the truth.
    if (stray.since >= known.since) {
      known.state = stray.state
      known.activity = stray.activity
      known.since = stray.since
    }
    for (const [callId, sub] of stray.subs) known.subs.set(callId, sub)
    known.seenAt = Math.max(known.seenAt, stray.seenAt)
  }

  /**
   * Tells the store which terminal shows which pane. Tool events only name the terminal, and
   * the snapshot only names the pane; without this link the two describe different agents.
   *
   * @param {{ terminalId: string, paneKey: string }[]} links
   */
  function linkTerminals(links) {
    for (const { terminalId, paneKey } of links ?? []) {
      if (!terminalId || !paneKey) continue
      linkTerminal(terminalId, paneKey)
      adoptTerminalEntry(terminalId, paneKey)
    }
  }

  function hostOf(entry) {
    return entry.host ?? workspaces.get(entry.workspaceId)?.hostId ?? null
  }

  /**
   * The terminal an agent runs in, or null when no terminal was linked to it. A subagent has no
   * terminal of its own, so its id leads to its parent's.
   *
   * @returns {{ terminalId: string, hostId: string | null } | null}
   */
  function terminalOf(agentId) {
    const entry =
      agents.get(agentId) ?? [...agents.values()].find((item) => [...item.subs.values()].some((sub) => sub.id === agentId))
    if (!entry) return null
    for (const [terminalId, linkedId] of terminals) {
      if (linkedId === entry.id) return { terminalId, hostId: hostOf(entry) }
    }
    return null
  }

  function upsert(ref) {
    const key = findKey(ref)
    let entry = agents.get(key)
    if (!entry) {
      entry = {
        id: key,
        workspaceId: ref.workspaceId ?? null,
        title: null,
        kind: null,
        state: 'working',
        outcome: null,
        // Whether the person has yet to look at what the agent finished (Orca's bell).
        unread: false,
        activity: 'think',
        since: now(),
        seenAt: now(),
        subs: new Map()
      }
      agents.set(key, entry)
    }
    // An event can name the workspace in a form the snapshot does not know (a paired machine's,
    // for one). Keep the known one, or the agent would jump to the "No project" room and back.
    if (ref.workspaceId && (!entry.workspaceId || workspaces.has(ref.workspaceId))) {
      entry.workspaceId = ref.workspaceId
    }
    entry.seenAt = now()
    entry.missedSnapshots = 0
    return entry
  }

  function setActivity(target, activity) {
    if (target.activity !== activity) {
      target.activity = activity
      target.since = now()
    }
  }

  function isStale(state, since) {
    return state === 'done' && now() - since > options.sleepMs
  }

  /** The `agent.status.changed` event. */
  function status(event) {
    const entry = upsert(event)
    if (event.title) entry.title = event.title
    const state = mostUrgentState(event.state, event.mainAgent?.state) ?? entry.state
    const startedAt =
      (state === event.mainAgent?.state ? event.mainAgent.stateStartedAt : null) ?? event.receivedAt ?? now()
    if (entry.state !== state) {
      entry.state = state
      entry.since = startedAt
      // The event does not say whether anyone is looking. Finishing counts as unseen until
      // the next snapshot says otherwise; starting again clears it.
      entry.unread = state === 'done' ? event.unread ?? true : false
    }
    entry.outcome = event.mainAgent?.outcome ?? null
    if (state === 'done') entry.subs.clear()
    if (state !== 'working') entry.activity = 'think'
  }

  function lastSub(entry) {
    let last = null
    for (const sub of entry.subs.values()) last = sub
    return last
  }

  /** The `agent.tool.before` hook. */
  function toolBefore(event) {
    const entry = upsert(event)
    if (event.agent) entry.kind = event.agent
    if (entry.state !== 'working') {
      entry.state = 'working'
      entry.since = now()
      entry.unread = false
    }
    if (isDelegateTool(event.tool)) {
      const input = event.input && typeof event.input === 'object' ? event.input : {}
      const callId = event.callId ?? `sub-${entry.subs.size + 1}-${now()}`
      entry.subs.set(callId, {
        id: `${entry.id}/${callId}`,
        name: String(input.subagent_type ?? input.description ?? 'subagent').slice(0, SUBAGENT_NAME_LIMIT),
        activity: 'think',
        since: now()
      })
      setActivity(entry, 'delegate')
      return
    }
    // With active subagents there is no telling whose tool this is: the heuristic gives it to
    // the most recent subagent and leaves the parent "delegating".
    const sub = lastSub(entry)
    setActivity(sub ?? entry, activityForTool(event.tool))
  }

  /** The `agent.tool.after` hook. */
  function toolAfter(event) {
    const entry = upsert(event)
    if (event.agent) entry.kind = event.agent
    if (!isDelegateTool(event.tool)) return
    if (event.callId && entry.subs.has(event.callId)) {
      entry.subs.delete(event.callId)
    } else {
      // No call id: end the oldest subagent that came from a hook.
      for (const key of entry.subs.keys()) {
        if (!key.startsWith('pane:')) {
          entry.subs.delete(key)
          break
        }
      }
    }
    if (entry.subs.size === 0) setActivity(entry, 'think')
  }

  /**
   * Full snapshot of one host, from `orca worktree ps`: what was already running before the
   * plugin loaded, and the correction for any missed event. Each row is a workspace with its
   * list of agents; an agent with a `parentPaneKey` is another one's subagent.
   */
  function sync(hostId, rows) {
    const seen = new Set()
    const children = []
    for (const row of rows ?? []) {
      for (const agent of row.agents ?? []) {
        if (agent.parentPaneKey) {
          children.push(agent)
          continue
        }
        const state = mostUrgentState(agent.state, agent.mainAgent?.state, agent.activityStatus) ?? 'working'
        const since =
          (state === agent.mainAgent?.state ? agent.mainAgent.stateStartedAt : null) ?? agent.stateStartedAt ?? now()
        // While its terminal exists the agent stays in the room, asleep once it is done.
        if (!agent.paneKey || agent.hasLivePty === false) continue
        const isNew = !agents.has(agent.paneKey)
        const entry = upsert({ paneKey: agent.paneKey, workspaceId: row.workspaceId })
        seen.add(entry.id)
        entry.host = hostId
        entry.kind = agent.agentType ?? entry.kind
        entry.title = agent.conversationName ?? agent.taskTitle ?? agent.displayName ?? agent.prompt ?? entry.title
        entry.outcome = agent.mainAgent?.outcome ?? null
        if (typeof agent.unread === 'boolean') entry.unread = agent.unread
        // A snapshot takes a moment to read. If an event changed the agent meanwhile, the event
        // is newer than what the snapshot saw, and wins.
        if (entry.state !== state && (isNew || since >= entry.since)) {
          entry.state = state
          entry.since = since
        }
        if (entry.state === 'working' && state === 'working' && agent.toolName && !isDelegateTool(agent.toolName) && entry.subs.size === 0) {
          setActivity(entry, activityForTool(agent.toolName))
        }
        if (state === 'done') entry.subs.clear()
        // Subagents seen by ps are rebuilt on every snapshot; the ones from hooks stay.
        for (const key of [...entry.subs.keys()]) if (key.startsWith('pane:')) entry.subs.delete(key)
      }
    }
    for (const child of children) {
      const parent = agents.get(child.parentPaneKey)
      const state = mostUrgentState(child.state, child.mainAgent?.state)
      if (!parent || state === 'done') continue
      parent.subs.set(`pane:${child.paneKey}`, {
        id: child.paneKey,
        name: String(child.displayName ?? child.taskTitle ?? child.conversationName ?? 'subagent').slice(0, SUBAGENT_NAME_LIMIT),
        activity: child.toolName ? activityForTool(child.toolName) : 'think',
        since: child.stateStartedAt ?? now()
      })
    }
    // Whoever belonged to this host and is gone from the snapshot closed its terminal. The
    // grace period avoids deleting an agent an event just created and ps has not seen yet.
    for (const [key, entry] of agents) {
      if (hostOf(entry) !== hostId) continue
      if (seen.has(key)) {
        entry.missedSnapshots = 0
        continue
      }
      entry.missedSnapshots = (entry.missedSnapshots ?? 0) + 1
      const quiet = now() - entry.seenAt > SNAPSHOT_GRACE_MS
      if (quiet && entry.missedSnapshots >= MISSED_SNAPSHOTS_BEFORE_REMOVAL) agents.delete(key)
    }
  }

  /**
   * Removes agents done for longer than the limit. Returns true when something changed.
   *
   * With `everyHost` false, agents on a host the snapshot covers are left alone: they leave when
   * their terminal closes. Agents on no known host are never in a snapshot, so they always age out.
   */
  function prune({ everyHost = true } = {}) {
    let changed = false
    for (const [key, entry] of agents) {
      const onNoHost = hostOf(entry) === null
      // No snapshot covers an agent on no known host, so nothing would ever say it is gone.
      // Whatever its state, long silence means its session ended.
      const isAbandoned = onNoHost && now() - entry.seenAt > ABANDONED_AFTER_MS
      const isDoneForLong = (everyHost || onNoHost) && isStale(entry.state, entry.since)
      if (isAbandoned || isDoneForLong) {
        agents.delete(key)
        changed = true
      }
    }
    forgetStaleTerminals()
    return changed
  }

  function configure(next) {
    options = { ...options, ...next }
  }

  function displayActivity(entry) {
    if (entry.state === 'waiting') return 'wait'
    if (entry.state === 'blocked') return 'blocked'
    // Done and not looked at yet: the character stays up until the person has seen it.
    if (entry.state === 'done') return entry.unread ? 'done' : 'sleep'
    return entry.activity
  }

  function snapshot() {
    // Every known room shows up, even when empty.
    const byRoom = new Map()
    for (const room of rooms.values()) {
      if (!byRoom.has(room.id)) byRoom.set(room.id, { ...room, agents: [] })
    }
    const ordered = [...agents.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)))
    for (const entry of ordered) {
      const workspace = entry.workspaceId ? workspaces.get(entry.workspaceId) : null
      const room = (workspace && rooms.get(workspace.id)) ?? NO_PROJECT_ROOM
      if (!byRoom.has(room.id)) byRoom.set(room.id, { ...room, agents: [] })
      const list = byRoom.get(room.id).agents
      list.push({
        id: entry.id,
        // The conversation title is what tells two agents in the same workspace apart; without
        // it, the folder (the workspace name is usually just the branch).
        name: entry.title || (workspace && basename(workspace.path)) || entry.kind || 'agent',
        folder: workspace ? basename(workspace.path) : null,
        title: entry.title,
        kind: entry.kind,
        workspaceId: entry.workspaceId,
        branch: workspace?.branch ?? null,
        state: entry.state,
        outcome: entry.outcome ?? null,
        activity: displayActivity(entry),
        since: entry.since,
        parentId: null
      })
      for (const sub of entry.subs.values()) {
        list.push({
          id: sub.id,
          name: sub.name,
          title: null,
          kind: entry.kind,
          workspaceId: entry.workspaceId,
          branch: null,
          state: 'working',
          outcome: null,
          activity: sub.activity,
          since: sub.since,
          parentId: entry.id
        })
      }
    }
    const counts = { working: 0, waiting: 0, blocked: 0, done: 0, subs: 0 }
    for (const entry of agents.values()) {
      counts[entry.state] = (counts[entry.state] ?? 0) + 1
      counts.subs += entry.subs.size
    }
    // Occupied rooms first, then by name.
    const list = [...byRoom.values()].sort(
      (a, b) => Number(b.agents.length > 0) - Number(a.agents.length > 0) || String(a.name).localeCompare(String(b.name))
    )
    return { rooms: list, counts, at: now() }
  }

  return {
    setWorkspaces,
    linkTerminals,
    terminalOf,
    status,
    toolBefore,
    toolAfter,
    sync,
    prune,
    configure,
    snapshot
  }
}

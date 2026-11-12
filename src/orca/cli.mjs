// Reads through Orca's CLI what the plugin API does not give: every workspace on every host,
// with its repository and the agents already running. Read only.
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/** Finds the `orca` executable shipped with the app; falls back to the one on PATH. */
export function findCli() {
  const candidates = []
  // The worker runs from inside the app: .../Orca.app/Contents/... -> Contents/Resources/bin/orca
  const marker = `${path.sep}Contents${path.sep}`
  const cut = process.execPath.indexOf(marker)
  if (cut > 0) candidates.push(path.join(process.execPath.slice(0, cut), 'Contents', 'Resources', 'bin', 'orca'))
  candidates.push('/Applications/Orca.app/Contents/Resources/bin/orca')
  candidates.push(path.join(path.dirname(process.execPath), 'resources', 'bin', 'orca'))
  for (const candidate of candidates) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK)
      return candidate
    } catch {
      // try the next one
    }
  }
  return 'orca'
}

/**
 * Terminal handles and environment names come from Orca, some of them from a paired machine.
 * One that starts with a dash would be read by the CLI as an option, so it is refused.
 */
function asArgument(value) {
  const text = String(value ?? '')
  if (!/^[\w.:@/-]+$/.test(text) || text.startsWith('-')) throw new Error('not a valid CLI value')
  return text
}

/** Text from Orca, or null: a field of another type must not reach code that expects text. */
const textOrNull = (value) => (typeof value === 'string' && value !== '' ? value : null)

function run(cli, args, timeout) {
  return new Promise((resolve, reject) => {
    execFile(cli, args, { timeout, maxBuffer: 32 * 1024 * 1024 }, (error, stdout) => {
      let parsed = null
      try {
        parsed = JSON.parse(stdout)
      } catch {
        // output that is not JSON counts as a failure
      }
      if (parsed?.ok) return resolve(parsed.result)
      reject(new Error(parsed?.error?.message ?? error?.message ?? 'invalid response from the Orca CLI'))
    })
  })
}

/** Names of the paired environments (other machines running Orca). */
export async function listEnvironments(cli) {
  const result = await run(cli, ['environment', 'list', '--json'], 8_000)
  // `local` is this machine's own id here; a paired machine of that name would be mistaken for it.
  return (result?.environments ?? [])
    .map((item) => textOrNull(item?.name))
    .filter((name) => name && name !== 'local')
}

/**
 * Which terminal shows which pane, on one host. Tool events name the terminal and the
 * snapshot names the pane; this is what joins them.
 *
 * @returns {Promise<{ terminalId: string, paneKey: string }[]>}
 */
export async function readTerminals(cli, environment = null) {
  const args = ['terminal', 'list', '--json']
  if (environment) args.push('--environment', asArgument(environment))
  const result = await run(cli, args, environment ? 15_000 : 10_000)
  const links = []
  for (const terminal of result?.terminals ?? []) {
    // A pane's key is its tab and leaf, the same form `worktree ps` reports.
    if (!terminal.handle || !terminal.tabId || !terminal.leafId) continue
    links.push({
      terminalId: terminal.handle,
      paneKey: `${terminal.tabId}:${terminal.leafId}`,
      // What is needed to recognise a session Orca lost track of: see untracked-sessions.mjs.
      title: textOrNull(terminal.title),
      lastOutputAt: typeof terminal.lastOutputAt === 'number' ? terminal.lastOutputAt : null,
      worktreePath: textOrNull(terminal.worktreePath)
    })
  }
  return links
}

/**
 * Shows a terminal tab in Orca's window. It changes what is on screen and nothing else: no
 * input is sent to the terminal.
 *
 * @param {string} terminalId the handle `terminal list` reports
 */
export async function switchToTerminal(cli, terminalId, environment = null) {
  const args = ['terminal', 'switch', '--terminal', asArgument(terminalId), '--json']
  if (environment) args.push('--environment', asArgument(environment))
  await run(cli, args, environment ? 15_000 : 10_000)
}

/**
 * Workspaces and agents of one host. A null `environment` is this machine.
 * Returns only the fields the plugin uses.
 */
export async function readHost(cli, environment = null) {
  const args = ['worktree', 'ps', '--json', '--limit', '2000']
  if (environment) args.push('--environment', asArgument(environment))
  const result = await run(cli, args, environment ? 15_000 : 10_000)
  const hostId = environment ?? 'local'
  const rows = []
  for (const row of result?.worktrees ?? []) {
    if (!row.path) continue
    // Local workspaces carry the identity Orca's events use; those on another host do not.
    const key = row.identity?.key
    const id = key ? `identity:${key}` : `${hostId}:${row.worktreeId ?? row.path}`
    rows.push({
      workspaceId: id,
      workspace: {
        id,
        repoId: row.repoId ?? null,
        repoName: textOrNull(row.repo?.displayName) ?? textOrNull(row.repo?.name) ?? textOrNull(row.repo),
        name: textOrNull(row.displayName) ?? '',
        path: String(row.path),
        branch: String(row.branch ?? '').replace(/^refs\/heads\//, '') || null,
        hostId
      },
      agents: (row.agents ?? []).map((agent) => ({
        paneKey: agent.paneKey,
        parentPaneKey: agent.parentPaneKey ?? null,
        state: agent.state,
        agentType: agent.agentType ?? null,
        conversationName: textOrNull(agent.conversationName),
        taskTitle: textOrNull(agent.taskTitle),
        displayName: textOrNull(agent.displayName),
        // Remote agents come without a conversation name; the start of the prompt stands in.
        prompt: String(agent.prompt ?? '').trim().slice(0, 60) || null,
        toolName: agent.toolName ?? null,
        // Orca's bell: the agent finished or needs you, and its terminal was not looked at since.
        unread: agent.activity?.unread === true,
        mainAgent: agent.mainAgent
          ? { state: agent.mainAgent.state ?? null, stateStartedAt: agent.mainAgent.stateStartedAt ?? null }
          : null,
        activityStatus: agent.activity?.status ?? null,
        stateStartedAt: agent.stateStartedAt ?? null,
        hasLivePty: agent.hasLivePty ?? null
      }))
    })
  }
  return { hostId, rows }
}

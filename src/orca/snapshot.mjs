// Keeps the agent store in step with what is actually open in Orca. Events give the immediate
// reaction; this periodic snapshot covers what they cannot: agents that were running before the
// plugin loaded, paired machines, and terminals that were closed.
import * as orcaCli from './cli.mjs'

const LOCAL = 'local'
/**
 * A paired machine that could not be read this many times in a row is taken as offline, and its
 * rooms and agents leave. One failed read is too common (a sleeping laptop, a slow network) to
 * act on.
 */
const FAILED_READS_BEFORE_OFFLINE = 3

/**
 * @param {{
 *   cli: string,
 *   store: { setWorkspaces: (list: any[]) => void, sync: (hostId: string, rows: any[]) => void,
 *     linkTerminals: (links: { terminalId: string, paneKey: string }[]) => void },
 *   listLocalWorkspaces: () => Promise<any[] | null>,
 *   log: (message: string) => void,
 *   reader?: Pick<typeof orcaCli, 'listEnvironments' | 'readHost' | 'readTerminals'>
 * }} dependencies `reader` is what reads Orca; tests replace it
 */
export function createSnapshotSync({ cli, store, listLocalWorkspaces, log, reader = orcaCli }) {
  const { listEnvironments, readHost, readTerminals } = reader
  /** @type {Map<string, any[]>} rows by host id */
  const rowsByHost = new Map()
  /** @type {Map<string, { terminalId: string, paneKey: string }[]>} terminal links by host id */
  const terminalsByHost = new Map()
  /** @type {Map<string, number>} failed reads in a row, by host label */
  const failedReads = new Map()
  let running = null
  let runningIncludesRemote = false

  /** Keeps the host known with nothing in it, so the store is told its agents are gone. */
  function markOffline(hostId) {
    if (!rowsByHost.has(hostId)) return
    rowsByHost.set(hostId, [])
    terminalsByHost.delete(hostId)
  }

  async function readOne(environment) {
    const label = environment ?? LOCAL
    try {
      const [host, terminals] = await Promise.all([
        readHost(cli, environment),
        // The links are an improvement, not a requirement: without them events still arrive.
        readTerminals(cli, environment).catch(() => [])
      ])
      rowsByHost.set(host.hostId, host.rows)
      terminalsByHost.set(host.hostId, terminals)
      failedReads.delete(label)
    } catch (error) {
      const failures = (failedReads.get(label) ?? 0) + 1
      failedReads.set(label, failures)
      // A host that is down must not flood the log on every round: report it once.
      if (failures === 1) log(`snapshot of ${label}: ${error?.message ?? error}`)
      if (environment !== null && failures >= FAILED_READS_BEFORE_OFFLINE) markOffline(label)
    }
  }

  async function readRemoteHosts() {
    let environments
    try {
      environments = await listEnvironments(cli)
    } catch (error) {
      log(`environment list: ${error?.message ?? error}`)
      return
    }
    // A machine that is no longer paired is gone at once.
    for (const hostId of rowsByHost.keys()) {
      if (hostId !== LOCAL && !environments.includes(hostId)) markOffline(hostId)
    }
    await Promise.all(environments.map((name) => readOne(name)))
  }

  async function applyToStore() {
    if (rowsByHost.size > 0) {
      store.setWorkspaces([...rowsByHost.values()].flatMap((rows) => rows.map((row) => row.workspace)))
      for (const links of terminalsByHost.values()) store.linkTerminals(links)
      for (const [hostId, rows] of rowsByHost) store.sync(hostId, rows)
      return
    }
    // Without the CLI, fall back to what the plugin API gives: the local workspaces.
    const workspaces = await listLocalWorkspaces()
    if (workspaces) store.setWorkspaces(workspaces)
  }

  /**
   * Reads this machine and, when `remote` is set, the paired ones. Calls made while a snapshot
   * is already running share its result, unless they ask for the paired machines and the
   * running one leaves them out: then a full one follows it.
   */
  function sync({ remote = true } = {}) {
    if (running && remote && !runningIncludesRemote) return running.then(() => sync({ remote }))
    if (running) return running
    runningIncludesRemote = remote
    running = (async () => {
      await readOne(null)
      if (remote) await readRemoteHosts()
      await applyToStore()
    })().finally(() => {
      running = null
    })
    return running
  }

  return {
    sync,
    /** False while the CLI has produced nothing, and the store only knows what events told it. */
    hasData: () => rowsByHost.size > 0
  }
}

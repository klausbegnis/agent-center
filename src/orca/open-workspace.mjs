// What "Open workspace" does: shows the terminal tab the agent runs in, which also brings its
// workspace to the front, so the person lands on the conversation itself. Without a known
// terminal it opens the workspace alone.
import { switchToTerminal } from './cli.mjs'

const LOCAL = 'local'

/**
 * @param {{
 *   orca: { host: { call: (name: string, input?: object) => Promise<unknown> } },
 *   cli: string,
 *   store: { terminalOf: (agentId: string) => { terminalId: string, hostId: string | null } | null },
 *   log: (message: string) => void,
 *   switchTo?: typeof switchToTerminal
 * }} dependencies `switchTo` is what talks to Orca; tests replace it
 * @returns {(workspaceId: string, agentId: string | null) => Promise<void>}
 */
export function createOpenWorkspace({ orca, cli, store, log, switchTo = switchToTerminal }) {
  async function showTerminal(agentId) {
    const terminal = agentId ? store.terminalOf(agentId) : null
    if (!terminal) return false
    const environment = terminal.hostId && terminal.hostId !== LOCAL ? terminal.hostId : null
    try {
      await switchTo(cli, terminal.terminalId, environment)
      return true
    } catch (error) {
      log(`terminal switch: ${error?.message ?? error}`)
      return false
    }
  }

  return async function openWorkspace(workspaceId, agentId) {
    if (await showTerminal(agentId)) return
    try {
      // Orca does not know every workspace by the id the snapshot gives it (a paired machine's,
      // for one), so this can be refused; that must not surface as an error in the panel.
      await orca.host.call('workspace.open', { workspaceId })
    } catch (error) {
      log(`workspace.open: ${error?.message ?? error}`)
    }
  }
}

// Plugin entry point. It only wires the parts together: what each part does lives in its own
// module. Plain JavaScript (.mjs) so Orca loads it without transpiling.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createController } from './controller.mjs'
import { createAgentStore } from './domain/agent-store.mjs'
import { loadGameEngine } from './game-files.mjs'
import { createGameMode, createUnavailableGame } from './game-mode.mjs'
import { createGameSave } from './game-save.mjs'
import { SAVE_VERSION, migrate } from './game/worlds.mjs'
import { findCli } from './orca/cli.mjs'
import { createOpenWorkspace } from './orca/open-workspace.mjs'
import { registerPanelHandlers } from './orca/panel-handlers.mjs'
import { historyAccess, readListedWorkspaces, readSessionHistory } from './orca/session-history.mjs'
import { createSnapshotSync } from './orca/snapshot.mjs'
import { summarize } from './orca/status-bar.mjs'
import { createPreferences } from './preferences.mjs'
import { startServer } from './server/http-server.mjs'
import { createBatcher } from './support/batch.mjs'
import { createSafe } from './support/safe.mjs'
import { listThemes } from './themes.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Posts to panels are rate limited (200 per 10 s), so changes go out in bursts. */
const PUBLISH_DELAY_MS = 250
const SNAPSHOT_INTERVAL_MS = 15_000
/** A paired machine that could not be read is tried again once every this many snapshots. */
const UNREACHABLE_RETRY_EVERY = 4
const DEFAULT_PORT = 47600
const DEFAULT_SLEEP_MINUTES = 30
const STATUS_BAR_ITEM = 'summary'
/**
 * How often the game reads the session history. Twice the snapshot interval: tokens add up over
 * minutes, and reading the history is more work for Orca than listing terminals.
 */
const GAME_ROUND_MS = 30_000

let server = null
let snapshotTimer = null
let gameTimer = null
let game = null
let cancelPublish = () => {}
/** Set when the plugin is unloaded, so an activation still under way stops starting things. */
let disposed = false

export default async function activate(orca) {
  disposed = false
  const log = (message) => orca.log(message)
  const safe = createSafe(log)
  const settings = (await safe('settings.get', () => orca.settings.get(), {})) ?? {}

  const store = createAgentStore()
  const sleepMinutes = Number(settings.sleepMinutes)
  store.configure({ sleepMs: (sleepMinutes > 0 ? sleepMinutes : DEFAULT_SLEEP_MINUTES) * 60_000 })

  const preferences = createPreferences({
    storage: orca.storage,
    listThemeIds: () => listThemes(ROOT).map((theme) => theme.id),
    safe
  })
  await preferences.load()

  const cli = findCli()
  const snapshotSync = createSnapshotSync({
    cli,
    store,
    listLocalWorkspaces: async () =>
      (await safe('workspace.list', () => orca.host.call('workspace.list'), null))?.workspaces ?? null,
    log
  })

  const publish = createBatcher(PUBLISH_DELAY_MS, () => {
    const state = controller.getState()
    safe('panels.post', () => orca.panels.post('state.changed', state))
    server?.broadcast(state)
    safe('statusBar.update', () =>
      orca.host.call('statusBar.update', { id: STATUS_BAR_ITEM, ...summarize(state.counts) })
    )
  }, log)
  cancelPublish = publish.cancel

  const engine = loadGameEngine(ROOT, log)
  game = engine
    ? createGameMode({
      engine,
      gameSave: createGameSave({ storage: orca.storage, migrate, saveVersion: SAVE_VERSION, log }),
      readSettings: () => safe('settings.get', () => orca.settings.get(), {}),
      // Not through safe(): a setting that was not written must reach the person as a failure.
      writeSetting: (key, value) => orca.host.call('settings.set', { key, value }),
      access: () => historyAccess(orca),
      readHistory: () => readSessionHistory(orca),
      readWorkspaces: () => readListedWorkspaces(orca),
      // Without session totals from Orca, the game estimates tokens from these.
      readWorkMeters: () => store.workMeters(),
      store,
      preferences,
      // The themes the surfaces draw, which a travelling room moves through.
      listThemeIds: () => listThemes(ROOT).map((theme) => theme.id),
      log,
      onChange: () => publish()
    })
    : createUnavailableGame('unsupported')

  const controller = createController({
    store,
    preferences,
    snapshotSync,
    listThemes: () => listThemes(ROOT),
    externalView: () => server,
    openWorkspace: createOpenWorkspace({ orca, cli, store, log }),
    game,
    onChange: publish
  })

  /**
   * Reads Orca again and publishes. Nothing waits for it, so a failure is logged here: left
   * alone it would be an unhandled rejection, which ends the worker.
   */
  const refresh = (options) =>
    snapshotSync
      .sync(options)
      .then(publish)
      .catch((error) => log(`snapshot: ${error?.message ?? error}`))

  // Events and hooks. The hooks only observe: they return nothing, so Orca carries on at once.
  orca.events.on('agent.status.changed', (event) => {
    store.status(event)
    publish()
    // Whether the person saw it finish is only in the snapshot, so read it without waiting
    // for the next round.
    if (event.state === 'done') refresh({ remote: false })
  })
  const onWorkspacesChanged = () => refresh({ remote: false })
  orca.events.on('workspace.created', onWorkspacesChanged)
  orca.events.on('workspace.removed', onWorkspacesChanged)
  // Said once per worker, so the log shows whether tool hooks reach the plugin at all: without
  // them every agent's activity is only what the snapshots show.
  let hasSeenToolHook = false
  orca.hooks.on('agent.tool.before', (event) => {
    store.toolBefore(event)
    publish()
    if (hasSeenToolHook) return
    hasSeenToolHook = true
    log('tool hooks: the first tool call arrived')
  })
  orca.hooks.on('agent.tool.after', (event) => {
    store.toolAfter(event)
    publish()
  })

  registerPanelHandlers(orca, controller)

  orca.commands.register('agentCenter.toggle', async () => {
    await safe('commands.run', () => orca.host.call('commands.run', { action: 'sidebar.right.toggle' }))
    return 'Agent Center'
  })
  orca.commands.register('agentCenter.url', () =>
    server ? `Agent Center external view: ${server.url}` : 'The external view is turned off (port 0).'
  )

  const port = Number(settings.port ?? DEFAULT_PORT)
  if (port > 0) {
    server = await safe(
      'external view',
      () => startServer({ root: ROOT, port, lan: settings.lan === true, controller, log }),
      null
    )
    if (server) log(`external view at ${server.url}`)
  }
  // Unloaded while the server was starting: close what was started and stop here.
  if (disposed) return closeServer()

  let round = 0
  snapshotTimer = setInterval(() => {
    round += 1
    // With the CLI snapshot an agent leaves when its terminal closes; the time limit then only
    // applies to agents on no known host, which no snapshot covers.
    if (store.prune({ everyHost: !snapshotSync.hasData() })) publish()
    // No events come from paired machines, so they are read every round too; one that is down
    // is only tried again every few rounds.
    refresh({ remote: true, onlyReachable: round % UNREACHABLE_RETRY_EVERY !== 0 })
  }, SNAPSHOT_INTERVAL_MS)
  snapshotTimer.unref?.()
  // The game reads its setting every round, so turning it on or off needs no restart.
  gameTimer = setInterval(() => game.round(), GAME_ROUND_MS)
  gameTimer.unref?.()

  await refresh()
  if (disposed) return
  publish()
  game.round()
}

async function closeServer() {
  const closing = server
  server = null
  await closing?.close()
}

export async function deactivate() {
  disposed = true
  cancelPublish()
  if (snapshotTimer) clearInterval(snapshotTimer)
  snapshotTimer = null
  if (gameTimer) clearInterval(gameTimer)
  gameTimer = null
  await game?.flush()
  game = null
  await closeServer()
}

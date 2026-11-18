// Shows the external view with fake agents, no Orca needed. Useful for drawing and testing
// themes and for taking screenshots: run `node scripts/demo.mjs` and open the address it prints.
//
//   node scripts/demo.mjs              rooms on a mix of themes, side by side
//   node scripts/demo.mjs <theme-id>   every room on that theme: use it while drawing a theme
//   node scripts/demo.mjs random       each room gets a theme chosen for it
//   node scripts/demo.mjs _template    the theme template, which no picker offers otherwise
//   PORT=47700    port to serve on
//   FREEZE=1      keep the scene still instead of looping the script
//   GAME=1        turn game mode on, with a made-up stream of tokens (see demo-game.mjs); with
//                 FREEZE=1 the game is a fixed save after a day of play
//   GAME=estimated  the same through the token estimate, as on an Orca without session totals
//   TRAVEL=1      with GAME, turn on "new scene after each monster": every room without a theme
//                 of its own (all of them with `random` or a theme id) moves on to another
//                 theme each time its monster dies
//   SETTLEMENT=n  with GAME, the world's settlement at stage n (1 Camp to 7 Citadel); the frozen
//                 game shows a Village otherwise
//   INSTANCE_VAULT=1  with GAME, a room waits in the Sunken Crypt's vault at tier 2, so the boon
//                 choice, the route's picture and a tier's modifier can be seen (the frozen game
//                 shows the roadmap with one instance cleared and a room facing a boss otherwise)
//   EVENT=<id>    with GAME, play that weekly event of game/events.json every week, to review its
//                 banner and marker (the calendar's event of the week otherwise)
//   CITY_RANK=n  with GAME, every city of the market at rank n (1 to 5); the frozen game shows
//                 cities at mixed ranks otherwise
//   INSTANCE_ROAD=cleared  with GAME, the first region cleared, with rematch tier badges on its
//                 sites and a rematch ready, and the second region unlocked; INSTANCE_ROAD=isles
//                 goes on into the second region (four of eight cleared). Without it the frozen
//                 game shows the second region locked
//   QUESTS=done  with GAME, the day's daily quests all done (the frozen game shows them part done
//                 otherwise)
//   LAN=1         open the demo to the local network, as the "Open to the local network" setting
//                 does: open it from another machine, or from this one by its network address, to
//                 see the game as view only
//
// Add ?emotes=fast to the address to see a theme's emotes every few seconds instead of waiting
// for them; the demo prints that address too. The monster contact sheet (every race, rank and
// boss) is served on the next port at /monsters.html; see scripts/monster-sheet.mjs.
//
// Every project, host and conversation name here is made up.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createController } from '../src/controller.mjs'
import { createAgentStore } from '../src/domain/agent-store.mjs'
import { loadGameEngine } from '../src/game-files.mjs'
import { createUnavailableGame } from '../src/game-mode.mjs'
import { RANDOM_THEME } from '../src/preferences.mjs'
import { startServer } from '../src/server/http-server.mjs'
import { listThemes, TEMPLATE_THEME } from '../src/themes.mjs'
import { createDemoGame } from './demo-game.mjs'
import { levelsForStage } from './demo-settlement.mjs'
import { startMonsterSheet } from './monster-sheet.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
/** The parsed game/settlement.json, for SETTLEMENT=n. */
const settlementContent = () => JSON.parse(readFileSync(path.join(ROOT, 'game', 'settlement.json'), 'utf8'))
const store = createAgentStore()
const requestedTheme = process.argv[2]
let theme = requestedTheme ?? 'pixel-dark'
let hidden = []

// project -> host, folder, and the worktrees inside it
const PROJECTS = [
  { name: 'rumble-banana', host: 'local', root: '/work/rumble-banana', trees: ['checkout-rounding', 'search-filters', 'cart-drawer'] },
  { name: 'turbo-waffle', host: 'build-box', root: '/srv/turbo-waffle', trees: ['webhook-retries', 'ledger-export'] },
  { name: 'cosmic-llama', host: 'local', root: '/work/cosmic-llama', trees: ['onboarding-v2', 'push-settings'] },
  { name: 'quantum-pickle', host: 'gpu-rig', root: '/data/quantum-pickle', trees: ['nightly-backfill'] },
  { name: 'sneaky-pancake', host: 'local', root: '/work/sneaky-pancake', trees: ['api-reference'] },
  { name: 'fuzzy-anvil', host: 'build-box', root: '/srv/fuzzy-anvil', trees: [] }
]

const workspaces = []
for (const project of PROJECTS) {
  workspaces.push({ id: `${project.name}/main`, repoId: project.name, name: 'main', path: project.root, branch: 'main', hostId: project.host })
  for (const tree of project.trees) {
    workspaces.push({
      id: `${project.name}/${tree}`,
      repoId: project.name,
      name: tree,
      path: `${project.root}-worktrees/${tree}`,
      branch: tree,
      hostId: project.host
    })
  }
}
store.setWorkspaces(workspaces)

// The template is hidden from the pickers; it is listed here only when it was asked for by id.
const demoThemes = () => listThemes(ROOT, { includeTemplate: requestedTheme === TEMPLATE_THEME })
const themeIds = demoThemes().map((listed) => listed.id)
if (theme !== RANDOM_THEME && !themeIds.includes(theme)) {
  console.error(`There is no theme "${theme}". Use one of: ${[...themeIds, RANDOM_THEME].join(', ')}`)
  process.exit(1)
}

// With no theme asked for, each project picks one, to show rooms on different themes side by
// side. A theme named on the command line is shown in every room, so no room picks its own.
let roomThemes = requestedTheme ? {} : {
  'local:/work/rumble-banana': 'pixel-dark',
  'build-box:/srv/turbo-waffle': 'gothic-dungeon',
  'local:/work/cosmic-llama': 'guild-hall',
  'gpu-rig:/data/quantum-pickle': 'gothic-dungeon',
  'local:/work/sneaky-pancake': 'guild-hall',
  'build-box:/srv/fuzzy-anvil': 'pixel-dark'
}

let pane = 0
/** `unseen` is for an agent that finished and was not looked at yet (Orca's bell). */
function agent(workspaceId, kind, title, state = 'working', unseen = false) {
  const ref = { workspaceId, paneKey: `pane-${++pane}`, terminalId: `term-${pane}`, agent: kind }
  store.status({ ...ref, title, state, unread: unseen })
  return ref
}
let call = 0
const tool = (ref, name, input = {}) => {
  const callId = `call-${++call}`
  store.toolBefore({ ...ref, tool: name, input, callId })
  return callId
}

// rumble-banana: busy
const checkout = agent('rumble-banana/checkout-rounding', 'claude', 'Fix checkout rounding')
const search = agent('rumble-banana/search-filters', 'codex', 'Search filters')
agent('rumble-banana/cart-drawer', 'claude', 'Cart drawer polish', 'waiting')
agent('rumble-banana/main', 'claude', 'Release notes', 'done')
tool(checkout, 'Edit')
tool(search, 'Bash')

// A tool call goes to the agent's most recent subagent, so each subagent is given its tool
// right after it starts.
function subagent(ref, name, toolName) {
  const callId = tool(ref, 'Agent', { subagent_type: name })
  if (toolName) tool(ref, toolName)
  return callId
}

// turbo-waffle: one blocked, one delegating to three subagents that each do something else
const webhooks = agent('turbo-waffle/webhook-retries', 'claude', 'Webhook retries')
agent('turbo-waffle/ledger-export', 'codex', 'Ledger export', 'blocked')
agent('turbo-waffle/main', 'claude', 'Audit log review', 'done')
subagent(webhooks, 'Explore', 'Grep')
subagent(webhooks, 'test-runner', 'Bash')
subagent(webhooks, 'code-review', 'Edit')

// cosmic-llama: one delegating to a single subagent
const onboarding = agent('cosmic-llama/onboarding-v2', 'claude', 'Onboarding v2')
const push = agent('cosmic-llama/push-settings', 'gemini', 'Push settings')
agent('cosmic-llama/main', 'codex', 'Crash triage', 'waiting')
tool(push, 'Edit')
subagent(onboarding, 'Explore', 'Read')

// quantum-pickle, on a paired machine: its subagents come the way a newer Orca's snapshot lists
// them, on their agent (`subagents`), not from tool hooks.
const backfill = agent('quantum-pickle/nightly-backfill', 'codex', 'Nightly backfill')
const migration = agent('quantum-pickle/main', 'claude', 'Schema migration', 'done')
tool(backfill, 'Bash')
store.sync('gpu-rig', [
  { workspaceId: 'quantum-pickle/nightly-backfill', agents: [{
    paneKey: backfill.paneKey, parentPaneKey: null, state: 'working', agentType: 'codex', hasLivePty: true,
    subagents: [{ id: 'demo-sub-1', state: 'working', startedAt: Date.now(), description: 'Check the partitions' }]
  }] },
  { workspaceId: 'quantum-pickle/main', agents: [{ paneKey: migration.paneKey, parentPaneKey: null, state: 'done', hasLivePty: true }] }
])

// sneaky-pancake
const reference = agent('sneaky-pancake/api-reference', 'claude', 'API reference')
agent('sneaky-pancake/main', 'codex', 'Link checker', 'done', true)
tool(reference, 'Edit')

// fuzzy-anvil stays empty, to show a quiet room.

// The demo keeps preferences in memory and has no Orca to read, so it supplies stand-ins for
// the parts the real worker gets from the host.
const preferences = {
  snapshot: () => ({ theme, roomThemes, hidden }),
  setTheme: async (id) => {
    theme = id
  },
  setRoomTheme: async (id, value) => {
    roomThemes = { ...roomThemes }
    if (value) roomThemes[id] = value
    else delete roomThemes[id]
  },
  setRoomHidden: async (id, value) => {
    hidden = value ? [...new Set([...hidden, id])] : hidden.filter((item) => item !== id)
  }
}

let server = null
let controller = null
const publish = () => {
  if (controller) server?.broadcast(controller.getState())
}
const engine = process.env.GAME ? loadGameEngine(ROOT, console.error, { pinnedEvent: process.env.EVENT }) : null
const game = engine
  ? await createDemoGame({
    engine,
    store,
    preferences,
    onChange: publish,
    frozen: Boolean(process.env.FREEZE),
    estimated: process.env.GAME === 'estimated',
    travel: Boolean(process.env.TRAVEL),
    listThemeIds: () => demoThemes().map((listed) => listed.id),
    // SETTLEMENT=n shows the settlement at stage n (1 to 7), to review its picture.
    settlementLevels: process.env.SETTLEMENT ? levelsForStage(Number(process.env.SETTLEMENT), settlementContent()) : null,
    // INSTANCE_VAULT=1 puts a room in the Sunken Crypt's vault, to see the boon choice.
    instanceVault: process.env.INSTANCE_VAULT === '1',
    // CITY_RANK=n puts every city at rank n (1 to 5), to review its banner and rank card.
    cityRank: process.env.CITY_RANK ? Number(process.env.CITY_RANK) : null,
    // INSTANCE_ROAD=cleared or isles moves the road further on (demo-regions.mjs).
    instanceRoad: process.env.INSTANCE_ROAD ?? null,
    // QUESTS=done shows the day's quests all done, the bonus paid and a streak.
    questsDone: process.env.QUESTS === 'done'
  })
  : createUnavailableGame('off')
controller = createController({
  store,
  preferences,
  snapshotSync: { sync: async () => {} },
  listThemes: demoThemes,
  externalView: () => server,
  openWorkspace: async () => {},
  game,
  onChange: publish
})

server = await startServer({ root: ROOT, port: Number(process.env.PORT ?? 47700), lan: process.env.LAN === '1', controller })
if (!server) {
  console.error('Agent Center (demo): no free port. Pick another one with PORT=…')
  process.exit(1)
}
console.log(`Agent Center (demo): ${server.url}`)
console.log(`  with emotes every few seconds: ${server.url}?emotes=fast`)
// The monster contact sheet, for reviewing the monster art, on the next port.
const sheet = await startMonsterSheet({ root: ROOT, port: server.port + 1 })
if (sheet) console.log(`  monster contact sheet: ${sheet.url}`)

if (!process.env.FREEZE) {
  // A looping script: agents change tools, delegate and finish, so the rooms keep moving.
  // "Webhook retries" stops to ask something and carries on, so its subagents follow it across
  // the room. "Push settings" finishes at the end of each round, which sets off the emote of an
  // agent that is done, and starts over in the next.
  let reviewer = null
  const script = [
    () => tool(checkout, 'Agent', { subagent_type: 'code-review' }),
    () => tool(search, 'Read'),
    () => store.status({ ...webhooks, state: 'waiting' }),
    () => tool(backfill, 'Read'),
    () => (reviewer = subagent(reference, 'Explore', 'Read')),
    () => {
      store.status({ ...push, state: 'working' })
      tool(push, 'Bash')
    },
    () => store.toolAfter({ ...checkout, tool: 'Agent', input: {} }),
    () => store.status({ ...webhooks, state: 'working' }),
    () => tool(checkout, 'Bash'),
    () => store.toolAfter({ ...reference, tool: 'Agent', input: {}, callId: reviewer }),
    () => tool(search, 'Edit'),
    () => tool(backfill, 'Bash'),
    () => tool(checkout, 'Edit'),
    () => store.status({ ...push, state: 'done' })
  ]
  let step = 0
  setInterval(() => {
    script[step++ % script.length]()
    publish()
  }, 3000)
}

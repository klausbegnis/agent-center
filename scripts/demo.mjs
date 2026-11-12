// Shows the external view with fake agents, no Orca needed. Useful for drawing and testing
// themes and for taking screenshots: run `node scripts/demo.mjs` and open the address it prints.
//
//   node scripts/demo.mjs              rooms on a mix of themes, side by side
//   node scripts/demo.mjs <theme-id>   every room on that theme: use it while drawing a theme
//   node scripts/demo.mjs random       each room gets a theme chosen for it
//   node scripts/demo.mjs _template    the theme template, which no picker offers otherwise
//   PORT=47700    port to serve on
//   FREEZE=1      keep the scene still instead of looping the script
//
// Add ?emotes=fast to the address to see a theme's emotes every few seconds instead of waiting
// for them; the demo prints that address too.
//
// Every project, host and conversation name here is made up.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createController } from '../src/controller.mjs'
import { createAgentStore } from '../src/domain/agent-store.mjs'
import { RANDOM_THEME } from '../src/preferences.mjs'
import { startServer } from '../src/server/http-server.mjs'
import { listThemes, TEMPLATE_THEME } from '../src/themes.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
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

// quantum-pickle
const backfill = agent('quantum-pickle/nightly-backfill', 'codex', 'Nightly backfill')
agent('quantum-pickle/main', 'claude', 'Schema migration', 'done')
tool(backfill, 'Bash')

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
const publish = () => server?.broadcast(controller.getState())
const controller = createController({
  store,
  preferences,
  snapshotSync: { sync: async () => {} },
  listThemes: demoThemes,
  externalView: () => server,
  openWorkspace: async () => {},
  onChange: publish
})

server = await startServer({ root: ROOT, port: Number(process.env.PORT ?? 47700), lan: false, controller })
console.log(`Agent Center (demo): ${server.url}`)
console.log(`  with emotes every few seconds: ${server.url}?emotes=fast`)

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

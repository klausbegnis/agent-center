import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createOpenWorkspace } from './open-workspace.mjs'

function setup(terminal, switchTo = async (...input) => input) {
  const calls = []
  const openWorkspace = createOpenWorkspace({
    orca: { host: { call: async (name, input) => calls.push([name, input.workspaceId]) } },
    cli: 'orca',
    store: { terminalOf: () => terminal },
    log: (message) => calls.push(['log', message]),
    switchTo: async (cli, terminalId, environment) => {
      calls.push(['switch', terminalId, environment])
      return switchTo()
    }
  })
  return { openWorkspace, calls }
}

test('it shows the terminal of the agent, which is enough to open its workspace', async () => {
  const { openWorkspace, calls } = setup({ terminalId: 'term-1', hostId: 'local' })
  await openWorkspace('rumble-banana/main', 'pane-1')
  assert.deepEqual(calls, [['switch', 'term-1', null]])
})

test('a terminal on a paired machine is shown through that machine', async () => {
  const { openWorkspace, calls } = setup({ terminalId: 'term-2', hostId: 'build-box' })
  await openWorkspace('turbo-waffle/main', 'pane-2')
  assert.deepEqual(calls, [['switch', 'term-2', 'build-box']])
})

test('without a known terminal, or without an agent, the workspace is opened', async () => {
  const unknown = setup(null)
  await unknown.openWorkspace('rumble-banana/main', 'pane-1')
  assert.deepEqual(unknown.calls, [['workspace.open', 'rumble-banana/main']])

  const noAgent = setup({ terminalId: 'term-1', hostId: 'local' })
  await noAgent.openWorkspace('rumble-banana/main', null)
  assert.deepEqual(noAgent.calls, [['workspace.open', 'rumble-banana/main']])
})

test('a failed switch is logged and falls back to opening the workspace', async () => {
  const { openWorkspace, calls } = setup({ terminalId: 'term-1', hostId: 'local' }, async () => {
    throw new Error('no such terminal')
  })
  await openWorkspace('rumble-banana/main', 'pane-1')
  assert.deepEqual(calls.slice(1), [
    ['log', 'terminal switch: no such terminal'],
    ['workspace.open', 'rumble-banana/main']
  ])
})

test('a workspace Orca refuses to open is logged, not thrown', async () => {
  const calls = []
  const openWorkspace = createOpenWorkspace({
    orca: {
      host: {
        call: async () => {
          throw new Error('selector_not_found')
        }
      }
    },
    cli: 'orca',
    store: { terminalOf: () => null },
    log: (message) => calls.push(message)
  })
  await openWorkspace('made-up', 'pane-1')
  assert.deepEqual(calls, ['workspace.open: selector_not_found'])
})

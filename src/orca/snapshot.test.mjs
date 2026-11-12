import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSnapshotSync } from './snapshot.mjs'

const row = (hostId, name) => ({ workspace: { id: `${hostId}/${name}`, hostId }, agents: [] })

/** A stand-in for Orca: `hosts` maps a host id to its rows, or to an Error to fail the read. */
function setup(hosts, environments) {
  const synced = []
  const calls = []
  const store = {
    setWorkspaces: () => {},
    linkTerminals: () => {},
    sync: (hostId, rows) => synced.push([hostId, rows.length])
  }
  const reader = {
    listEnvironments: async () => {
      if (environments.value instanceof Error) throw environments.value
      return environments.value
    },
    readHost: async (cli, environment) => {
      const hostId = environment ?? 'local'
      calls.push(hostId)
      if (hosts[hostId] instanceof Error) throw hosts[hostId]
      return { hostId, rows: hosts[hostId] }
    },
    readTerminals: async () => []
  }
  const snapshotSync = createSnapshotSync({
    cli: 'orca',
    store,
    listLocalWorkspaces: async () => null,
    log: () => {},
    reader
  })
  const lastSync = () => Object.fromEntries(synced.splice(0))
  return { snapshotSync, lastSync, calls }
}

test('a paired machine keeps its rooms through two failed reads and loses them on the third', async () => {
  const hosts = { local: [row('local', 'a')], 'build-box': [row('build-box', 'b')] }
  const { snapshotSync, lastSync } = setup(hosts, { value: ['build-box'] })
  await snapshotSync.sync()
  assert.deepEqual(lastSync(), { local: 1, 'build-box': 1 })

  hosts['build-box'] = new Error('unreachable')
  await snapshotSync.sync()
  await snapshotSync.sync()
  assert.deepEqual(lastSync(), { local: 1, 'build-box': 1 })
  await snapshotSync.sync()
  assert.deepEqual(lastSync(), { local: 1, 'build-box': 0 })

  hosts['build-box'] = [row('build-box', 'b')]
  await snapshotSync.sync()
  assert.deepEqual(lastSync(), { local: 1, 'build-box': 1 })
})

test('a machine that is no longer paired loses its rooms at once', async () => {
  const hosts = { local: [row('local', 'a')], 'gpu-rig': [row('gpu-rig', 'c')] }
  const environments = { value: ['gpu-rig'] }
  const { snapshotSync, lastSync } = setup(hosts, environments)
  await snapshotSync.sync()
  environments.value = []
  await snapshotSync.sync()
  assert.deepEqual(lastSync(), { local: 1, 'gpu-rig': 0 })
})

test('a failed environment list leaves paired machines as they were', async () => {
  const hosts = { local: [row('local', 'a')], 'gpu-rig': [row('gpu-rig', 'c')] }
  const environments = { value: ['gpu-rig'] }
  const { snapshotSync, lastSync } = setup(hosts, environments)
  await snapshotSync.sync()
  environments.value = new Error('cli failed')
  await snapshotSync.sync()
  assert.deepEqual(lastSync(), { local: 1, 'gpu-rig': 1 })
})

test('the local machine is never taken as offline', async () => {
  const hosts = { local: [row('local', 'a')] }
  const { snapshotSync, lastSync } = setup(hosts, { value: [] })
  await snapshotSync.sync()
  hosts.local = new Error('cli failed')
  for (let round = 0; round < 5; round++) await snapshotSync.sync()
  assert.deepEqual(lastSync(), { local: 1 })
})

test('a full snapshot asked for during a local one still reads the paired machines', async () => {
  const hosts = { local: [row('local', 'a')], 'build-box': [row('build-box', 'b')] }
  const { snapshotSync, calls } = setup(hosts, { value: ['build-box'] })
  await Promise.all([snapshotSync.sync({ remote: false }), snapshotSync.sync()])
  assert.deepEqual(calls, ['local', 'local', 'build-box'])
})

test('a round for reachable machines skips one whose last read failed, and a full round retries it', async () => {
  const hosts = { local: [row('local', 'a')], 'build-box': new Error('unreachable'), 'gpu-rig': [row('gpu-rig', 'c')] }
  const { snapshotSync, calls } = setup(hosts, { value: ['build-box', 'gpu-rig'] })
  await snapshotSync.sync()
  calls.length = 0
  await snapshotSync.sync({ remote: true, onlyReachable: true })
  assert.deepEqual(calls, ['local', 'gpu-rig'])
  calls.length = 0
  await snapshotSync.sync()
  assert.deepEqual(calls.sort(), ['build-box', 'gpu-rig', 'local'])
})

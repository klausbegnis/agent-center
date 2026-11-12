import { test } from 'node:test'
import assert from 'node:assert/strict'
import { basename, groupRooms } from './rooms.mjs'

const roomNames = (workspaces) => {
  const rooms = groupRooms(workspaces)
  return Object.fromEntries(workspaces.map((workspace) => [workspace.id, rooms.get(workspace.id).name]))
}

test('basename takes the last folder of a path, with either separator', () => {
  assert.equal(basename('/work/storefront/'), 'storefront')
  assert.equal(basename('C:\\work\\storefront'), 'storefront')
  assert.equal(basename(''), '')
})

test('a workspace inside another one joins the outer room', () => {
  assert.deepEqual(
    roomNames([
      { id: 'umbrella', path: '/work/base', hostId: 'local' },
      { id: 'inner', path: '/work/base/api', hostId: 'local' }
    ]),
    { umbrella: 'base', inner: 'base' }
  )
})

test('worktrees of one repository share a room wherever they live', () => {
  assert.deepEqual(
    roomNames([
      { id: 'main', repoId: 'r1', path: '/work/kitchen', hostId: 'local' },
      { id: 'tree', repoId: 'r1', path: '/elsewhere/worktrees/task', hostId: 'local' }
    ]),
    { main: 'kitchen', tree: 'kitchen' }
  )
})

test('a folder whose name merely starts the same is a different room', () => {
  assert.deepEqual(
    roomNames([
      { id: 'a', path: '/work/base', hostId: 'local' },
      { id: 'b', path: '/work/basement', hostId: 'local' }
    ]),
    { a: 'base', b: 'basement' }
  )
})

test('the same path on two hosts gives two rooms', () => {
  const rooms = groupRooms([
    { id: 'here', path: '/work/base', hostId: 'local' },
    { id: 'there', path: '/work/base', hostId: 'build-box' }
  ])
  assert.notEqual(rooms.get('here').id, rooms.get('there').id)
  assert.equal(rooms.get('there').host, 'build-box')
})

test('the repository name, when known, names the room', () => {
  assert.deepEqual(roomNames([{ id: 'a', path: '/srv/checkout/workspace', repoName: 'storefront', hostId: 'local' }]), {
    a: 'storefront'
  })
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isAllowedHost, isSameOrigin, pathnameOf } from './request-guard.mjs'

test('pathnameOf decodes a path and drops the query', () => {
  assert.equal(pathnameOf('/themes/pixel-dark/room.svg?v=2'), '/themes/pixel-dark/room.svg')
  assert.equal(pathnameOf('/ui/a%20b.js'), '/ui/a b.js')
  assert.equal(pathnameOf(undefined), '/')
})

test('pathnameOf returns null for a target that cannot be parsed', () => {
  assert.equal(pathnameOf('/%E0%A4%A'), null)
  assert.equal(pathnameOf('//'), null)
})

test('pathnameOf refuses a path with an encoded NUL character', () => {
  assert.equal(pathnameOf('/ui/%00'), null)
  assert.equal(pathnameOf('/themes/pixel-dark/room.svg%00.png'), null)
})

test('a loopback Host is allowed with any port', () => {
  for (const host of ['127.0.0.1:47600', 'localhost:47600', 'LOCALHOST', '[::1]:47600']) {
    assert.equal(isAllowedHost(host, { lan: false }), true, host)
  }
})

test('a missing, malformed or foreign Host is refused', () => {
  for (const host of [undefined, '', 'bad host', 'rebind.example:47600', '192.168.1.20:47600',
    'user@localhost', 'localhost/x', ' localhost', 'localhost.', '2130706433', 'localhost:999999']) {
    assert.equal(isAllowedHost(host, { lan: false }), false, String(host))
  }
})

test('on the local network an address or the machine name is allowed, a domain is not', () => {
  const options = { lan: true, machineNames: ['Build-Box', 'build-box.local'] }
  assert.equal(isAllowedHost('192.168.1.20:47600', options), true)
  assert.equal(isAllowedHost('[fe80::1]:47600', options), true)
  assert.equal(isAllowedHost('build-box.local:47600', options), true)
  assert.equal(isAllowedHost('build-box:47600', options), true)
  assert.equal(isAllowedHost('rebind.example:47600', options), false)
})

test('a request without Origin, or from the page itself, is same origin', () => {
  assert.equal(isSameOrigin({ host: '127.0.0.1:47600' }), true)
  assert.equal(isSameOrigin({ host: '127.0.0.1:47600', origin: 'http://127.0.0.1:47600' }), true)
  assert.equal(isSameOrigin({ host: '127.0.0.1:47600', 'sec-fetch-site': 'same-origin' }), true)
})

test('a request from another site, another port or an opaque origin is refused', () => {
  const host = '127.0.0.1:47600'
  assert.equal(isSameOrigin({ host, origin: 'https://other.example' }), false)
  assert.equal(isSameOrigin({ host, origin: 'http://127.0.0.1:3000' }), false)
  assert.equal(isSameOrigin({ host, origin: 'null' }), false)
  assert.equal(isSameOrigin({ host, 'sec-fetch-site': 'cross-site' }), false)
})

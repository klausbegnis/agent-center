import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { REPOSITORY_URL } from './project-link.js'

const manifest = JSON.parse(readFileSync(new URL('../../orca-plugin.json', import.meta.url), 'utf8'))

test('the star link goes to the repository the manifest names', () => {
  assert.equal(REPOSITORY_URL, manifest.repository)
})

test('the star link is a web address the browser may open', () => {
  assert.equal(new URL(REPOSITORY_URL).protocol, 'https:')
})

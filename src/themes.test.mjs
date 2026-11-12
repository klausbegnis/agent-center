import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listThemes, TEMPLATE_THEME } from './themes.mjs'

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** A plugin folder holding the named theme folders; a null name gets no theme.json. */
function pluginFolder(t, themes) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-center-themes-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  for (const [folder, name] of Object.entries(themes)) {
    fs.mkdirSync(path.join(root, 'themes', folder), { recursive: true })
    if (name === null) continue
    fs.writeFileSync(path.join(root, 'themes', folder, 'theme.json'), JSON.stringify({ name }))
  }
  return root
}

test('every folder with a theme.json is a theme, sorted by id', (t) => {
  const root = pluginFolder(t, { 'lighthouse': 'Lighthouse', 'forest-camp': 'Forest Camp' })
  assert.deepEqual(listThemes(root), [
    { id: 'forest-camp', name: 'Forest Camp' },
    { id: 'lighthouse', name: 'Lighthouse' }
  ])
})

test('a folder without a theme.json is not a theme', (t) => {
  const root = pluginFolder(t, { 'forest-camp': 'Forest Camp', drafts: null })
  assert.deepEqual(listThemes(root).map((theme) => theme.id), ['forest-camp'])
})

test('a plugin folder without themes lists none', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-center-themes-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  assert.deepEqual(listThemes(root), [])
})

test('the theme template is not offered as a theme', (t) => {
  const root = pluginFolder(t, { [TEMPLATE_THEME]: 'Theme template', 'forest-camp': 'Forest Camp' })
  assert.deepEqual(listThemes(root).map((theme) => theme.id), ['forest-camp'])
})

test('the theme template is listed when it is asked for', (t) => {
  const root = pluginFolder(t, { [TEMPLATE_THEME]: 'Theme template', 'forest-camp': 'Forest Camp' })
  assert.deepEqual(listThemes(root, { includeTemplate: true }).map((theme) => theme.id), [
    TEMPLATE_THEME,
    'forest-camp'
  ])
})

test('the shipped template exists and stays out of the shipped theme list', () => {
  assert.ok(fs.existsSync(path.join(PLUGIN_ROOT, 'themes', TEMPLATE_THEME, 'theme.json')))
  const ids = listThemes(PLUGIN_ROOT).map((theme) => theme.id)
  assert.ok(ids.length > 0)
  assert.ok(!ids.includes(TEMPLATE_THEME))
})

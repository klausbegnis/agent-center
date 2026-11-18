import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { panelModuleOrder } from '../../scripts/panel-modules.mjs'

const BOOT = path.dirname(fileURLToPath(import.meta.url))

test('every panel module comes after the modules it imports, and the entry comes last', () => {
  const order = panelModuleOrder()
  const place = new Map(order.map((module, index) => [path.resolve(BOOT, module), index]))
  assert.equal(order.at(-1), './orca.js')
  for (const [file, index] of place) {
    const source = fs.readFileSync(file, 'utf8')
    for (const match of source.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const imported = path.resolve(path.dirname(file), match[1])
      assert.ok(place.has(imported), `${match[1]} imported by ${path.basename(file)} is listed`)
      assert.ok(place.get(imported) < index, `${match[1]} loads before ${path.basename(file)}`)
    }
  }
})

test('the panel never lists a test file or a module outside ui/', () => {
  for (const module of panelModuleOrder()) {
    assert.ok(!module.includes('.test.'), module)
    assert.ok(module.startsWith('./') || module.startsWith('../engine/'), module)
  }
})

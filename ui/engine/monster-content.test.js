// The game's races and bosses (game/*.json) name parts this UI draws: every one must exist, in
// the slot it is named for, on a rig this UI knows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { generateMonster, NO_PART, RIG_SLOTS, rigIdOf } from '../../src/game/races.mjs'
import { composeLook } from './monster-compose.js'
import { partById } from './monster-parts.js'
import { RIGS } from './monster-rigs.js'

const readGame = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const racesFile = readGame('races.json')
const races = racesFile.races
const bosses = readGame('bosses.json').bosses

/** Problems of one part id named for a slot of a rig. */
function checkPart(id, slot, rigId, label) {
  if (id === NO_PART) return slot === 'extras' ? [`${label}: "${NO_PART}" is not an extra`] : []
  const part = partById(id)
  if (!part) return [`${label}: no part "${id}"`]
  if (part.slot !== slot) return [`${label}: "${id}" is a ${part.slot} part, named as ${slot}`]
  if (part.rigs && !part.rigs[rigId]) return [`${label}: "${id}" is not drawn for ${rigId}`]
  return []
}

test('every rig of the races is one this UI draws, with every slot the races fill', () => {
  for (const race of races) {
    const rig = RIGS[rigIdOf(race)]
    assert.ok(rig, race.id)
    for (const slot of RIG_SLOTS[race.rig]) {
      if (slot !== 'outfit') assert.ok(rig.order.includes(slot), `${race.id}: ${slot}`)
    }
  }
})

test('every part a race can pick exists, in its slot and for its build', () => {
  const problems = []
  for (const race of races) {
    const rigId = rigIdOf(race)
    for (const [slot, ids] of Object.entries(race.parts)) {
      for (const id of ids) problems.push(...checkPart(id, slot, rigId, race.id))
    }
    for (const id of race.always ?? []) problems.push(...checkPart(id, 'extras', rigId, `${race.id} always`))
  }
  assert.deepEqual(problems, [])
})

test('every part a boss wears exists, in its slot and for its build', () => {
  const problems = []
  for (const boss of bosses) {
    const rigId = rigIdOf(races.find((race) => race.id === boss.race))
    for (const [slot, value] of Object.entries(boss.parts)) {
      for (const id of [value].flat()) problems.push(...checkPart(id, slot, rigId, boss.id))
    }
  }
  assert.deepEqual(problems, [])
})

test('a chimera\'s grafted head or legs is drawn for its build', () => {
  for (const race of races.filter((each) => each.rig === 'humanoid')) {
    const rigId = rigIdOf(race)
    for (const donor of races.filter((each) => each.rig === 'humanoid' && each.build === race.build)) {
      for (const id of donor.parts.legs) assert.ok(partById(id).rigs[rigId], `${id} on ${race.id}`)
    }
  }
})

/** What a monster looks like on screen: its pixels and the colours of the inks it shows. */
function picture(look) {
  const { rows, fills } = composeLook(look)
  const inks = [...new Set(rows.join('').replaceAll('.', ''))].sort()
  return `${rows.join('')}|${inks.map((ink) => fills[ink]).join()}`
}

test('every race draws many different pictures: at least 500 in 1,000 monsters', () => {
  for (const race of races) {
    const only = { ...racesFile, races: [race] }
    const pictures = new Set(Array.from({ length: 1000 }, (_, index) =>
      picture(generateMonster(only, { seed: `fuzzy-anvil|${index}` }).look)))
    assert.ok(pictures.size >= 500, `${race.id}: ${pictures.size}`)
  }
})

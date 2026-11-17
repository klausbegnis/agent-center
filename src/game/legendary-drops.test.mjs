import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { BOSS_ITEM_CHANCE, RELIC_CHANCE, TIER_LEVELS } from './constants.mjs'
import { createEngine } from './engine.mjs'
import { legendaryIndexOf } from './legendary-effects.mjs'
import { legendaryItemFor, rollLegendaryDrops } from './legendary-drops.mjs'
import { referenceGearLevel } from './items.mjs'
import { emptyProject, emptySave } from './worlds.mjs'

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const content = {
  monsters: readJson('../../game/monsters.json'),
  items: readJson('../../game/items.json'),
  races: readJson('../../game/races.json'),
  bosses: readJson('../../game/bosses.json'),
  legendary: readJson('../../game/legendary.json')
}
const index = legendaryIndexOf(content)
const boss = (id, rank = 'boss', level = 20) => ({ id, kind: 'boss', rank, level, look: {} })
const roll = (project, monster, seed = 'w|p|20|0') => rollLegendaryDrops(project, { monster, seed, index })
const owning = (relics, extra = {}) => ({ ...emptyProject(), legendary: { relics, active: relics[0] ?? null, relicPity: 0, bossPity: 0, ...extra } })
const allPool = () => [...index.poolRelicIds]

test('a monster that is not a boss wave\'s boss drops no legendary loot', () => {
  const project = emptyProject()
  const found = roll(project, { id: 'goblin', kind: 'common', rank: 'champion', level: 20 })
  assert.equal(found.project, project)
  assert.deepEqual(found.drops, [])
})

test('a room\'s first boss leaves a pool relic for certain, and it becomes active', () => {
  const found = roll(emptyProject(), boss('grubbin'))
  assert.equal(found.drops.length, 1)
  const [{ id, kind }] = found.drops
  assert.equal(kind, 'relic')
  assert.ok(index.poolRelicIds.includes(id))
  assert.deepEqual(found.project.legendary.relics, [id])
  assert.equal(found.project.legendary.active, id)
})

test('the same room, wave and kill always drop the same thing', () => {
  assert.deepEqual(roll(owning(['rimeheart']), boss('skrix'), 'a|b|30|0'), roll(owning(['rimeheart']), boss('skrix'), 'a|b|30|0'))
})

test('a relic the room owns never drops while others remain, and none drops once it owns them all', () => {
  for (let seed = 0; seed < 300; seed++) {
    const found = roll(owning(allPool().slice(1)), boss('grubbin', 'legendary'), `s${seed}`)
    for (const drop of found.drops) assert.equal(drop.id, allPool()[0])
  }
  const full = owning(allPool())
  assert.deepEqual(roll(full, boss('grubbin', 'legendary')).drops, [])
})

test('a miss adds pity and a drop clears it, so bad luck is bounded', () => {
  let project = owning(['rimeheart'])
  let kills = 0
  while (!roll(project, boss('grubbin'), `k${kills}`).drops.length) {
    project = roll(project, boss('grubbin'), `k${kills}`).project
    kills += 1
    assert.equal(project.legendary.relicPity, kills)
  }
  assert.ok(kills <= Math.ceil((1 - RELIC_CHANCE.boss) / 0.08))
  assert.equal(roll(project, boss('grubbin'), `k${kills}`).project.legendary.relicPity, 0)
})

test('a legendary boss drops pool relics far more often than a plain one', () => {
  const rate = (rank) => {
    let drops = 0
    for (let seed = 0; seed < 2000; seed++) drops += roll(owning(['rimeheart']), boss('grubbin', rank), `r${seed}`).drops.length
    return drops / 2000
  }
  assert.ok(Math.abs(rate('legendary') - RELIC_CHANCE.legendary) < 0.05)
  assert.ok(Math.abs(rate('boss') - RELIC_CHANCE.boss) < 0.03)
})

test('a room\'s first boss-owned item is certain, from the boss that owns it', () => {
  const found = roll(owning(['tidecall-conch']), boss('gorrath'))
  assert.deepEqual(found.drops, [{ id: 'labyrinth-cleaver', kind: 'equipment' }])
  const item = found.project.chest.find((owned) => owned.id === 'labyrinth-cleaver')
  assert.equal(item.legendary, true)
  assert.equal(item.heldBy, null)
})

test('a boss relic joins the room\'s relics and leaves the active one as it was', () => {
  const found = roll(owning(['tidecall-conch']), boss('old-hessa'))
  assert.deepEqual(found.project.legendary.relics, ['tidecall-conch', 'rimeheart'])
  assert.equal(found.project.legendary.active, 'tidecall-conch')
})

test('after the first, a boss-owned item is rare, rarer from a plain boss than a legendary one', () => {
  const rate = (rank) => {
    let drops = 0
    for (let seed = 0; seed < 2000; seed++) {
      const found = roll(owning(['tidecall-conch', 'rimeheart']), boss('gorrath', rank), `b${seed}`)
      drops += found.drops.filter((drop) => drop.kind === 'equipment').length
    }
    return drops / 2000
  }
  assert.ok(Math.abs(rate('boss') - BOSS_ITEM_CHANCE.boss) < 0.02)
  assert.ok(Math.abs(rate('legendary') - BOSS_ITEM_CHANCE.legendary) < 0.03)
})

test('a boss whose item the room owns gives it no second copy', () => {
  const project = { ...owning(['tidecall-conch']), chest: [legendaryItemFor(index.byId.get('labyrinth-cleaver'), 20)] }
  for (let seed = 0; seed < 200; seed++) {
    assert.ok(roll(project, boss('gorrath', 'legendary'), `o${seed}`).drops.every((drop) => drop.kind !== 'equipment'))
  }
})

test('legendary equipment drops ready to use, at the reference gear of the boss\'s level', () => {
  const item = legendaryItemFor(index.byId.get('stormwing-staff'), 120)
  assert.equal(item.damageType, 'magical')
  assert.equal(item.level + TIER_LEVELS * (item.tier - 1), Math.round(referenceGearLevel(120)))
})

test('a fight that beats a boss reports its legendary drop on the kill event', () => {
  const engine = createEngine({ content })
  let save = emptySave()
  for (const [at, sessionId] of ['a', 'b', 'c', 'd'].entries()) {
    save = engine.applyTokens(save, { projectId: 'room', sessionId, tokens: 3_000_000, activity: ['write', 'read', 'think', 'delegate'][at], now: 0 })
  }
  const room = save.worlds.main.projects.room
  save.worlds.main.projects.room = { ...room, wave: 10, waveKills: 0, monster: null }
  const sessions = ['a', 'b', 'c', 'd'].map((sessionId) => ({ projectId: 'room', sessionId, state: 'working', tokensPerMinute: 20_000 }))
  const { save: after, events } = engine.advanceWithEvents(save, { from: 0, to: 8 * 3_600_000, sessions })
  const bossKill = events.find((event) => event.kind === 'boss')
  assert.ok(bossKill.legendary.some((drop) => drop.kind === 'relic'))
  assert.equal(after.worlds.main.projects.room.legendary.relics.length >= 1, true)
})

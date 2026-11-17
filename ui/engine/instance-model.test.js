import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { bestiaryContentView } from '../../src/game/bestiary-view.mjs'
import { instancesContentView, runView, worldInstancesView } from '../../src/game/instance-view.mjs'
import { legendaryView } from '../../src/game/legendary-view.mjs'
import { legendaryIndexOf } from '../../src/game/legendary-effects.mjs'
import { emptyProject } from '../../src/game/worlds.mjs'
import {
  cooldownLines,
  instanceBand,
  roadmapModel,
  runCardModel,
  tierModifier,
  worldViewOrDefault
} from './instance-model.js'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const content = {
  races: readJson('races.json'),
  bosses: readJson('bosses.json'),
  legendary: readJson('legendary.json'),
  bestiary: readJson('bestiary.json'),
  instances: readJson('instances.json')
}
const ROOM = 'local:/work/rumble-banana'
const OTHER = 'local:/work/turbo-waffle'
const SKILL = { level: 12, xp: 0, banked: 0, stars: 0 }
const names = (id) => id.split('/').at(-1)

/** A world at level 12 with the Sunken Crypt cleared and one room in Emberdeep Foundry's vault. */
function game({ run = true } = {}) {
  const skills = Object.fromEntries(['forge', 'lore', 'engineering', 'arcana', 'command'].map((id) => [id, { ...SKILL }]))
  const runner = {
    ...emptyProject({ wave: 14 }),
    characters: { s1: { sessionId: 's1' } },
    ...(run ? {
      run: {
        instance: 'emberdeep-foundry', tier: 2, attempt: 0, room: 4, fight: 0, tries: 1, tryTicks: 0, waitTicks: 6, ticks: 240,
        boon: null, offered: ['second-wind', 'whetted-blades'],
        found: { materials: {}, coins: 120, legendary: [], kills: 5 },
        frozen: { wave: 14, waveKills: 0, monster: null, fightTicks: 0, fightRested: false }
      }
    } : {})
  }
  const other = { ...emptyProject({ wave: 12 }), characters: {}, instanceCooldowns: { 'sunken-crypt': 3_600_000 } }
  const world = {
    skills, materials: {}, upgrades: {}, coins: 0,
    projects: { [ROOM]: runner, [OTHER]: other },
    instances: { 'sunken-crypt': { runs: 2, clears: 1, bestTier: 1 }, 'emberdeep-foundry': { runs: 1, clears: 0, bestTier: 0 } }
  }
  const legendary = legendaryView(legendaryIndexOf(content), content.bosses, content.instances)
  return {
    instances: instancesContentView(content),
    bestiary: bestiaryContentView(content),
    legendary,
    worlds: [{ id: 'main', instances: worldInstancesView('main', world, content), roomIds: [ROOM, OTHER] }],
    rooms: {
      [ROOM]: { run: runView('main', ROOM, runner, world, content), instanceCooldowns: null },
      [OTHER]: { run: null, instanceCooldowns: { 'sunken-crypt': 3_600_000 } }
    }
  }
}
const context = (state) => ({ base: '/', roomIds: [ROOM, OTHER], roomId: OTHER, names })

test('the roadmap picks the picture for the world\'s progress and places a marker on every site', () => {
  const state = game()
  const model = roadmapModel(state, state.worlds[0], context(state))
  assert.equal(model.map.src, '/ui/instances/roadmap-1.png')
  assert.equal(model.markers.length, 6)
  const crypt = model.markers[0]
  assert.equal(crypt.state, 'cleared')
  assert.ok(Math.abs(crypt.left - (100 * 82) / 256) < 1e-9 && Math.abs(crypt.top - (100 * 94) / 144) < 1e-9)
  assert.equal(model.markers[1].state, 'inside')
  assert.ok(model.markers.slice(2).every((marker) => marker.state === 'hidden'))
  assert.equal(model.summary, '1 of 6 instances cleared')
})

test('a hidden instance shows no name, a locked one its level, a cleared one its count', () => {
  const state = game()
  const cards = roadmapModel(state, state.worlds[0], context(state)).cards
  assert.equal(cards[2].name, '???')
  assert.equal(cards[2].relic, null)
  assert.equal(cards[2].enter, null)
  assert.match(cards[0].stateText, /Cleared ×1/)
  assert.match(cards[1].stateText, /rumble-banana is inside: room 5 of 6/)
  assert.match(cards[0].racesText, /Skeletons/)
  assert.match(cards[0].bossText, /Ossric, the Ossuary Lord/)
  assert.equal(cards[0].relic.name, 'The Tidewake Bell')
  assert.match(cards[0].relic.text, /skeletons/)
})

test('the Enter control lists the world\'s rooms with why each cannot enter, and its tiers with their modifier', () => {
  const state = game()
  const enter = roadmapModel(state, state.worlds[0], context(state)).cards[0].enter
  assert.deepEqual(enter.rooms.map((room) => room.id), [ROOM, OTHER])
  assert.match(enter.rooms[0].reason, /already inside/)
  assert.match(enter.rooms[1].reason, /no characters/)
  assert.equal(enter.canEnter, false)
  assert.deepEqual(enter.tiers.map((tier) => tier.tier), [2, 1])
  assert.match(enter.tiers[0].text, /^Tier 2: /)
})

test('a tier above the first gets its instance\'s modifiers in turn', () => {
  const state = game()
  const crypt = state.instances.instances[0]
  assert.equal(tierModifier(state, crypt, 1), null)
  assert.equal(tierModifier(state, crypt, 2).id, crypt.rotation[0])
  assert.equal(tierModifier(state, crypt, 2 + crypt.rotation.length).id, crypt.rotation[0])
  assert.ok(tierModifier(state, crypt, 3).text)
})

test('a run\'s card checks the rooms behind, marks the current one and dims the ones ahead', () => {
  const state = game()
  const card = runCardModel(state, ROOM, { base: '/' })
  assert.deepEqual(card.icons.map((icon) => icon.stage), ['cleared', 'cleared', 'cleared', 'cleared', 'current', 'ahead'])
  assert.match(card.icons[4].label, /Room 5, Vault: The Ingot Store, the party is here/)
  assert.equal(card.route, null, 'only the Sunken Crypt has a route picture')
  assert.equal(card.offered.length, 2)
  assert.match(card.offered[0].text, /Stamina back to full/)
  assert.match(card.triesText, /2 tries left/)
  assert.match(card.modifierText, /^Tier modifier: /)
  assert.match(card.vaultWaitText, /4 min/)
  assert.equal(runCardModel(game({ run: false }), ROOM, { base: '/' }), null)
})

test('a room inside an instance has a band with the instance, its room and the backdrop', () => {
  const state = game()
  const band = instanceBand(state, ROOM, '/')
  assert.match(band.text, /Emberdeep Foundry · room 5 of 6 · The Ingot Store/)
  assert.equal(band.backdrop, '/ui/instances/emberdeep-foundry.png')
  assert.equal(instanceBand(state, OTHER, '/'), null)
})

test('a room\'s cooldowns are worded with the working time left', () => {
  assert.deepEqual(cooldownLines(game(), OTHER), ['The Sunken Crypt: the party recovers for 1 h more of work on the waves.'])
})

test('the World tab opens on a known view, the creatures otherwise', () => {
  assert.equal(worldViewOrDefault('roadmap'), 'roadmap')
  assert.equal(worldViewOrDefault('gallery'), 'creatures')
})

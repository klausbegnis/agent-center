import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { BOSS_EVERY } from './constants.mjs'
import { createEngine } from './engine.mjs'
import { monsterFor } from './monsters.mjs'
import { bossFor, CHIMERA_WORD, generateMonster, HANDMADE_SHARE, PALETTE_ROLES, RIG_SLOTS } from './races.mjs'
import { emptySave } from './worlds.mjs'

const readGame = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const races = readGame('races.json')
const bosses = readGame('bosses.json')
const monsters = readGame('monsters.json')
const referencePartyHit = (level) => ({ physical: 60, magical: 40, total: 100 * 1.04 ** level })
const raceById = (id) => races.races.find((race) => race.id === id)
const only = (id) => ({ ...races, races: [raceById(id)] })
const seeds = (count, label = 'sneaky-pancake') =>
  Array.from({ length: count }, (_, index) => `${label}|${index}`)

test('the same seed always gives the same monster', () => {
  const once = generateMonster(races, { seed: 'cosmic-llama|7' })
  assert.deepEqual(generateMonster(races, { seed: 'cosmic-llama|7' }), once)
})

test('a generated look fills every slot of its race\'s rig and carries every colour', () => {
  for (const seed of seeds(300)) {
    const monster = generateMonster(races, { seed })
    const race = raceById(monster.race)
    for (const slot of RIG_SLOTS[race.rig]) assert.ok(monster.look.parts[slot], `${monster.race} ${slot}`)
    for (const role of PALETTE_ROLES) assert.match(monster.look.colours[role], /^#[0-9a-f]{6}$/i)
  }
})

test('every race comes up, and a race that prefers the room\'s theme comes up more often', () => {
  const countOf = (themeId) => {
    const counts = {}
    for (const seed of seeds(6000)) {
      const { race } = generateMonster(races, { seed, themeId })
      counts[race] = (counts[race] ?? 0) + 1
    }
    return counts
  }
  const plain = countOf('guild-hall')
  const gothic = countOf('gothic-dungeon')
  assert.equal(Object.keys(plain).length, races.races.length)
  assert.ok(gothic.skeleton > plain.skeleton * 2, `${gothic.skeleton} vs ${plain.skeleton}`)
  assert.ok(gothic.goblin < plain.goblin)
})

test('the role in a name agrees with what is drawn: archers hold bows, shamans staves', () => {
  for (const seed of seeds(3000)) {
    const monster = generateMonster(races, { seed })
    if (monster.name.includes(CHIMERA_WORD)) continue
    if (/\bArcher\b/.test(monster.name)) assert.equal(monster.look.parts.held, 'bow', monster.name)
    if (/\b(Shaman|Mage)\b/.test(monster.name)) assert.equal(monster.look.parts.held, 'staff', monster.name)
    if (/\bReaper\b/.test(monster.name)) assert.equal(monster.look.parts.held, 'scythe', monster.name)
    if (/\bWasp\b/.test(monster.name)) assert.equal(monster.look.parts.abdomen, 'insect-abdomen-stinger')
  }
})

test('a name is the colour word, the race and the role: "Bog Troll Brute"', () => {
  const names = new Set(seeds(400).map((seed) => generateMonster(only('troll'), { seed }).name))
  for (const name of names) {
    if (name.startsWith(CHIMERA_WORD)) continue
    assert.match(name, /^(Bog|Cave|Frost|Moss|Stone) Troll (Brute|Hunter|Mauler|Shaman)$/)
  }
})

test('a champion\'s name leads with its race\'s mark, an elemental names its element by colour', () => {
  const champion = generateMonster(only('elemental'), { seed: 'turbo-waffle|3', rank: 'champion' })
  const [mark, colour, noun] = champion.name.split(' ')
  assert.ok(['Elder', 'Raging'].includes(mark), champion.name)
  const words = raceById('elemental').palettes.skin.map((entry) => entry.word)
  assert.ok(words.includes(colour) && noun === 'Elemental', champion.name)
})

test('an element keeps to its colours and its extras', () => {
  for (const seed of seeds(400)) {
    const { name, look } = generateMonster(only('elemental'), { seed })
    if (!/^(Gale|Mist|Storm)/.test(name)) continue
    assert.ok(look.parts.extras.every((extra) => extra === 'elemental-gusts'), name)
  }
})

test('about one humanoid in CHIMERA_ONE_IN is a chimera, with a head or legs of a race of its build', () => {
  const humanoids = { ...races, races: races.races.filter((race) => race.rig === 'humanoid') }
  const results = seeds(6000).map((seed) => generateMonster(humanoids, { seed }))
  const chimeras = results.filter((monster) => monster.name.startsWith(CHIMERA_WORD))
  assert.ok(chimeras.length > 100 && chimeras.length < 320, String(chimeras.length))
  for (const chimera of chimeras) {
    const race = raceById(chimera.race)
    const grafted = ['head', 'legs'].filter((slot) => !race.parts[slot].includes(chimera.look.parts[slot]))
    assert.equal(grafted.length, 1, chimera.name)
    const [slot] = grafted
    const donor = races.races.find((other) => other.parts[slot]?.includes(chimera.look.parts[slot]))
    assert.equal(donor.build, race.build)
  }
})

test('a race\'s fixed extras are always there: a lizard has its tail', () => {
  for (const seed of seeds(100)) {
    assert.ok(generateMonster(only('lizardfolk'), { seed }).look.parts.extras.includes('lizard-tail'))
  }
})

test('a project meets every boss of the roster once before any comes back', () => {
  const met = Array.from({ length: bosses.bosses.length }, (_, bossNumber) =>
    bossFor(bosses, races, { worldId: 'main', projectId: 'rumble-banana', bossNumber }).id)
  assert.equal(new Set(met).size, bosses.bosses.length)
  const next = bossFor(bosses, races, { worldId: 'main', projectId: 'rumble-banana', bossNumber: met.length })
  assert.equal(next.id, met[0])
})

test('two projects meet the roster in different orders', () => {
  const order = (projectId) => [0, 1, 2, 3, 4].map((bossNumber) =>
    bossFor(bosses, races, { worldId: 'main', projectId, bossNumber }).id)
  assert.notDeepEqual(order('rumble-banana'), order('turbo-waffle'))
})

test('a boss looks exactly as written, with its name and epithet', () => {
  const where = { worldId: 'main', projectId: 'fuzzy-anvil', bossNumber: 3 }
  const boss = bossFor({ bosses: [bosses.bosses[0]] }, races, where)
  const written = bosses.bosses[0]
  assert.equal(boss.name, `${written.name}, ${written.epithet}`)
  assert.deepEqual(boss.look.colours, written.colours)
  assert.equal(boss.look.parts.head, written.parts.head)
})

test('the roster has at least 50 bosses spread over every race, two to five each', () => {
  assert.ok(bosses.bosses.length >= 50)
  for (const race of races.races) {
    const count = bosses.bosses.filter((boss) => boss.race === race.id).length
    assert.ok(count >= 2 && count <= 5, `${race.id}: ${count}`)
  }
})

const fight = (wave, themeId, kill = 0) => monsterFor({
  worldId: 'main', projectId: 'quantum-pickle', wave, kill, themeId,
  content: monsters, races, bosses, referencePartyHit
})

test('in a themed room the theme\'s own entries show as themselves about HANDMADE_SHARE of the time', () => {
  const kills = Array.from({ length: 2000 }, (_, kill) => fight(13, 'guild-hall', kill))
  const handmade = kills.filter((monster) => monster.sprite).length / kills.length
  assert.ok(Math.abs(handmade - HANDMADE_SHARE) < 0.04, String(handmade))
  assert.ok(kills.filter((monster) => monster.look).every((monster) => monster.race && !monster.sprite))
})

test('a room without a theme of its own meets generated monsters and roster bosses only', () => {
  const kills = Array.from({ length: 200 }, (_, kill) => fight(13, 'pixel-fog', kill))
  assert.ok(kills.every((monster) => monster.look && !monster.sprite))
  const boss = fight(BOSS_EVERY * 4, 'pixel-fog')
  assert.ok(bosses.bosses.some((entry) => entry.id === boss.id))
})

test('the look changes nothing a fight measures: it matches the content without races', () => {
  for (const wave of [7, 10, 23, 40]) {
    const looked = fight(wave, 'guild-hall')
    const where = { worldId: 'main', projectId: 'quantum-pickle', wave, themeId: 'guild-hall' }
    const plain = monsterFor({ ...where, content: monsters, referencePartyHit })
    for (const key of ['kind', 'rank', 'affix', 'maxHp', 'reward', 'dropFactor', 'attack', 'physical']) {
      assert.deepEqual(looked[key], plain[key], key)
    }
    assert.deepEqual(looked.loot, plain.loot)
  }
})

/** A look's signature: every part and colour, so two monsters that look alike count once. */
const signature = (look) => JSON.stringify([look.parts, look.colours])

test('every race comes in many looks: at least 150 distinct ones in 400 monsters', () => {
  for (const race of races.races) {
    const looks = new Set(seeds(400, race.id)
      .map((seed) => signature(generateMonster(only(race.id), { seed }).look)))
    assert.ok(looks.size >= 150, `${race.id}: ${looks.size}`)
  }
})

test('a monster saved before ranks and looks is viewed with its sprite and a rank, and fought on', () => {
  const items = readGame('items.json')
  const engine = createEngine({ content: { monsters, items, races, bosses } })
  const session = { projectId: 'cosmic-llama', sessionId: 'pane-1' }
  let save = engine.applyTokens(emptySave(), { ...session, tokens: 200_000, activity: 'write', now: 0 })
  save = engine.prepareFights(save, { sessions: [{ ...session, state: 'working' }] })
  const project = save.worlds.main.projects['cosmic-llama']
  const old = {
    id: 'ink-slime', name: 'Ink Slime', kind: 'common', affix: 'thorny', level: project.wave, maxHp: 50,
    hp: 50, physical: 1, magical: 1, attack: 1, reward: 3, loot: { pages: 2, seals: 1 },
    sprite: { body: 'blob', accent: '#3B4A8C' }
  }
  const projects = { 'cosmic-llama': { ...project, monster: old } }
  save = { ...save, worlds: { main: { ...save.worlds.main, projects } } }
  const shown = engine.view(save).worlds[0].projects[0].monster
  assert.deepEqual(shown.sprite, old.sprite)
  assert.equal(shown.rank, 'elite')
  assert.equal(shown.look, undefined)
  const sessions = [{ ...session, state: 'working', tokensPerMinute: 20_000 }]
  const { events } = engine.advanceWithEvents(save, { from: 0, to: 3_600_000, sessions })
  const first = events.find((event) => event.type === 'kill')
  assert.equal(first.rank, 'elite')
})

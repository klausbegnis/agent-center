import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { achievementIndexOf, validateAchievements } from './achievement-content.mjs'
import { achievementsView, grantAchievements, progressOf, setPartyTitle, titleProblem } from './achievements.mjs'
import { METRICS, metricContext } from './achievement-metrics.mjs'
import { emptyProject, emptySave, emptyWorld } from './worlds.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const content = {
  items: readJson('items.json'),
  bosses: readJson('bosses.json'),
  bestiary: readJson('bestiary.json'),
  settlement: readJson('settlement.json'),
  instances: readJson('instances.json'),
  cities: readJson('cities.json'),
  achievements: readJson('achievements.json')
}
const index = achievementIndexOf(content)
const AT = 1_800_000_000_000
const ROOM = 'local:/work/rumble-banana'
const OTHER_ROOM = 'local:/work/turbo-waffle'

/** A save with one world whose room has killed `kills` monsters, and anything else given. */
function saveWith({ kills = 0, world = {}, project = {}, achievements } = {}) {
  const save = emptySave()
  save.worlds.main = { ...emptyWorld(), ...world, projects: { [ROOM]: { ...emptyProject(), kills, ...project } } }
  save.projectWorld[ROOM] = 'main'
  return achievements ? { ...save, achievements } : save
}

/** Grants on a save that already had its back-fill, so what is met is news. */
const grant = (save, at = AT) => grantAchievements({ achievements: { earned: {}, titles: {}, filled: 0 }, ...save }, { content, index, at })

test('the shipped catalogue is valid, with at least 80 achievements, titles and hidden ones', () => {
  assert.deepEqual(validateAchievements(content.achievements, content), [])
  assert.ok(index.list.length >= 80)
  assert.ok(index.list.filter((entry) => entry.title).length >= 10)
  assert.ok(index.list.some((entry) => entry.hidden))
})

test('a condition naming a metric the game does not measure is a problem of the file', () => {
  const data = { groups: [{ id: 'battle', name: 'Battle' }], achievements: [
    { id: 'odd', group: 'battle', name: 'Odd', description: 'Odd.', points: 5, when: { metric: 'dances', atLeast: 1 } }
  ] }
  assert.match(validateAchievements(data, content).join(), /dances" is not a metric/)
})

test('a parameter must name something the content has', () => {
  const data = { groups: [{ id: 'bestiary', name: 'Bestiary' }], achievements: [
    { id: 'odd', group: 'bestiary', name: 'Odd', description: 'Odd.', points: 5, when: { metric: 'raceKills', race: 'unicorn', atLeast: 1 } }
  ] }
  assert.match(validateAchievements(data, content).join(), /race is not a race the game has/)
})

test('defeating a hundred monsters earns the first two steps of the ladder, not the third', () => {
  const { earned } = grant(saveWith({ kills: 100 }))
  assert.ok(earned.includes('monsters-1'))
  assert.ok(earned.includes('monsters-2'))
  assert.ok(!earned.includes('monsters-3'))
})

test('an achievement is earned once: granting again changes nothing', () => {
  const first = grant(saveWith({ kills: 100 }))
  const again = grantAchievements(first.save, { content, index, at: AT + 1 })
  assert.deepEqual(again.earned, [])
  assert.equal(again.save, first.save)
})

test('an achievement once earned stays earned when the world starts over', () => {
  const first = grant(saveWith({ kills: 100 }))
  const reset = { ...first.save, worlds: { main: { ...emptyWorld(), projects: { [ROOM]: emptyProject() } } } }
  const view = achievementsView(grantAchievements(reset, { content, index, at: AT + 1 }).save, { content, index })
  assert.equal(view.groups.find((group) => group.id === 'battle').list.find((entry) => entry.id === 'monsters-2').earnedAt, AT)
})

test('a race\'s kills come from the bestiary of every world', () => {
  const troll = [480, 15, 4, 1, 0, 0, 20_000]
  const save = saveWith({ world: { bestiary: { races: { troll }, bosses: {} } } })
  assert.ok(grant(save).earned.includes('race-troll'))
})

test('a condition over several metrics is met only when all are', () => {
  const skills = (level) => Object.fromEntries(['forge', 'lore', 'engineering', 'arcana', 'command']
    .map((id) => [id, { level, xp: 0, banked: 0, stars: 0 }]))
  const lopsided = { ...skills(20), command: { level: 19, xp: 0, banked: 0, stars: 0 } }
  assert.ok(!grant(saveWith({ world: { skills: lopsided } })).earned.includes('five-skills'))
  assert.ok(grant(saveWith({ world: { skills: skills(20) } })).earned.includes('five-skills'))
})

test('progress of a single metric tells its value and target, of several the mean share', () => {
  const measure = (when) => ({ kills: 50, wave: 10 })[when.metric]
  assert.deepEqual(progressOf({ metric: 'kills', atLeast: 100 }, measure), { share: 0.5, value: 50, target: 100 })
  const both = progressOf({ all: [{ metric: 'kills', atLeast: 100 }, { metric: 'wave', atLeast: 10 }] }, measure)
  assert.equal(both.share, 0.75)
})

test('earning enough achievements earns the collector\'s achievement in the same check', () => {
  // Kills, waves and coins at once: well over ten achievements.
  const save = saveWith({ kills: 100_000, project: { wave: 200 }, world: { coins: 1_000_000 } })
  assert.ok(grant(save).earned.includes('collector-1'))
})

test('a save that never had achievements is back-filled quietly, counting what it granted', () => {
  const backfilled = grantAchievements(saveWith({ kills: 1_000 }), { content, index, at: AT })
  assert.deepEqual(backfilled.earned, [])
  assert.equal(backfilled.backfilled, 3)
  assert.equal(backfilled.save.achievements.filled, 3)
  assert.equal(Object.keys(backfilled.save.achievements.earned).length, 3)
})

test('the back-fill runs once: a later check grants as news', () => {
  const backfilled = grantAchievements(saveWith({ kills: 1_000 }), { content, index, at: AT }).save
  const later = { ...backfilled, worlds: { main: { ...backfilled.worlds.main, projects: { [ROOM]: { ...emptyProject(), kills: 10_000 } } } } }
  const next = grantAchievements(later, { content, index, at: AT + 1 })
  assert.equal(next.backfilled, null)
  assert.deepEqual(next.earned, ['monsters-4'])
  assert.equal(next.save.achievements.filled, 3)
})

test('a brand-new save is back-filled with nothing, so its first achievements are news', () => {
  const empty = grantAchievements(emptySave(), { content, index, at: AT })
  assert.equal(empty.backfilled, 0)
  assert.ok(grantAchievements(saveWith({ kills: 1 }), { content, index, at: AT }).backfilled !== null)
  const later = { ...saveWith({ kills: 1 }), achievements: empty.save.achievements }
  assert.deepEqual(grantAchievements(later, { content, index, at: AT }).earned, ['monsters-1'])
})

test('a room\'s party can wear a title it earned, and take it off', () => {
  const save = grant(saveWith({ kills: 10_000 })).save
  const titled = setPartyTitle(save, { projectId: ROOM, achievementId: 'monsters-4' }, index)
  assert.deepEqual(achievementsView(titled, { content, index }).partyTitles[ROOM], { id: 'monsters-4', title: 'the Relentless' })
  const bare = setPartyTitle(titled, { projectId: ROOM, achievementId: null }, index)
  assert.equal(achievementsView(bare, { content, index }).partyTitles[ROOM], undefined)
})

test('a title not earned, an achievement without a title, or a room that does not play is refused', () => {
  const save = grant(saveWith({ kills: 100 })).save
  assert.equal(titleProblem(save, { projectId: ROOM, achievementId: 'monsters-4' }, index), 'that title has not been earned yet')
  assert.equal(titleProblem(save, { projectId: ROOM, achievementId: 'monsters-1' }, index), 'that achievement grants no title')
  assert.equal(titleProblem(save, { projectId: OTHER_ROOM, achievementId: null }, index), 'the room does not play')
  assert.equal(setPartyTitle(save, { projectId: ROOM, achievementId: 'monsters-4' }, index), save)
})

test('a room that leaves the save takes its title along', () => {
  const save = grant(saveWith({ kills: 10_000 })).save
  const titled = setPartyTitle(save, { projectId: ROOM, achievementId: 'monsters-4' }, index)
  const gone = { ...titled, worlds: { main: { ...titled.worlds.main, projects: {} } } }
  assert.deepEqual(grantAchievements(gone, { content, index, at: AT }).save.achievements.titles, {})
})

test('a hidden achievement not earned yet shows neither its name nor its goal', () => {
  const view = achievementsView(saveWith(), { content, index })
  const secret = view.groups.flatMap((group) => group.list).find((entry) => entry.id === 'monsters-6')
  assert.equal(secret.hidden, true)
  assert.equal(secret.name, undefined)
  assert.equal(secret.description, undefined)
  assert.equal(secret.target, undefined)
})

test('the view counts points and earned achievements per group', () => {
  const save = grant(saveWith({ kills: 100 })).save
  const view = achievementsView(save, { content, index })
  assert.equal(view.points, 15)
  assert.equal(view.earned, 2)
  assert.equal(view.groups.find((group) => group.id === 'battle').earned, 2)
  assert.equal(view.total, index.list.length)
})

test('every metric measures an empty save as 0 and never throws', () => {
  const context = metricContext(content)
  const choices = { rank: 'elite', race: 'troll', boss: 'skrix', skill: 'forge', building: 'hearth', instance: 'sunken-crypt' }
  for (const [id, metric] of Object.entries(METRICS)) {
    assert.equal(metric.measure(emptySave(), context, metric.param ? choices[metric.param] : undefined), 0, id)
  }
})

test('a world\'s settlement stage, instances and relics are measured from the save', () => {
  const save = saveWith({
    world: { upgrades: { campfire: 20, workbench: 10 }, instances: { 'sunken-crypt': { runs: 3, clears: 2, bestTier: 2 } } },
    project: { legendary: { relics: ['rimeheart', 'tidecall-conch'], active: null, relicPity: 0, bossPity: 0 } }
  })
  const context = metricContext(content)
  assert.equal(METRICS.stage.measure(save, context), 4)
  assert.equal(METRICS.buildingTier.measure(save, context, 'hearth'), 3)
  assert.equal(METRICS.instanceClears.measure(save, context), 2)
  assert.equal(METRICS.instanceTier.measure(save, context), 2)
  assert.equal(METRICS.relics.measure(save, context), 2)
})

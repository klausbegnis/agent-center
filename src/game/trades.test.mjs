import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { tradeFor } from './characters.mjs'
import { createEngine } from './engine.mjs'
import { cleanSave } from './save-check.mjs'
import { GATHERING_SKILLS, materialOfSkill } from './skills.mjs'
import { effectiveTrade, setCharacterTrade, setRoomTrade, tradeChoiceOf } from './trades.mjs'
import { emptySave, excludeProject, migrate } from './worlds.mjs'

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const content = { monsters: readJson('../../game/monsters.json'), items: readJson('../../game/items.json') }
const engine = createEngine({ content })

const HOUR = 3_600_000
const ROOM = 'rumble-banana'

/** A save whose room has a character for each session, all of them having spent some tokens. */
function playing(...sessionIds) {
  let save = emptySave()
  for (const sessionId of sessionIds) {
    save = engine.applyTokens(save, { projectId: ROOM, sessionId, tokens: 200_000, activity: 'write', now: 0 })
  }
  return save
}

const project = (save) => save.worlds.main.projects[ROOM]
/** A session id whose own trade (Auto) is not `trade`, so a choice is seen to change something. */
const sessionNotOf = (trade) => ['s1', 's2', 's3', 's4', 's5', 's6', 's7'].find((id) => tradeFor(id) !== trade)

/** What an hour of the room's idle sessions gathers, by material. */
function gatheredInAnHour(save, sessionIds) {
  const sessions = sessionIds.map((sessionId) => ({ projectId: ROOM, sessionId, state: 'idle' }))
  return engine.advance(save, { from: 0, to: HOUR, sessions }).worlds.main.materials
}

test('a character gathers its own choice, else its room\'s, else the trade the game gave it', () => {
  const auto = { trade: 'mining', tradeChoice: null }
  assert.equal(effectiveTrade(auto, { tradeChoice: null }), 'mining')
  assert.equal(effectiveTrade(auto, { tradeChoice: 'fishing' }), 'fishing')
  assert.equal(effectiveTrade({ ...auto, tradeChoice: 'runecraft' }, { tradeChoice: 'fishing' }), 'runecraft')
})

test('a character or room without the field, or with an unknown trade, counts as Auto', () => {
  assert.equal(effectiveTrade({ trade: 'farming' }, {}), 'farming')
  assert.equal(effectiveTrade({ trade: 'farming', tradeChoice: 'gold' }, { tradeChoice: '__proto__' }), 'farming')
  assert.equal(tradeChoiceOf('hunting'), 'hunting')
  assert.equal(tradeChoiceOf('forge'), null)
})

test('an idle character gathers the trade chosen for it, and its skill gets the experience', () => {
  const sessionId = sessionNotOf('runecraft')
  const save = setCharacterTrade(playing(sessionId), { projectId: ROOM, sessionId, trade: 'runecraft' })
  const after = engine.advance(save, { from: 0, to: HOUR, sessions: [{ projectId: ROOM, sessionId, state: 'idle' }] })
  assert.ok(after.worlds.main.materials.runes > 0)
  assert.equal(after.worlds.main.materials[materialOfSkill(tradeFor(sessionId))] ?? 0, 0)
  assert.ok(after.worlds.main.skills.runecraft.xp > 0)
})

test('the room\'s trade brings every idle character there to it, but not one with its own choice', () => {
  const save = setRoomTrade(playing('s1', 's2', 's3'), { projectId: ROOM, trade: 'fishing' })
  const chosen = setCharacterTrade(save, { projectId: ROOM, sessionId: 's3', trade: 'hunting' })
  const materials = gatheredInAnHour(chosen, ['s1', 's2', 's3'])
  assert.deepEqual(Object.keys(materials).filter((id) => materials[id] > 0).sort(), ['fish', 'hides'])
})

test('a character that joins a room with a trade gathers that trade', () => {
  const sessionId = sessionNotOf('woodcutting')
  const save = setRoomTrade(playing('s0'), { projectId: ROOM, trade: 'woodcutting' })
  const joined = engine.applyTokens(save, { projectId: ROOM, sessionId, tokens: 100_000, activity: 'read', now: 0 })
  assert.equal(engine.view(joined).worlds[0].projects[0].party.find((member) => member.sessionId === sessionId).trade,
    'woodcutting')
})

test('back to Auto, a character gathers the trade the game gave it again', () => {
  const sessionId = sessionNotOf('farming')
  const chosen = setCharacterTrade(playing(sessionId), { projectId: ROOM, sessionId, trade: 'farming' })
  const auto = setCharacterTrade(chosen, { projectId: ROOM, sessionId, trade: null })
  assert.equal(effectiveTrade(project(auto).characters[sessionId], project(auto)), tradeFor(sessionId))
})

test('a choice that changes nothing, or names nothing that exists, returns the same save', () => {
  const save = playing('s1')
  assert.equal(setRoomTrade(save, { projectId: ROOM, trade: null }), save)
  assert.equal(setRoomTrade(save, { projectId: ROOM, trade: 'forge' }), save)
  assert.equal(setRoomTrade(save, { projectId: 'turbo-waffle', trade: 'mining' }), save)
  assert.equal(setCharacterTrade(save, { projectId: ROOM, sessionId: 'nobody', trade: 'mining' }), save)
  assert.equal(setCharacterTrade(save, { projectId: ROOM, sessionId: 's1', trade: 'gold' }), save)
  const out = excludeProject(save, ROOM)
  assert.equal(setRoomTrade(out, { projectId: ROOM, trade: 'mining' }), out)
})

test('a session that retires and comes back keeps the trade chosen for it', () => {
  const save = setCharacterTrade(playing('s1'), { projectId: ROOM, sessionId: 's1', trade: 'hunting' })
  const retired = engine.closeSession(save, { projectId: ROOM, sessionId: 's1', now: HOUR })
  assert.equal(project(retired).retirees[0].tradeChoice, 'hunting')
  const back = engine.applyTokens(retired, { projectId: ROOM, sessionId: 's1', tokens: 100_000, activity: 'write', now: 2 * HOUR })
  assert.equal(project(back).characters.s1.tradeChoice, 'hunting')
})

test('the choices survive the storage and a save file', () => {
  const room = setRoomTrade(playing('s1'), { projectId: ROOM, trade: 'mining' })
  const save = setCharacterTrade(room, { projectId: ROOM, sessionId: 's1', trade: 'farming' })
  const stored = migrate(JSON.parse(JSON.stringify(save)))
  assert.equal(project(stored).tradeChoice, 'mining')
  assert.equal(project(stored).characters.s1.tradeChoice, 'farming')
  const checked = cleanSave(stored)
  assert.equal(checked.ok, true)
  assert.equal(project(checked.save).tradeChoice, 'mining')
  assert.equal(project(checked.save).characters.s1.tradeChoice, 'farming')
})

test('a save from before trades could be chosen loads with Auto everywhere', () => {
  const save = JSON.parse(JSON.stringify(playing('s1')))
  delete project(save).tradeChoice
  delete project(save).characters.s1.tradeChoice
  const loaded = migrate(save)
  assert.equal(project(loaded).tradeChoice, null)
  const checked = cleanSave(loaded)
  assert.equal(checked.ok, true)
  assert.equal(project(checked.save).characters.s1.tradeChoice, null)
  assert.equal(engine.view(loaded).worlds[0].projects[0].party[0].trade, tradeFor('s1'))
})

test('a stored save with an unknown room trade loads with Auto', () => {
  const save = JSON.parse(JSON.stringify(playing('s1')))
  project(save).tradeChoice = 'gold'
  assert.equal(project(migrate(save)).tradeChoice, null)
})

test('a save file with a trade the game does not know is refused', () => {
  const room = JSON.parse(JSON.stringify(playing('s1')))
  project(room).tradeChoice = 'gold'
  assert.match(cleanSave(room).problem, /tradeChoice is not one the game knows/)
  const character = JSON.parse(JSON.stringify(playing('s1')))
  project(character).characters.s1.tradeChoice = 'forge'
  assert.match(cleanSave(character).problem, /s1\.tradeChoice is not one the game knows/)
})

test('the view gives each character its trade, its own choice and the game\'s pick, and the room\'s choice', () => {
  const sessionId = sessionNotOf('mining')
  const save = setRoomTrade(playing(sessionId), { projectId: ROOM, trade: 'mining' })
  const view = engine.view(save).worlds[0].projects[0]
  assert.equal(view.tradeChoice, 'mining')
  const [member] = view.party
  assert.deepEqual([member.trade, member.tradeChoice, member.autoTrade], ['mining', null, tradeFor(sessionId)])
  assert.ok(GATHERING_SKILLS.includes(member.autoTrade))
})

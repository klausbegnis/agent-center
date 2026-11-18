// The demo's traits: every room that plays gets a few trait scrolls in its chest, its first two
// characters are veterans (a day of demo play reaches level 9 or so, and the first extra slot
// opens at 10), and characters with more than one slot carry a taught trait or two with one slot
// left free, so the Party tab, the agent card, the Chest tab and a city's broker have something to
// show. The changes go in as an imported save would.
import { readFileSync } from 'node:fs'
import { indexTraits } from '../src/game/trait-content.mjs'
import { traitSlots, traitsOf } from '../src/game/trait-effects.mjs'

const traits = indexTraits(JSON.parse(readFileSync(new URL('../game/traits.json', import.meta.url), 'utf8')))

/** The scrolls each room keeps: a spread of tiers, one double-edged. */
const DEMO_SCROLLS = Object.freeze({ 'stout-arm': 2, 'patient-line': 1, 'iron-will': 1, 'scroll-hound': 1, hothead: 1, whirlwind: 1 })
/** Traits taught, in turn, to the characters that have room for them. */
const TAUGHT = Object.freeze(['sharpshooter', 'quick-study', 'field-medic', 'giant-slayer', 'tinkerer', 'bright-pupil'])

/** The levels the first characters of a room are given, so their extra slots show. */
const VETERAN_LEVELS = Object.freeze([22, 12])

/** A character's traits with taught ones added, keeping one slot free when it has more than one. */
function taughtTo(character, turn) {
  const carried = traitsOf(character, traits)
  const room = traitSlots(character.level) - carried.length - 1
  const added = TAUGHT.filter((id) => !carried.includes(id)).slice(turn % TAUGHT.length).slice(0, Math.max(0, room))
  return added.length ? { ...character, traits: [...carried, ...added] } : character
}

/**
 * Gives the demo's rooms their scrolls and characters, then a round with the clock where it is
 * links the agents again and earns nothing.
 *
 * @param {object} game the demo's game mode
 */
export async function showDemoTraits(game) {
  const file = await game.exportSave()
  let turn = 0
  for (const world of Object.values(file.save.worlds)) {
    for (const project of Object.values(world.projects)) {
      project.scrolls = { ...DEMO_SCROLLS }
      for (const [at, sessionId] of Object.keys(project.characters).sort().entries()) {
        const character = project.characters[sessionId]
        const level = Math.max(character.level, VETERAN_LEVELS[at] ?? 0)
        project.characters[sessionId] = taughtTo({ ...character, level }, turn)
        turn += 1
      }
    }
  }
  await game.importSave(file)
  await game.round()
}

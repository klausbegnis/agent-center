// How much legendary loot adds to a party, for the balance check: a trained party of four fights
// a day at a level with no legendary loot, then with the best set of legendary equipment held by
// the classes it is made for and each relic active in turn. The gain is in kills, which counts
// both harder hits and fewer rests. Run by `npm run simulate`.
import { REFERENCE_TOKENS_PER_MINUTE } from '../src/game/constants.mjs'
import { legendaryItemFor } from '../src/game/legendary-drops.mjs'
import { legendaryIndexOf } from '../src/game/legendary-effects.mjs'
import { trainedParty } from './game-balance.mjs'

const HOUR = 3_600_000
/** Fight time measured: three engine advances of eight hours. */
const HOURS = 24
/** The equipment each class holds in the full set: the strongest for a fight. */
const FULL_SET = {
  physical: ['labyrinth-cleaver', 'pale-duelists-coat'],
  magical: ['stormwing-staff'],
  defense: ['bridgewardens-maul', 'coldscale-hauberk'],
  support: ['vigil-censer', 'veil-of-the-regent']
}
const ROOM = 'fuzzy-anvil'

/** The party's room with each character holding its class's legendary items at its plain items' power. */
function withFullSet(save, index, relicId) {
  const world = save.worlds.main
  const project = world.projects[ROOM]
  let chest = [...project.chest]
  const characters = { ...project.characters }
  for (const character of Object.values(project.characters)) {
    const equipment = { ...character.equipment }
    for (const id of FULL_SET[character.class]) {
      const entry = index.byId.get(id)
      const replaced = chest.find((item) => item.id === equipment[entry.slot])
      const item = { ...legendaryItemFor(entry, 1), tier: replaced?.tier ?? 1, level: replaced?.level ?? 0, heldBy: character.sessionId }
      chest = chest.map((owned) => (owned.id === replaced?.id ? { ...owned, heldBy: null } : owned))
      chest.push(item)
      equipment[entry.slot] = item.id
    }
    characters[character.sessionId] = { ...character, equipment }
  }
  // Without a relic the room owns every pool relic with none active, so a boss's drop cannot
  // make one active; with one, a relic that drops stays inactive behind it.
  const relics = relicId ? [relicId] : index.poolRelicIds
  const legendary = { relics, active: relicId, relicPity: 0, bossPity: 0 }
  const room = { ...project, chest, characters, legendary }
  return { ...save, worlds: { main: { ...world, projects: { ...world.projects, [ROOM]: room } } } }
}

/** Kills over HOURS of the whole party working. */
function killsOf(engine, save) {
  const sessions = Object.keys(save.worlds.main.projects[ROOM].characters)
    .map((sessionId) => ({ projectId: ROOM, sessionId, state: 'working', tokensPerMinute: REFERENCE_TOKENS_PER_MINUTE }))
  let current = save
  let kills = 0
  for (let start = 0; start < HOURS; start += 8) {
    const moved = engine.advanceWithEvents(current, { from: start * HOUR, to: (start + 8) * HOUR, sessions })
    current = moved.save
    kills += moved.events.length
  }
  return kills
}

/**
 * The kills a party gains at a level with the full set and the best relic for a fight, against
 * none, and the relic that gives the most.
 *
 * @param {{ plain: object, loaded: object, content: object }} engines one without legendary content
 *   and one with it
 * @param {number} level
 */
export function legendaryGain({ plain, loaded, content }, level) {
  const index = legendaryIndexOf(content)
  const save = trainedParty(plain, level)
  const base = killsOf(plain, save)
  const equipmentOnly = killsOf(loaded, withFullSet(save, index, null))
  let best = { relicId: null, kills: equipmentOnly }
  for (const relicId of index.relicIds) {
    const kills = killsOf(loaded, withFullSet(save, index, relicId))
    if (kills > best.kills) best = { relicId, kills }
  }
  return { base, equipmentOnly, best, gain: best.kills / base - 1 }
}

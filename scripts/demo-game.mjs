// Game mode for the demo: a made-up session history for the demo's agents, so the game can be
// built and looked at without Orca. Every token count comes from a hash of the session id and
// the round, so a run always plays the same way.
//
// With the history, agents on this computer get a session each, found by their conversation
// title the way a real history is matched. Now and then an agent's session closes (its
// character retires) and a new one opens under the same title; agents on the paired machines
// join as guests. With the estimate, there is no history: each agent gets a made-up work meter
// (working time in game time, and tool calls on this computer only, as no hook reaches the
// plugin from a paired machine), as an Orca without session totals would, and agents on the
// paired machines are characters like the others.
import { createGameMode } from '../src/game-mode.mjs'
import { createGameSave } from '../src/game-save.mjs'
import { MARKET_DAY_MS } from '../src/game/constants.mjs'
import { hashOf } from '../src/game/hash.mjs'
import { hasRelicOnDay } from '../src/game/stall-relic.mjs'
import { DEFAULT_WORLD, SAVE_VERSION, emptyProject, emptySave, emptyWorld, migrate } from '../src/game/worlds.mjs'
import { showDemoChronicle } from './demo-achievements.mjs'
import { demoCityRanks, showDemoCityRanks } from './demo-city-ranks.mjs'
import { showDemoInstances } from './demo-instances.mjs'
import { showDemoRoad } from './demo-regions.mjs'
import { showDemoQuests } from './demo-quests.mjs'
import { DEMO_VILLAGE, showDemoSettlement } from './demo-settlement.mjs'
import { showDemoTraits } from './demo-traits.mjs'

/** Game time runs this many times faster than real time, so fights move on screen. */
const SPEED = 10
/** Real time between two rounds while the demo plays. */
const ROUND_MS = 3_000
/** A session closes after about this many rounds, and a new one opens for the same agent. */
const SESSION_ROUNDS = 120
/** Tokens a working agent spends per minute of game time, give or take half. */
const TOKENS_PER_MINUTE = 25_000
/** The frozen demo is this many rounds of play, about a working day of game time. */
const FROZEN_ROUNDS = 1_200
/** A fixed start, so the frozen demo is the same on every machine. */
const EPOCH = Date.UTC(2026, 0, 5, 9)
const LOCAL = 'local'
/** Sessions listed per reading, like the worker asks Orca for. */
const HISTORY_LIMIT = 200
/** Tool calls a working agent starts per minute of game time, give or take half. */
const TOOL_CALLS_PER_MINUTE = 3.75
const MINUTE_MS = 60_000

/**
 * A room no longer on screen that left its chest and retirees in the main world, so the Chest tab's
 * "Chests left behind" card has something to show. The demo's fuzzy-anvil room is on build-box;
 * this one is an older checkout of it on this computer.
 */
const LEFT_BEHIND = 'local:/work/fuzzy-anvil'
/** Coins the demo's world starts with: enough for one piece of a stall, not for all of them. */
const MARKET_COINS = 70_000
/**
 * The room that shows legendary loot from the start: three relics with Rimeheart active, and a
 * legendary weapon in its chest that its Fighter takes, so the Arsenal, the item detail, the agent
 * card and the room's band all have something to show.
 */
const LEGENDARY_ROOM = 'local:/work/rumble-banana'
/**
 * The room that meets its first boss soon after the live demo starts: its first boss always
 * leaves a relic, so the celebration plays without waiting for a legendary boss. Its weapons are
 * upgraded enough that a party of a fresh world beats that boss in a few minutes.
 */
const FIRST_BOSS_ROOM = 'local:/work/sneaky-pancake'
const FIRST_BOSS_WEAPON_LEVEL = 14

/** A room's starter chest, as a new room gets it, with the extra items given, weapons at `level`. */
function starterChest(item, extra, level = 0) {
  const physical = { damageType: 'physical' }
  return [
    item('whittled-cudgel', 'weapon', 1, ['logs', 'bars'], level, physical),
    { ...item('whittled-cudgel', 'weapon', 1, ['logs', 'bars'], level, physical), id: 'whittled-cudgel-2' },
    { ...item('whittled-cudgel', 'weapon', 1, ['logs', 'bars'], level, physical), id: 'whittled-cudgel-3' },
    item('ashwood-wand', 'weapon', 1, ['logs', 'crystals'], level, { damageType: 'magical' }),
    item('padded-jerkin', 'outfit', 1, ['hides', 'crops'], 0),
    item('trusty-pocketknife', 'tool', 1, ['ore', 'logs'], 0),
    ...extra
  ]
}

/**
 * The stored game the demo starts from: empty but for the room left behind, the room with
 * legendary loot and, in the live demo, a room about to meet its first boss, with "new scene
 * after each monster" on when asked, so even the first monsters fit their rooms' scenes.
 */
function startingSave(travel, frozen) {
  const item = (id, slot, tier, recipe, level, extra = {}) =>
    ({ id, entryId: id, slot, ...extra, tier, recipe, level, heldBy: null })
  const save = emptySave()
  save.worlds.main = {
    ...emptyWorld(),
    // Coins from earlier sales, and prices still moved by them, so the Market tab has something
    // to show: Deepforge was sold ore, Goldmill was bought out of fish.
    coins: MARKET_COINS,
    market: { clock: null, pressure: { deepforge: { ore: 1.2 }, goldmill: { fish: -1.4 } }, sold: {} },
    projects: {
      [LEFT_BEHIND]: {
        ...emptyProject({ wave: 4 }),
        chest: [
          item('tempered-shortsword', 'weapon', 3, ['bars', 'hides'], 2, { damageType: 'physical' }),
          item('inscribed-codex', 'weapon', 3, ['pages', 'runes'], 1, { damageType: 'magical' }),
          item('padded-jerkin', 'outfit', 1, ['hides', 'crops'], 4),
          item('trusty-pocketknife', 'tool', 1, ['ore', 'logs'], 3)
        ],
        retiredCount: 7
      },
      [LEGENDARY_ROOM]: {
        ...emptyProject(),
        chest: starterChest(item, [
          item('oathbreaker', 'weapon', 1, ['bars', 'seals'], 1, { damageType: 'physical', legendary: true })
        ]),
        legendary: {
          relics: ['tidecall-conch', 'rimeheart', 'cogheart-of-the-ninth-shaft'],
          active: 'rimeheart',
          relicPity: 0,
          bossPity: 0
        }
      },
      ...(frozen ? {} : { [FIRST_BOSS_ROOM]: { ...emptyProject({ wave: 10 }), chest: starterChest(item, [], FIRST_BOSS_WEAPON_LEVEL) } })
    }
  }
  return { version: 1, save, bridge: { travel } }
}

/**
 * The frozen demo's bestiary. A day of play meets every race, so the frozen world's book is set to
 * one of weeks of play instead: twelve races met at levels from 1 to 20, slimes past their
 * powered levels with the title "Slime-scourer II", eight still unknown, and a dozen bosses beaten, among them the owner of the legendary room's Rimeheart, so
 * its card shows the item found. Kills by rank, then the game day of the first.
 */
function demoBestiary(day) {
  const race = (normal, veteran, elite, champion, boss, legendary, daysAgo) =>
    [normal, veteran, elite, champion, boss, legendary, day - daysAgo]
  const boss = (beaten, legendary, daysAgo) => [beaten, legendary, day - daysAgo]
  return {
    races: {
      slime: race(7600, 410, 210, 45, 2, 150, 61),
      goblin: race(520, 105, 52, 12, 3, 1, 61),
      orc: race(140, 28, 14, 3, 2, 0, 60),
      skeleton: race(88, 17, 9, 2, 1, 0, 58),
      human: race(46, 9, 4, 1, 1, 0, 55),
      troll: race(30, 6, 3, 1, 1, 0, 52),
      spider: race(24, 4, 2, 0, 0, 0, 47),
      dragon: race(11, 2, 1, 0, 1, 1, 40),
      werewolf: race(9, 2, 1, 0, 0, 0, 31),
      insect: race(6, 1, 0, 0, 0, 0, 20),
      golem: race(3, 0, 1, 0, 0, 0, 9),
      treant: race(1, 0, 0, 0, 0, 0, 0)
    },
    bosses: {
      skrix: boss(3, 1, 60),
      grubbin: boss(2, 0, 55),
      'old-hessa': boss(2, 0, 50),
      'corwen-ashby': boss(1, 0, 46),
      morvash: boss(2, 1, 41),
      thruska: boss(1, 0, 37),
      'mother-skein': boss(1, 0, 30),
      vorzhaal: boss(1, 1, 24),
      brakkus: boss(1, 0, 18),
      ossric: boss(1, 0, 12),
      'queen-zarra': boss(1, 0, 6),
      'old-rusk': boss(1, 0, 1)
    },
    others: race(64, 12, 6, 1, 1, 0, 61),
    // Its one back-fill is done: the rooms' kills are all in it already.
    filled: 0
  }
}

/**
 * Gives the frozen world the bestiary above. It goes in as an imported save would, then a round
 * with the clock where it is links the agents again and earns nothing.
 */
async function showDemoBestiary(game, now) {
  const file = await game.exportSave()
  file.save.worlds.main.bestiary = demoBestiary(Math.floor(now / MARKET_DAY_MS))
  await game.importSave(file)
  await game.round()
}

/** A swing between 0.5 and 1.5, from a hash. */
const swingOf = (key) => 0.5 + (hashOf(key) % 1000) / 1000

/** Made-up work meters for every agent, the estimate's stand-in for the store's. */
function createMeters(store) {
  const meters = new Map()
  let round = 0

  /** Moves the meters one round forward with the agents' states as the store has them. */
  function step(now, minutes) {
    round += 1
    for (const room of store.snapshot().rooms) {
      const isPaired = (room.host ?? LOCAL) !== LOCAL
      for (const agent of room.agents) {
        if (agent.parentId) continue
        if (!meters.has(agent.id)) {
          meters.set(agent.id, { startedAt: now, workedMs: {}, toolCalls: 0, calls: 0, attributedMs: {}, callsBy: {} })
        }
        const meter = meters.get(agent.id)
        if (agent.state !== 'working') continue
        const ms = minutes * MINUTE_MS
        const add = (record, key, amount) => (record[key] = (record[key] ?? 0) + amount)
        add(meter.workedMs, agent.activity, ms)
        // Shared the way the store's meter shares it: a paired machine's time is unknown, a local
        // agent's follows its tool with a quarter for thinking.
        if (isPaired) {
          add(meter.attributedMs, 'unknown', ms)
          continue
        }
        add(meter.attributedMs, 'think', ms / 4)
        add(meter.attributedMs, agent.activity, (ms * 3) / 4)
        // Fractions of a call carry over, so a slow agent still makes one now and then.
        meter.calls += TOOL_CALLS_PER_MINUTE * minutes * swingOf(`${agent.id}|${round}`)
        const calls = Math.floor(meter.calls)
        add(meter.callsBy, agent.activity, calls - meter.toolCalls)
        meter.toolCalls = calls
      }
    }
  }

  return {
    step,
    read: () => Object.fromEntries([...meters].map(([agentId, { startedAt, workedMs, toolCalls, attributedMs, callsBy }]) =>
      [agentId, { startedAt, workedMs: { ...workedMs }, toolCalls, attributedMs: { ...attributedMs }, callsBy: { ...callsBy } }]))
  }
}

/** One made-up session per local agent, numbered by how many the agent had before. */
function createHistory(store) {
  const sessions = new Map()
  const generations = new Map()
  let round = 0

  const sessionIdOf = (agentId) => `demo-${agentId}-${generations.get(agentId) ?? 0}`

  /** Moves the history one round forward with the agents' states as the store has them. */
  function step(now, minutes) {
    round += 1
    for (const room of store.snapshot().rooms) {
      if ((room.host ?? LOCAL) !== LOCAL) continue
      for (const agent of room.agents) {
        if (agent.parentId) continue
        let sessionId = sessionIdOf(agent.id)
        let session = sessions.get(sessionId)
        const isOld = session && (round + (hashOf(agent.id) % SESSION_ROUNDS)) % SESSION_ROUNDS === 0
        if (isOld) {
          session.running = false
          generations.set(agent.id, (generations.get(agent.id) ?? 0) + 1)
          sessionId = sessionIdOf(agent.id)
          session = undefined
        }
        if (!session) {
          session = { sessionId, title: agent.title, workspaceId: agent.workspaceId, totalTokens: 0, createdAt: now, running: true }
          sessions.set(sessionId, session)
        }
        if (agent.state !== 'working') continue
        session.totalTokens += Math.round(TOKENS_PER_MINUTE * minutes * swingOf(`${sessionId}|${round}`))
      }
    }
  }

  return {
    step,
    /** The newest sessions first, as Orca lists them. */
    read: () => {
      const newest = [...sessions.values()].reverse()
      const listed = newest.slice(0, HISTORY_LIMIT).map((session) => ({ ...session }))
      return { ok: true, sessions: listed, truncated: newest.length > HISTORY_LIMIT }
    }
  }
}

/** The frozen demo's day: days after its usual one until Goldmill's stall has a relic on offer. */
const RELIC_CITY = 'goldmill'

/** How many days the frozen demo starts later, so the day it shows has a relic on Goldmill's stall. */
function relicDaysAhead() {
  const lastDay = Math.floor((EPOCH + FROZEN_ROUNDS * ROUND_MS * SPEED) / MARKET_DAY_MS)
  let ahead = 0
  while (!hasRelicOnDay({ worldId: DEFAULT_WORLD, cityId: RELIC_CITY, day: lastDay + ahead })) ahead += 1
  return ahead
}

/**
 * The demo's game: a game mode over an in-memory storage and the made-up history.
 *
 * @param {{ engine: object, store: object, preferences: object, onChange: () => void, frozen: boolean,
 *   estimated?: boolean, travel?: boolean, listThemeIds?: () => string[],
 *   settlementLevels?: Record<string, number> | null, cityRank?: number | null }} options `estimated` plays without a session
 *   history, on the estimate; `travel` turns on "new scene after each monster" over the themes
 *   `listThemeIds` lists; `settlementLevels` gives the world those building levels (the frozen demo
 *   has a Village otherwise); `cityRank` puts every city at that rank (the frozen demo has a mix otherwise)
 * @returns {Promise<ReturnType<typeof createGameMode>>}
 */
export async function createDemoGame(options) {
  const { engine, preferences, onChange, frozen, estimated = false, travel = false, listThemeIds } = options
  const { settlementLevels = null, instanceVault = false, cityRank = null, instanceRoad = null, questsDone = false } = options
  let { store } = options
  const startedAt = Date.now()
  let frozenClock = frozen ? EPOCH + relicDaysAhead() * MARKET_DAY_MS : EPOCH
  const now = () => (frozen ? frozenClock : EPOCH + (Date.now() - startedAt) * SPEED)
  const values = new Map([['game', startingSave(travel, frozen)]])
  const settings = { gameMode: true, gameKeepTitles: true }
  // The frozen scene never changes, so an agent that waits or is blocked in it would have kept
  // its room's party on hold for the whole made-up day. Until the last rounds those agents
  // count as working: the day before they got stuck.
  let isDayBefore = false
  const STUCK = new Set(['waiting', 'blocked'])
  const unstuck = (agent) => (STUCK.has(agent.state) ? { ...agent, state: 'working' } : agent)
  const liveStore = store
  store = Object.assign(Object.create(liveStore), {
    snapshot: () => {
      const snapshot = liveStore.snapshot()
      if (!isDayBefore) return snapshot
      return { ...snapshot, rooms: snapshot.rooms.map((room) => ({ ...room, agents: room.agents.map(unstuck) })) }
    }
  })
  const history = createHistory(store)
  const meters = createMeters(store)
  let lastStepAt = now()
  /** Moves the made-up history or meters to now. */
  const step = (source) => {
    const at = now()
    source.step(at, (at - lastStepAt) / 60_000)
    lastStepAt = at
    return source.read()
  }
  const game = createGameMode({
    engine,
    gameSave: createGameSave({
      storage: { get: async (key) => values.get(key) ?? null, set: async (key, value) => values.set(key, value) },
      migrate,
      saveVersion: SAVE_VERSION,
      log: console.error
    }),
    readSettings: async () => settings,
    writeSetting: async (key, value) => {
      settings[key] = value
    },
    access: () => ({ supported: !estimated, granted: !estimated }),
    readHistory: async () => step(history),
    readWorkspaces: async () => [],
    readWorkMeters: () => step(meters),
    store,
    preferences,
    listThemeIds,
    now,
    log: console.error,
    onChange
  })

  if (frozen) {
    // A day of play, spending now and then, then the last hours without spending so the
    // materials pile up for the screenshot.
    for (let round = 0; round < FROZEN_ROUNDS; round++) {
      isDayBefore = round < FROZEN_ROUNDS - 2
      if (round === 1) await game.setAutoSpend(true)
      if (round === FROZEN_ROUNDS - 240) await game.setAutoSpend(false)
      frozenClock += ROUND_MS * SPEED
      await game.round()
    }
    await showDemoBestiary(game, frozenClock)
    await showDemoSettlement(game, settlementLevels ?? DEMO_VILLAGE)
    await showDemoInstances(game, { vault: instanceVault })
    await showDemoCityRanks(game, demoCityRanks(cityRank))
    await showDemoTraits(game)
    await showDemoChronicle(game, { now: frozenClock, titleRoom: LEGENDARY_ROOM })
    if (instanceRoad) await showDemoRoad(game, instanceRoad)
    await showDemoQuests(game, { allDone: questsDone })
    return game
  }
  await game.round()
  if (settlementLevels) await showDemoSettlement(game, settlementLevels)
  if (instanceVault) await showDemoInstances(game, { vault: true })
  if (cityRank !== null) await showDemoCityRanks(game, demoCityRanks(cityRank))
  await showDemoTraits(game)
  await showDemoChronicle(game, { now: now(), titleRoom: LEGENDARY_ROOM })
  if (instanceRoad) await showDemoRoad(game, instanceRoad)
  // The live demo plays its quests from where the made-up day leaves them; QUESTS=done shows them done.
  if (questsDone) await showDemoQuests(game, { allDone: true })
  setInterval(() => game.round(), ROUND_MS)
  return game
}

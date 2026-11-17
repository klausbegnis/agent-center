// A room's run through an instance over some ticks of working time, played room by room: fights
// with the same combat as the waves (combat.mjs, fight.mjs), the trap's or puzzle's check, the
// vault's boons, retries and the end of the run. What a clear and the vault pay is
// instance-rewards.mjs. Pure; works on a copy of the project and returns it.
import { bestiaryIndexOf } from './bestiary-content.mjs'
import { noteKill } from './bestiary.mjs'
import { fightTick, rewardFor } from './combat.mjs'
import { HITS_TO_KILL, REST_SECONDS, TICK_SECONDS } from './constants.mjs'
import { addDrop, droppedEntry } from './drops.mjs'
import { partyAgainst } from './fight.mjs'
import { chanceOf, hashOf } from './hash.mjs'
import { BOONS_OFFERED } from './instance-boons.mjs'
import {
  CHECK_ROLL_LOW,
  CHECK_ROLL_SPAN,
  INSTANCE_CHECK_BONUS_KILLS,
  INSTANCE_CHECK_DIFFICULTY,
  INSTANCE_CHECK_TIER_STEP,
  INSTANCE_PUZZLE_RETRY_TICKS,
  INSTANCE_TRAP_STAMINA,
  INSTANCE_TRIES,
  INSTANCE_TRY_SLACK,
  INSTANCE_VAULT_WAIT_TICKS
} from './instance-constants.mjs'
import { instanceIndexOf } from './instance-content.mjs'
import { fightsIn, instanceMonster, roomHealthShare, runLevel } from './instance-monsters.mjs'
import { clearRewards, vaultLoot } from './instance-rewards.mjs'
import { leaveInstance, runContext, withBoon } from './instance-run.mjs'
import { withKillMaterials } from './legendary-effects.mjs'
import { rankOf } from './monsters.mjs'
import { referenceAttributes } from './power.mjs'
import { effectiveLevel, emptySkill } from './progression.mjs'
import { CLASSES } from './skills.mjs'
import { campfireShare, groupLevel } from './spending.mjs'
import { addMaterials } from './worlds.mjs'

const REST_TICKS = Math.ceil(REST_SECONDS / TICK_SECONDS)

/** The text every roll of a run's room starts with, so each run, room and fight rolls anew. */
const seedOf = (context, run, fight = run.fight) =>
  `${context.worldId}|${context.projectId}|${run.instance}|${run.attempt}|${run.room}|${fight}`

/** An event of the run, with what the bridge needs to tell it. */
function tell(context, run, fields) {
  context.events.push({ type: 'instance', projectId: context.projectId, instance: run.instance, tier: run.tier, room: run.room, ...fields })
}

/** The ticks a try at a room may last, rests included (INSTANCE_TRY_SLACK). */
function roomTimeLimit(context, run) {
  const { room, bonuses } = runContext(run, context.index)
  const share = roomHealthShare(room.kind, bonuses, (fight) => seedOf(context, run, fight))
  return Math.ceil(INSTANCE_TRY_SLACK * HITS_TO_KILL * share * bonuses.timeFactor)
}

/** A rest's ticks in the run: the party's own, times what the boon and the modifier make of it. */
const restTicksOf = (context, run) =>
  Math.max(1, Math.ceil((context.party.legendary?.restTicks ?? REST_TICKS) * runContext(run, context.index).bonuses.restFactor))

/** The run moves to its next room. */
function nextRoom(state, context) {
  const run = state.run
  tell(context, run, { kind: 'room' })
  state.run = { ...run, room: run.room + 1, fight: 0, tries: 0, tryTicks: 0, waitTicks: 0 }
  state.monster = null
}

/** The run is over: the room goes back to its waves; what was found is kept. */
function endRun(state, context, outcome) {
  const { materials } = state
  tell(context, state.run, { kind: outcome, found: state.run.found, ticks: state.run.ticks })
  const back = leaveInstance({ ...state, materials: undefined }, { cleared: outcome === 'cleared' })
  for (const key of Object.keys(state)) delete state[key]
  Object.assign(state, back, { materials })
}

/** A failed try: the run ends after the last one, otherwise the party rests and starts the room over. */
function failTry(state, context) {
  const run = state.run
  const tries = run.tries + 1
  if (tries >= INSTANCE_TRIES + runContext(run, context.index).bonuses.tries) return endRun(state, context, 'failed')
  tell(context, run, { kind: 'retry', tries })
  state.run = { ...run, tries, fight: 0, tryTicks: 0 }
  state.monster = null
  state.restTicks = restTicksOf(context, run)
  state.fightTicks = 0
}

/** Materials of the run's level worth `kills` plain kills, split by the instance's loot. */
function runMaterials(context, run, kills, seed) {
  const { instance } = runContext(run, context.index)
  const level = runLevel(context.worldLevel, run.tier)
  return rewardFor({ level, reward: kills, loot: instance.loot, dropFactor: 0 }, { luck: 0, seed }).materials
}

/** Adds materials to what the advance pays the world and to what the run found. */
function addFound(state, materials) {
  state.materials = addMaterials(state.materials, materials)
  state.run = { ...state.run, found: { ...state.run.found, materials: addMaterials(state.run.found.materials, materials) } }
}

/**
 * The party's score at a check: for an attribute its best character's against a reference
 * character's of the world level (the mean of the four classes), for a work skill the world's
 * effective level of it against the world level. 1 is the reference.
 */
export function checkScore(check, { characters, skills, worldLevel }) {
  if (check.skill) return effectiveLevel(skills[check.skill] ?? emptySkill()) / Math.max(1, worldLevel)
  const best = Math.max(0, ...characters.map((character) => character.attributes?.[check.attribute] ?? 0))
  const reference = CLASSES.reduce((sum, className) => sum + referenceAttributes(className, worldLevel)[check.attribute], 0) / CLASSES.length
  return best / Math.max(1, reference)
}

/** A trap or a puzzle: a check passed finds materials; a trap sprung costs stamina, a puzzle a try. */
function settleCheck(state, context) {
  const run = state.run
  const { room, bonuses } = runContext(run, context.index)
  const score = checkScore(room.check, {
    characters: Object.values(state.characters), skills: context.world.skills, worldLevel: context.worldLevel
  })
  const difficulty = INSTANCE_CHECK_DIFFICULTY * (1 + INSTANCE_CHECK_TIER_STEP * (run.tier - 1)) * bonuses.checkFactor
  const roll = CHECK_ROLL_LOW + CHECK_ROLL_SPAN * chanceOf(`check-${run.tries}|${seedOf(context, run)}|check`)
  const passed = score >= difficulty * roll
  tell(context, run, { kind: 'check', passed, check: room.check })
  if (passed) {
    addFound(state, runMaterials(context, run, INSTANCE_CHECK_BONUS_KILLS, `${seedOf(context, run)}|check-find`))
    return nextRoom(state, context)
  }
  if (room.kind === 'trap') {
    state.stamina = Math.max(0, state.stamina - INSTANCE_TRAP_STAMINA)
    return nextRoom(state, context)
  }
  const tries = run.tries + 1
  if (tries >= INSTANCE_TRIES + bonuses.tries) return endRun(state, context, 'failed')
  state.run = { ...run, tries, waitTicks: INSTANCE_PUZZLE_RETRY_TICKS }
}

/** Two different boons of the pool, by hash of the run. */
export function boonsOffered(index, seed) {
  const pool = index.boons.map((boon) => boon.id)
  const first = hashOf(`${seed}|boon`) % pool.length
  const rest = pool.filter((_, at) => at !== first)
  return [pool[first], ...(rest.length ? [rest[hashOf(`${seed}|boon-2`) % rest.length]] : [])].slice(0, BOONS_OFFERED)
}

/** The boon is taken: the person's, or the first offered when auto-play is on or the wait is over. */
function takeBoon(state, context, boonId, chosenBy) {
  tell(context, state.run, { kind: 'boon', boon: boonId, chosenBy })
  Object.assign(state, withBoon(state, boonId, context.index))
}

/** The vault: loot now and a choice of boons; it waits for a person only so long. */
function settleVault(state, context) {
  const run = state.run
  if (!run.offered) {
    const offered = boonsOffered(context.index, seedOf(context, run))
    state.run = { ...run, offered, waitTicks: 0 }
    vaultLoot(state, context, seedOf(context, run))
    tell(context, state.run, { kind: 'vault', offered, legendary: state.run.found.legendary })
    if (!context.autoPlay) return
  }
  if (context.autoPlay) return takeBoon(state, context, state.run.offered[0], 'auto')
  if (state.run.waitTicks >= INSTANCE_VAULT_WAIT_TICKS) takeBoon(state, context, state.run.offered[0], 'wait')
}

/** A fighting room's next monster, measured against the working party. */
function spawn(state, context) {
  const run = state.run
  const { instance, room, bonuses } = runContext(run, context.index)
  state.monster = instanceMonster({
    instance,
    roomKind: room.kind,
    seed: seedOf(context, run),
    level: runLevel(context.worldLevel, run.tier),
    partySize: context.party.size,
    bonuses,
    content: context.content,
    referencePartyHit: context.referencePartyHit
  })
}

/**
 * What happens without a tick of time passing, as long as something does: a check is rolled, the
 * vault opens or its boon is taken, a fighting room brings out its monster.
 *
 * @returns {boolean} whether anything changed
 */
function settleInstant(state, context) {
  const run = state.run
  if (!run) return false
  const { room } = runContext(run, context.index)
  if (room.kind === 'trap' || room.kind === 'puzzle') {
    if (run.waitTicks > 0) return false
    settleCheck(state, context)
    return true
  }
  if (room.kind === 'vault') {
    const before = state.run
    settleVault(state, context)
    return state.run !== before
  }
  if (state.monster) return false
  spawn(state, context)
  return true
}

/** A kill in the run: the waves' reward, drop and bestiary count, then the next fight or room. */
function settleRunKill(state, context) {
  const run = state.run
  const { room, bonuses } = runContext(run, context.index)
  const { monster } = state
  const seed = `${seedOf(context, run)}|kill`
  const loot = context.party.legendary
  const reward = rewardFor(monster, { luck: context.party.luck, seed, dropBonus: loot?.itemDrop ?? 0 })
  let materials = withKillMaterials(reward.materials, loot?.killMaterials ?? [])
  const entry = reward.itemDrop ? droppedEntry(context.content.items, { level: monster.level, themeId: state.themeId, seed }) : null
  if (entry) {
    const dropped = addDrop(state.chest, entry, context.worldLevel)
    state.chest = dropped.chest
    materials = addMaterials(materials, dropped.salvage)
  }
  addFound(state, materials)
  const noted = noteKill(context.tally.bestiary, monster, { day: context.day, index: bestiaryIndexOf(context.content) })
  context.tally.bestiary = noted.bestiary
  context.events.push({
    type: 'kill', projectId: context.projectId, wave: run.frozen.wave, kind: monster.kind, rank: rankOf(monster),
    affix: monster.affix, ticks: state.fightTicks, rested: state.fightRested, materials, item: entry?.id ?? null,
    instance: run.instance, ...(noted.news.length ? { bestiary: noted.news } : {})
  })
  if (!bonuses.noCampfire) {
    state.stamina += (1 - state.stamina) * campfireShare(groupLevel(context.world.upgrades, 'campfire'))
    state.stamina = Math.min(1, state.stamina + (loot?.staminaPerKill ?? 0))
  }
  state.kills = (state.kills ?? 0) + 1
  state.fightTicks = 0
  state.fightRested = false
  state.monster = null
  state.run = { ...state.run, fight: run.fight + 1, found: { ...state.run.found, kills: state.run.found.kills + 1 } }
  if (room.kind === 'boss') {
    clearRewards(state, context, { monster, seed })
    return endRun(state, context, 'cleared')
  }
  if (state.run.fight >= fightsIn(room.kind, bonuses)) nextRoom(state, context)
}

/** One tick of a fighting room: rest, or strike and be struck, then the room's time. */
function fightRoomTick(state, context) {
  const run = state.run
  const { room, bonuses } = runContext(run, context.index)
  state.run = { ...run, tryTicks: run.tryTicks + 1 }
  state.fightTicks += 1
  if (state.restTicks > 0) {
    state.restTicks -= 1
    if (state.restTicks === 0) state.stamina = 1
  } else {
    const against = context.against(state.monster.level)
    const isBoss = room.kind === 'boss'
    const plain = context.party.hitsAgainst?.(state.monster) ?? context.party.hits
    const factor = isBoss ? 1 + bonuses.bossDamage : 1
    const legendary = context.party.legendary ?? {}
    const result = fightTick({
      monster: state.monster,
      hits: { physical: plain.physical * factor, magical: plain.magical * factor },
      defenders: against.defenders,
      supporters: against.supporters,
      stamina: state.stamina * against.maxStamina,
      maxStamina: against.maxStamina,
      legendary: { ...legendary, drainFactor: (legendary.drainFactor ?? 1) * (isBoss ? 1 - bonuses.bossAttack : 1) }
    })
    state.stamina = result.stamina / against.maxStamina
    state.monster = result.monster
    if (result.killed) return settleRunKill(state, context)
    if (result.exhausted) {
      state.restTicks = restTicksOf(context, run)
      state.fightRested = true
    }
  }
  if (state.run.tryTicks >= roomTimeLimit(context, state.run)) failTry(state, context)
}

/** One tick of working time in the run, in whatever room it is. */
function runTick(state, context) {
  state.run = { ...state.run, ticks: state.run.ticks + 1 }
  const { room } = runContext(state.run, context.index)
  if (room.kind === 'vault') {
    state.run = { ...state.run, waitTicks: state.run.waitTicks + 1 }
    return
  }
  if (room.kind === 'trap' || room.kind === 'puzzle') {
    state.run = { ...state.run, waitTicks: Math.max(0, state.run.waitTicks - 1) }
    return
  }
  fightRoomTick(state, context)
}

/**
 * Plays a room's run for some ticks of working time. A run that ends gives the ticks left back,
 * for the room's waves.
 *
 * @param {object} options as playFight's (fight.mjs), with `autoPlay`: the first boon is taken at once
 * @returns {{ project: object, materials: Record<string, number>, events: object[], bestiary: object | null,
 *   instances: object | undefined, coins: number, ticksLeft: number }} `instances` the world's progress
 *   after it, `coins` what it paid the world
 */
export function playRun(options) {
  const { worldId, projectId, project, world, worldLevel, party, ticks, content, referencePartyHit } = options
  const index = instanceIndexOf(content)
  // A run of an instance this content does not have (content changed under a save) just ends.
  if (!index?.byId.has(project.run.instance)) {
    return { project: leaveInstance(project, { cleared: true }), materials: {}, coins: 0, events: [], bestiary: null, instances: undefined, ticksLeft: ticks }
  }
  const tally = { bestiary: world.bestiary ?? null, instances: world.instances, coins: 0 }
  const cache = new Map()
  const against = (level) => {
    if (!cache.has(level)) cache.set(level, partyAgainst(party, level))
    return cache.get(level)
  }
  const context = {
    worldId, projectId, world, worldLevel, party, content, referencePartyHit, index, tally, against,
    day: options.day ?? 0, autoPlay: options.autoPlay === true, events: []
  }
  const state = { ...project, materials: {} }
  let used = 0
  while (state.run && used < ticks) {
    if (settleInstant(state, context)) continue
    runTick(state, context)
    used += 1
  }
  // What needs no time is settled too, so the room shows its monster or its vault at once.
  while (state.run && settleInstant(state, context));
  const { materials, ...next } = state
  return {
    project: next, materials, coins: tally.coins, events: context.events, bestiary: tally.bestiary, instances: tally.instances,
    ticksLeft: ticks - used
  }
}


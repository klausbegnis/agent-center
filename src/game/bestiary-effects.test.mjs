import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { indexBestiary } from './bestiary-content.mjs'
import { bestiaryEffects, hunterEffects, raceMasteryEffects, rankEffects, worldEffectsOf } from './bestiary-effects.mjs'
import { pointsForLevel } from './bestiary-ladder.mjs'
import { LEGENDARY_EFFECT_CAPS, RELIC_CHANCE, RELIC_PITY_STEP } from './constants.mjs'
import { partyOf } from './fight.mjs'
import { chanceOf } from './hash.mjs'
import { rollLegendaryDrops } from './legendary-drops.mjs'
import { legendaryIndexOf, memberBonuses, partyBonuses, tokenBonuses, totalOf, upgradeDiscountOf } from './legendary-effects.mjs'
import { WORK_SKILLS } from './skills.mjs'

const readJson = (name) => JSON.parse(readFileSync(new URL(`../../game/${name}`, import.meta.url), 'utf8'))
const content = {
  items: readJson('items.json'),
  legendary: readJson('legendary.json'),
  bosses: readJson('bosses.json'),
  bestiary: readJson('bestiary.json')
}
const index = indexBestiary(content.bestiary, content.bosses)
const legendary = legendaryIndexOf(content)
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`)
const amountOf = (effects, type) => effects.filter((effect) => effect.effect === type).reduce((sum, effect) => sum + effect.amount, 0)

/** A race counter with `kills` normal kills. */
const kills = (count) => [count, 0, 0, 0, 0, 0, 20_000]
/** A bestiary with every boss of the roster beaten once, so the hunter is at its top. */
const allBosses = () => Object.fromEntries(content.bosses.bosses.map((boss) => [boss.id, [1, 0, 20_000]]))
/** A race counter whose plain kills reach a level of its ladder exactly. */
const atLevel = (raceId, level) => kills(pointsForLevel(index.races.get(raceId).ladder, level))
/** The bestiary far past every race's last powered level, every boss beaten and the rank far up. */
const maxed = () => ({
  races: Object.fromEntries(index.raceIds.map((raceId) => [raceId, kills(1e9)])),
  bosses: allBosses()
})

test('a race gives nothing before its first level, then damage against it at every powered level', () => {
  assert.deepEqual(raceMasteryEffects(index, 'orc', 0), [])
  assert.deepEqual(raceMasteryEffects(index, 'orc', 1), [{ effect: 'raceDamage', scope: 'world', amount: 0.002, races: ['orc'] }])
  close(amountOf(raceMasteryEffects(index, 'orc', 25), 'raceDamage'), 0.05)
})

test('past the last powered level a race gives nothing more: prestige is only a mark', () => {
  assert.deepEqual(raceMasteryEffects(index, 'goblin', 40), raceMasteryEffects(index, 'goblin', 25))
})

test('a race\'s perk comes every fifth level, once for each one reached', () => {
  assert.equal(amountOf(raceMasteryEffects(index, 'goblin', 4), 'itemDrop'), 0)
  close(amountOf(raceMasteryEffects(index, 'goblin', 5), 'itemDrop'), 0.008)
  close(amountOf(raceMasteryEffects(index, 'goblin', 9), 'itemDrop'), 0.008)
  close(amountOf(raceMasteryEffects(index, 'goblin', 25), 'itemDrop'), 0.04)
})

test('the hunter rank\'s bonus grows ever slower and never reaches its amount', () => {
  assert.deepEqual(rankEffects(index, 0), [])
  close(amountOf(rankEffects(index, 20), 'killMaterials'), 0.01)
  assert.ok(amountOf(rankEffects(index, 1000), 'killMaterials') < 0.02)
  assert.ok(amountOf(rankEffects(index, 2), 'killMaterials') > amountOf(rankEffects(index, 1), 'killMaterials'))
})

test('the boss hunter gives the effects of every level reached, from the first boss', () => {
  assert.deepEqual(hunterEffects(index, 0), [])
  close(totalOf(hunterEffects(index, 1), 'damage', (effect) => effect.ranks.includes('boss')), 0.005)
  const top = hunterEffects(index, 5)
  close(amountOf(top, 'legendaryPity'), 0.5)
  close(totalOf(top, 'damage', (effect) => effect.ranks.includes('boss')), 0.015)
})

test('a world\'s effects follow its counters: points of a race, all points and distinct bosses', () => {
  const bestiary = { races: { slime: atLevel('slime', 5), orc: kills(1) }, bosses: { skrix: [3, 1, 20_000] } }
  const effects = bestiaryEffects(bestiary, index)
  assert.deepEqual(effects.filter((effect) => effect.effect === 'raceDamage').map((effect) => effect.races), [['slime']])
  const rank = amountOf(rankEffects(index, 1), 'killMaterials')
  close(amountOf(effects, 'killMaterials'), 0.004 + rank)
  assert.equal(amountOf(effects, 'legendaryPity'), 0)
  close(totalOf(effects, 'damage', (effect) => effect.ranks?.includes('boss')), 0.005)
  assert.deepEqual(worldEffectsOf({ bestiary }, content), effects)
  assert.deepEqual(worldEffectsOf({}, content), [])
  assert.deepEqual(worldEffectsOf({ bestiary }, { items: content.items }), [])
})

test('the same counters are worked out once', () => {
  const world = { bestiary: maxed() }
  assert.equal(worldEffectsOf(world, content), worldEffectsOf(world, content))
})

const fighter = { sessionId: 'a', class: 'physical', level: 11, attributes: { strength: 8, luck: 2 }, equipment: {} }
const members = [{ character: fighter, tokensPerMinute: 20_000 }]

test('a party hits harder against a race its world has mastered, and only against it', () => {
  const plain = partyOf(members, { skills: {} }, { chest: [] }, content)
  const world = { skills: {}, bestiary: { races: { orc: atLevel('orc', 10) }, bosses: {} } }
  const party = partyOf(members, world, { chest: [] }, content)
  const orc = { rank: 'normal', race: 'orc' }
  close(party.hitsAgainst(orc).physical / plain.hitsAgainst(orc).physical, 1 + 10 * 0.002 + 2 * 0.002)
  close(party.hitsAgainst({ rank: 'normal', race: 'goblin' }).physical / plain.hits.physical, 1.004)
})

test('the bestiary adds to the relic and equipment, and the sum is capped', () => {
  const relic = [legendary.byId.get('crown-of-the-ossuary').effect]
  const held = [legendary.byId.get('labyrinth-cleaver').effect]
  const hunter = hunterEffects(index, 5)
  const orcPerk = raceMasteryEffects(index, 'orc', 25)
  const bonuses = memberBonuses([...relic, ...hunter, ...orcPerk], held)
  close(bonuses.hitFactor('physical', 'boss', null), 1 + 0.06 + 0.06 + 0.015 + 0.01)
  const moreThanCap = [{ effect: 'damage', scope: 'world', amount: 0.1 }]
  close(memberBonuses([...relic, ...moreThanCap], held).hitFactor('physical', 'boss', null), 1 + LEGENDARY_EFFECT_CAPS.damage)
  const drain = partyBonuses([legendary.byId.get('rimeheart').effect, ...raceMasteryEffects(index, 'skeleton', 25)], [])
  close(drain.drainFactor, 1 - 0.06)
})

test('race damage adds to plain damage against that race', () => {
  const bonuses = memberBonuses(raceMasteryEffects(index, 'troll', 1), [legendary.byId.get('labyrinth-cleaver').effect])
  close(bonuses.hitFactor('physical', 'normal', 'troll'), 1 + 0.06 + 0.002)
  close(bonuses.hitFactor('physical', 'normal', 'ogre'), 1.06)
  close(bonuses.hitFactor('physical', 'normal', null), 1.06)
})

test('mastered minotaurs and treants make upgrades cheaper beside the relic', () => {
  const anvil = { legendary: { relics: ['everwarm-anvil'], active: 'everwarm-anvil' } }
  const world = [...raceMasteryEffects(index, 'minotaur', 25), ...raceMasteryEffects(index, 'treant', 10)]
  close(upgradeDiscountOf(anvil, legendary, world), 0.05 + 0.02 + 0.008)
})

test('mastered humans give the world\'s characters a little more experience', () => {
  close(tokenBonuses(raceMasteryEffects(index, 'human', 25), [], 'forge').characterFactor, 1.01)
})

test('the boss hunter makes each step of legendary pity worth more', () => {
  const project = { chest: [], legendary: { relics: ['rimeheart'], active: 'rimeheart', relicPity: 4, bossPity: 0 } }
  const monster = { id: 'not-on-the-roster', kind: 'boss', rank: 'boss', level: 20 }
  const plainChance = RELIC_CHANCE.boss + RELIC_PITY_STEP * 4
  const pityFactor = 1 + amountOf(hunterEffects(index, 5), 'legendaryPity')
  let seed = 0
  const between = (at) => {
    const roll = chanceOf(`s${at}|relic`)
    return roll >= plainChance && roll < RELIC_CHANCE.boss + RELIC_PITY_STEP * 4 * pityFactor
  }
  while (!between(seed)) seed += 1
  assert.deepEqual(rollLegendaryDrops(project, { monster, seed: `s${seed}`, index: legendary }).drops, [])
  assert.equal(rollLegendaryDrops(project, { monster, seed: `s${seed}`, index: legendary, pityFactor }).drops[0].kind, 'relic')
})

/**
 * The most a source can give of a type against one monster: `against` picks the effects that apply
 * (a damage type, a rank), a holder holds one weapon, and equipment that acts for the party (the
 * maul's drain) adds across holders.
 */
function mostOf(type, applies) {
  const entries = [...legendary.byId.values()].filter((entry) => entry.effect.effect === type && applies(entry.effect))
  const relic = Math.max(0, ...entries.filter((entry) => entry.kind !== 'equipment').map((entry) => entry.effect.amount))
  const equipment = entries.filter((entry) => entry.kind === 'equipment').map((entry) => entry.effect.amount)
  const held = type === 'damage' ? Math.max(0, ...equipment) : equipment.reduce((sum, amount) => sum + amount, 0)
  const bestiary = bestiaryEffects(maxed(), index).filter((effect) => effect.effect === type && applies(effect))
  return { relic, held, bestiary: amountOf(bestiary, type) }
}

test('the strongest relic, all the legendary equipment and a whole bestiary at its top stay within every cap', () => {
  const RANKS = ['normal', 'veteran', 'elite', 'champion', 'boss', 'legendary']
  for (const type of Object.keys(LEGENDARY_EFFECT_CAPS)) {
    // A relic and a tool already reach the gathering cap together; the bestiary gives none of it.
    if (type === 'gatherYield') continue
    let cases = [() => true]
    if (type === 'damage') {
      cases = ['physical', 'magical'].flatMap((damageType) => RANKS.map((rank) => (effect) =>
        (!effect.damageType || effect.damageType === damageType) && (!effect.ranks || effect.ranks.includes(rank))))
    }
    if (type === 'raceDamage') cases = index.raceIds.map((raceId) => (effect) => effect.races.includes(raceId))
    // An instance relic gives one work skill's experience to the party, the Moonwane Scepter another.
    if (type === 'skillXp') cases = WORK_SKILLS.map((skill) => (effect) => effect.skill === skill)
    for (const applies of cases) {
      const { relic, held, bestiary } = mostOf(type, applies)
      assert.ok(relic + held + bestiary <= LEGENDARY_EFFECT_CAPS[type] + 1e-9, `${type}: ${relic} + ${held} + ${bestiary}`)
    }
  }
})

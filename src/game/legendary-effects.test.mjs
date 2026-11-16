import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { CRIT_DAMAGE, LEGENDARY_EFFECT_CAPS, REST_SECONDS, SUPPORT_AURA, SWIFT_ATTACK, TICK_SECONDS } from './constants.mjs'
import { fightTick, rewardFor } from './combat.mjs'
import { partyOf } from './fight.mjs'
import {
  activeRelicOf,
  gatherBonuses,
  heldEffects,
  legendaryIndexOf,
  memberBonuses,
  partyBonuses,
  relicEffects,
  runeCircleFactorOf,
  tokenBonuses,
  totalOf,
  upgradeDiscountOf,
  withKillMaterials
} from './legendary-effects.mjs'
import { characterHit, critChance, partyHits } from './power.mjs'

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const content = { items: readJson('../../game/items.json'), legendary: readJson('../../game/legendary.json') }
const index = legendaryIndexOf(content)
const effectOf = (id) => index.byId.get(id).effect
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`)

const legendaryItem = (entryId, heldBy = null, extra = {}) => {
  const entry = index.byId.get(entryId)
  return {
    id: entryId, entryId, slot: entry.slot, ...(entry.damageType ? { damageType: entry.damageType } : {}),
    tier: 1, recipe: entry.recipe, level: 0, heldBy, legendary: true, ...extra
  }
}
const character = (sessionId, className, equipment = {}, extra = {}) => ({
  sessionId, class: className, level: 11, attributes: { precision: 10, luck: 2, resilience: 8, medicine: 8 },
  equipment: { weapon: null, outfit: null, tool: null, ...equipment }, trade: 'mining', ...extra
})

test('the index is built once per content file, and content without legendary loot has none', () => {
  assert.equal(legendaryIndexOf(content), index)
  assert.equal(legendaryIndexOf({ items: content.items }), null)
  assert.equal(legendaryIndexOf(null), null)
})

test('only an owned relic of the content is active, and only it acts', () => {
  assert.equal(activeRelicOf({ legendary: { relics: ['rimeheart'], active: 'rimeheart' } }, index).id, 'rimeheart')
  assert.equal(activeRelicOf({ legendary: { relics: [], active: 'no-such-relic' } }, index), null)
  assert.equal(activeRelicOf({}, index), null)
  assert.deepEqual(relicEffects({ legendary: { relics: ['oathbreaker'], active: 'oathbreaker' } }, index), [])
})

test('a character\'s held effects come from the legendary items it holds, nothing else', () => {
  const project = {
    chest: [legendaryItem('labyrinth-cleaver', 'a'), legendaryItem('coldscale-hauberk'), { id: 'plain', entryId: 'plain', slot: 'tool', heldBy: 'a' }]
  }
  const holder = character('a', 'physical', { weapon: 'labyrinth-cleaver', tool: 'plain' })
  assert.deepEqual(heldEffects(project, holder, index), [effectOf('labyrinth-cleaver')])
  assert.deepEqual(heldEffects(project, holder, null), [])
})

test('effects of one type add up and stop at the type\'s cap', () => {
  const effects = [{ effect: 'staminaDrain', amount: 0.07 }, { effect: 'staminaDrain', amount: 0.06 }]
  assert.equal(totalOf(effects, 'staminaDrain'), LEGENDARY_EFFECT_CAPS.staminaDrain)
  close(totalOf([effectOf('rimeheart'), effectOf('bridgewardens-maul')], 'staminaDrain'), 0.09)
})

test('attack speed from the relic and the holder\'s equipment add up on the holder\'s hit', () => {
  const bonuses = memberBonuses([effectOf('cogheart-of-the-ninth-shaft')], [effectOf('pale-duelists-coat')])
  close(bonuses.hitFactor('physical', 'normal'), 1.07)
  close(memberBonuses([effectOf('cogheart-of-the-ninth-shaft')], []).hitFactor('magical', null), 1.03)
})

test('damage effects count only for their damage type and their ranks', () => {
  const lyre = memberBonuses([effectOf('jawbone-lyre')], [])
  close(lyre.hitFactor('physical', 'normal'), 1.04)
  close(lyre.hitFactor('magical', 'normal'), 1)
  const crown = memberBonuses([effectOf('crown-of-the-ossuary')], [])
  close(crown.hitFactor('physical', 'boss'), 1.06)
  close(crown.hitFactor('physical', 'legendary'), 1.06)
  close(crown.hitFactor('physical', 'elite'), 1)
  close(memberBonuses([effectOf('stagcall-horn')], []).hitFactor('magical', 'champion'), 1.05)
  close(memberBonuses([], [effectOf('stormwing-staff')]).hitFactor('magical', null), 1.05)
  close(memberBonuses([], [effectOf('labyrinth-cleaver')]).hitFactor('physical', null), 1.06)
})

test('critical chance from a weapon and critical damage from a relic change the hit as the formula says', () => {
  const skills = {}
  const fighter = character('a', 'physical')
  const base = characterHit({ character: fighter, skills, tokensPerMinute: 20_000 }).amount
  const chance = critChance(10)
  const withChance = characterHit({ character: fighter, skills, tokensPerMinute: 20_000, critBonus: 0.04 }).amount
  close(withChance / base, (1 + (chance + 0.04) * (CRIT_DAMAGE - 1)) / (1 + chance * (CRIT_DAMAGE - 1)))
  const withDamage = characterHit({ character: fighter, skills, tokensPerMinute: 20_000, critDamageBonus: 0.25 }).amount
  close(withDamage / base, (1 + chance * (CRIT_DAMAGE * 1.25 - 1)) / (1 + chance * (CRIT_DAMAGE - 1)))
})

test('a stronger aura from a support\'s outfit reaches the others, never itself', () => {
  const members = [
    { class: 'physical', amount: 100, type: 'physical' },
    { class: 'support', amount: 100, type: 'physical', auraFactor: 1.15 }
  ]
  close(partyHits(members).physical, 100 * (1 + SUPPORT_AURA * 1.15) + 100)
})

test('the party bonuses read stamina, rest, kills, affixes, thorns and drops from the relic', () => {
  close(partyBonuses([effectOf('rimeheart')], [[effectOf('bridgewardens-maul')]]).drainFactor, 0.91)
  close(partyBonuses([effectOf('the-seventeenth-key')], []).poolFactor, 1.05)
  assert.equal(partyBonuses([], []).restTicks, REST_SECONDS / TICK_SECONDS)
  assert.equal(partyBonuses([effectOf('unquenched-candle')], []).restTicks, (REST_SECONDS - 10) / TICK_SECONDS)
  close(partyBonuses([effectOf('velvet-thirst-chalice')], []).staminaPerKill, 0.04)
  close(partyBonuses([effectOf('silk-widows-spindle')], []).affixWeakening, 0.2)
  close(partyBonuses([effectOf('bramble-queens-rose')], []).thorns, 0.05)
  close(partyBonuses([effectOf('pilfered-lantern')], []).itemDrop, 0.15)
})

test('a relic\'s stamina drain counts while the holder of a draining weapon fights, not before', () => {
  assert.equal(partyBonuses([], []).drainFactor, 1)
  close(partyBonuses([], [[], [effectOf('bridgewardens-maul')]]).drainFactor, 0.96)
})

test('kill materials grow by the share for the materials the relic names, or for all', () => {
  const materials = { fish: 100, hides: 50, ore: 20 }
  assert.deepEqual(withKillMaterials(materials, [effectOf('tidecall-conch')]), { fish: 106, hides: 53, ore: 20 })
  assert.deepEqual(withKillMaterials(materials, [effectOf('hoard-sleepers-egg')]), { fish: 105, hides: 53, ore: 21 })
  assert.equal(withKillMaterials(materials, []), materials)
})

test('gathering gets extra hours, more units of the named material and more experience', () => {
  assert.equal(gatherBonuses([effectOf('millwind-vane')], [], 'ore').extraHours, 1)
  close(gatherBonuses([effectOf('sheaf-of-the-long-summer')], [], 'fish').yieldFactor, 1.06)
  close(gatherBonuses([effectOf('sheaf-of-the-long-summer')], [], 'ore').yieldFactor, 1)
  close(gatherBonuses([effectOf('golden-hive-comb')], [effectOf('gravewake-mattock')], 'ore').yieldFactor, 1.15)
  close(gatherBonuses([], [effectOf('gravewake-mattock')], 'fish').yieldFactor, 1)
  close(gatherBonuses([effectOf('harbour-stormglass')], [], 'ore').xpFactor, 1.05)
})

test('tokens give the room\'s characters more experience, and the holder\'s skill more of its own', () => {
  close(tokenBonuses([effectOf('codex-of-unwritten-pages')], [], 'forge').characterFactor, 1.04)
  close(tokenBonuses([], [effectOf('moonwane-scepter')], 'arcana').skillFactor, 1.1)
  close(tokenBonuses([], [effectOf('moonwane-scepter')], 'forge').skillFactor, 1)
})

test('the relic can make the room\'s upgrades cheaper and its rune circle stronger', () => {
  const anvil = { legendary: { relics: ['everwarm-anvil'], active: 'everwarm-anvil' } }
  const prism = { legendary: { relics: ['seventh-circle-prism'], active: 'seventh-circle-prism' } }
  close(upgradeDiscountOf(anvil, index), 0.05)
  close(runeCircleFactorOf(prism, index), 1.1)
  assert.equal(upgradeDiscountOf(prism, index), 0)
})

const monster = (extra = {}) => ({
  hp: 1000, maxHp: 1000, physical: 1, magical: 1, attack: 1, affix: null, level: 10, ...extra
})
const tick = (fight) => fightTick({
  hits: { physical: 0, magical: 0 }, defenders: [], supporters: [], stamina: 1000, maxStamina: 1000, ...fight
})

test('a monster drains less with a drain factor', () => {
  const plain = tick({ monster: monster() })
  const eased = tick({ monster: monster(), legendary: { drainFactor: 0.9 } })
  close(1000 - eased.stamina, (1000 - plain.stamina) * 0.9)
})

test('thorns take the share of stamina drained off the monster\'s health, and can finish it', () => {
  const plain = tick({ monster: monster() })
  const drained = (1000 - plain.stamina) / 1000
  const thorned = tick({ monster: monster(), legendary: { thorns: 0.05 } })
  close(1000 - thorned.monster.hp, 0.05 * 1000 * drained)
  const nearlyDead = tick({ monster: monster({ hp: 0.001 }), hits: { physical: 0, magical: 0 }, legendary: { thorns: 0.05 } })
  assert.equal(nearlyDead.killed, true)
})

test('affix weakening takes its share off what each affix adds', () => {
  const swiftPlain = tick({ monster: monster({ affix: 'swift' }) })
  const swiftWeak = tick({ monster: monster({ affix: 'swift' }), legendary: { affixWeakening: 0.2 } })
  close((1000 - swiftWeak.stamina) / (1000 - swiftPlain.stamina), (1 + (SWIFT_ATTACK - 1) * 0.8) / SWIFT_ATTACK)
  const armored = monster({ affix: 'armored', physical: 0.5, magical: 1.5 })
  const hits = { physical: 100, magical: 0 }
  assert.equal(1000 - tick({ monster: armored, hits }).monster.hp, 50)
  close(1000 - tick({ monster: armored, hits, legendary: { affixWeakening: 0.2 } }).monster.hp, 60)
  const thorny = monster({ affix: 'thorny' })
  const thornyLoss = (fight) => 1000 - tick({ monster: thorny, hits, ...fight }).stamina
  const strike = 1000 - tick({ monster: monster() }).stamina
  close((thornyLoss({ legendary: { affixWeakening: 0.2 } }) - strike) / (thornyLoss({}) - strike), 0.8)
})

test('a relic\'s item drop bonus makes a drop likelier under the same cap', () => {
  const kill = { level: 5, reward: 1, dropFactor: 1, affix: null, loot: { ore: 1 } }
  let seed = 0
  while (rewardFor(kill, { luck: 0, seed: `s${seed}` }).itemDrop || !rewardFor(kill, { luck: 0, seed: `s${seed}`, dropBonus: 0.15 }).itemDrop) {
    seed += 1
    if (seed > 200_000) assert.fail('no seed found')
  }
  assert.ok(seed >= 0)
})

test('a party with legendary loot hits harder, holds longer and knows its ranked hits', () => {
  const world = { skills: {} }
  const fighter = character('a', 'physical', { weapon: 'labyrinth-cleaver' })
  const healer = character('b', 'support', { outfit: 'veil-of-the-regent' })
  const chest = [legendaryItem('labyrinth-cleaver', 'a'), legendaryItem('veil-of-the-regent', 'b')]
  const members = [{ character: fighter, tokensPerMinute: 20_000 }, { character: healer, tokensPerMinute: 20_000 }]
  const plainProject = { chest: chest.map((item) => ({ ...item, legendary: undefined })) }
  const plain = partyOf(members, world, plainProject, content)
  const crowned = { chest, legendary: { relics: ['crown-of-the-ossuary'], active: 'crown-of-the-ossuary' } }
  const loaded = partyOf(members, world, crowned, content)
  assert.ok(loaded.hits.physical > plain.hits.physical)
  assert.deepEqual(loaded.rankedHits.ranks, ['boss', 'legendary'])
  assert.ok(loaded.rankedHits.hits.physical > loaded.hits.physical)
  assert.equal(plain.rankedHits, null)
})

test('a censer makes its holder heal more and a hauberk makes its wearer\'s outfit count more', () => {
  const world = { skills: {} }
  const healer = character('b', 'support', { weapon: 'vigil-censer' })
  const guard = character('c', 'defense', { outfit: 'coldscale-hauberk' })
  const chest = [legendaryItem('vigil-censer', 'b'), legendaryItem('coldscale-hauberk', 'c')]
  const members = [{ character: healer, tokensPerMinute: 20_000 }, { character: guard, tokensPerMinute: 20_000 }]
  const plain = partyOf(members, world, { chest: chest.map((item) => ({ ...item, legendary: undefined })) }, content)
  const loaded = partyOf(members, world, { chest }, content)
  close(loaded.supporters[0] / plain.supporters[0], 1.08)
  close(loaded.outfitFactor / plain.outfitFactor, (1 + 1.08) / 2)
})

// What the Bestiary tab shows, worked out from the view state: the header's totals and bonuses, a
// card for each race and each boss, sorted with the discovered first and then by kills, and the
// words of each. Never touches the DOM.
import { BESTIARY, RANK_NAMES, dayText } from './bestiary-labels.js'
import { effectText } from './legendary-labels.js'

/** The ranks a race's counter keeps, in its order (src/game/bestiary.mjs). */
const RANKS = ['normal', 'veteran', 'elite', 'champion', 'boss', 'legendary']

const percent = (amount) => `${Math.round(amount * 1000) / 10}%`
const sumOf = (effects, type) => effects.filter((effect) => effect.effect === type).reduce((sum, effect) => sum + effect.amount, 0)
const share = (value, from, to) => (to === null ? 1 : Math.min(1, Math.max(0, (value - from) / Math.max(1, to - from))))

/** Effects in words, with the races they name called as the bestiary calls them. */
const effectLines = (effects, raceNames) => effects.map((effect) => effectText(effect, undefined, { raceNames })).filter(Boolean)

/** A race's card: its portrait, name, kills, mastery pips, progress and bonuses now and next. */
function raceCard(content, entry, raceNames) {
  const known = entry?.discovered === true
  const level = entry?.level ?? 0
  const max = entry?.maxLevel ?? content.thresholds.length
  const kills = entry?.kills ?? 0
  const to = entry?.to ?? content.thresholds[0] ?? null
  const base = {
    id: content.id,
    key: `race:${content.id}`,
    discovered: known,
    look: content.look,
    level,
    max,
    pips: Array.from({ length: max }, (_, at) => at < level),
    share: share(kills, entry?.from ?? 0, to)
  }
  if (!known) {
    return { ...base, name: BESTIARY.unknown, killsText: BESTIARY.kills(0), label: BESTIARY.unknownLabel, kills: 0,
      progressText: '', bonusText: '', details: null }
  }
  const now = entry.now ?? []
  const next = entry.next ?? null
  const damageNow = sumOf(now, 'raceDamage')
  return {
    ...base,
    name: content.name,
    kills,
    killsText: BESTIARY.kills(kills),
    progressText: to === null ? BESTIARY.masteryTop : BESTIARY.toNext(kills, to),
    bonusText: BESTIARY.cardBonus(damageNow > 0 ? percent(damageNow) : null, next ? percent(sumOf(next, 'raceDamage')) : null),
    label: BESTIARY.cardLabel(content.name, BESTIARY.kills(kills), level, max),
    details: {
      ranks: RANKS.map((rank, at) => ({ rank, name: RANK_NAMES[rank], count: entry.ranks?.[at] ?? 0 })),
      eliteText: BESTIARY.eliteKills(entry.eliteKills ?? 0),
      firstKill: Number.isInteger(entry.firstDay) ? BESTIARY.firstKill(dayText(entry.firstDay)) : '',
      now: effectLines(now, raceNames),
      next: next ? { at: BESTIARY.next(to), lines: effectLines(next, raceNames) } : null
    }
  }
}

/** A boss's card: its look, name and epithet once beaten, wins, legendary wins, its item's hint. */
function bossCard(content, entry, legendaryEntries) {
  const known = entry?.discovered === true
  const itemId = entry?.item ?? content.item ?? null
  const found = Boolean(itemId && entry?.found)
  const item = itemId ? { id: itemId, found, name: found ? legendaryEntries?.[itemId]?.name ?? null : null } : null
  const base = { id: content.id, key: `boss:${content.id}`, discovered: known, look: content.look, item }
  const itemLabel = item ? (found ? BESTIARY.itemFound(item.name ?? '') : BESTIARY.itemMissing) : ''
  if (!known) {
    return { ...base, name: BESTIARY.unknown, epithet: '', beaten: 0, legendary: 0, beatenText: '',
      label: [BESTIARY.bossUnknownLabel, itemLabel].filter(Boolean).join('. ') }
  }
  const beatenText = BESTIARY.bossBeatenLabel(entry.beaten)
  const parts = [`${content.name}, ${content.epithet}`, beatenText,
    entry.legendary ? BESTIARY.bossLegendary(entry.legendary) : '', itemLabel]
  return {
    ...base,
    name: content.name,
    epithet: content.epithet,
    beaten: entry.beaten,
    legendary: entry.legendary,
    beatenText: BESTIARY.bossBeaten(entry.beaten),
    label: parts.filter(Boolean).join('. ')
  }
}

/** Discovered first, then the most killed, then the content's order. */
function sortCards(cards, count) {
  return cards
    .map((card, order) => ({ card, order }))
    .sort((a, b) => Number(b.card.discovered) - Number(a.card.discovered) || count(b.card) - count(a.card) || a.order - b.order)
    .map(({ card }) => card)
}

/** The world's bonuses as short lines: damage against races in one, every other kind worded. */
function bonusLines(bonuses, raceNames) {
  const raceDamage = bonuses.filter((effect) => effect.effect === 'raceDamage')
  const lines = []
  if (raceDamage.length) {
    const amounts = raceDamage.map((effect) => effect.amount)
    const text = BESTIARY.raceDamageSummary(raceDamage.length, percent(Math.min(...amounts)), percent(Math.max(...amounts)))
    lines.push(text)
  }
  return [...lines, ...effectLines(bonuses.filter((effect) => effect.effect !== 'raceDamage'), raceNames)]
}

function hunterModel(hunter, raceNames) {
  return {
    levelText: BESTIARY.hunterLevel(hunter.level, hunter.maxLevel),
    progressText: BESTIARY.hunterProgress(hunter.count, hunter.to),
    share: share(hunter.count, hunter.from, hunter.to),
    now: effectLines(hunter.now ?? [], raceNames),
    next: hunter.next ? { at: BESTIARY.hunterNext(hunter.to), lines: effectLines(hunter.next, raceNames) } : null
  }
}

/**
 * The Bestiary tab's model for a world.
 *
 * @param {object} game the view state's game
 * @param {object | null} world the world shown, from `game.worlds`
 * @returns {object | null} null when the game or the world has no bestiary
 */
export function bestiaryModel(game, world) {
  const content = game?.bestiary
  const counts = world?.bestiary
  if (!content || !counts) return null
  const raceNames = Object.fromEntries(content.races.map((race) => [race.id, race.name]))
  const raceEntries = new Map(counts.races.map((entry) => [entry.id, entry]))
  const bossEntries = new Map(counts.bosses.map((entry) => [entry.id, entry]))
  const creatures = content.races.map((race) => raceCard(race, raceEntries.get(race.id), raceNames))
  const bosses = content.bosses.map((boss) => bossCard(boss, bossEntries.get(boss.id), game.legendary?.entries))
  return {
    worldId: world.id,
    racesText: BESTIARY.races(counts.discovered, counts.raceCount),
    bossesText: BESTIARY.bosses(counts.beaten, counts.bossCount),
    hunter: hunterModel(counts.hunter, raceNames),
    bonuses: bonusLines(counts.bonuses ?? [], raceNames),
    creatures: sortCards(creatures, (card) => card.kills),
    bosses: sortCards(bosses, (card) => card.beaten),
    others: counts.others ? BESTIARY.others(counts.others.kills) : null
  }
}

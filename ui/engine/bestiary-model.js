// What the Bestiary tab shows, worked out from the view state: the header's totals, hunter rank and
// bonuses, a card for each race and each boss, sorted with the discovered first and then by points
// (or by how close each is to its next level), and the words of each. Never touches the DOM.
import { BESTIARY, RANK_NAMES, dayText, prestigeTitle } from './bestiary-labels.js'
import { effectText } from './legendary-labels.js'

/** The ranks a race's counter keeps, in its order (src/game/bestiary.mjs). */
const RANKS = ['normal', 'veteran', 'elite', 'champion', 'boss', 'legendary']

const percent = (amount) => `${Math.round(amount * 1000) / 10}%`
const sumOf = (effects, type) => effects.filter((effect) => effect.effect === type).reduce((sum, effect) => sum + effect.amount, 0)
const share = (value, from, to) => (to === null ? 1 : Math.min(1, Math.max(0, (value - from) / Math.max(1, to - from))))

/** Effects in words, with the races they name called as the bestiary calls them. */
const effectLines = (effects, raceNames) => effects.map((effect) => effectText(effect, undefined, { raceNames })).filter(Boolean)

/** What the next level brings: more damage and, every few levels, the perk; past them, a title. */
function nextOf(content, game, entry) {
  if (entry.level >= entry.maxLevel) return { title: prestigeTitle(content.title, entry.prestige + 1) }
  const perkEvery = game.bestiary.perkEvery ?? 0
  return { damage: percent(sumOf(entry.next ?? [], 'raceDamage')), perk: perkEvery > 0 && (entry.level + 1) % perkEvery === 0 }
}

/** A race's card: its portrait, name, level, points to the next one, and its bonus now and next. */
function raceCard(content, entry, { raceNames, game }) {
  const known = entry?.discovered === true
  const level = entry?.level ?? 0
  const prestige = entry?.prestige ?? 0
  const points = entry?.points ?? 0
  const base = {
    id: content.id,
    key: `race:${content.id}`,
    discovered: known,
    look: content.look,
    level,
    prestige,
    points,
    share: share(points, entry?.from ?? 0, entry?.to ?? null),
    nearness: known ? share(points, entry.from, entry.to) : -1
  }
  if (!known) {
    return { ...base, name: BESTIARY.unknown, levelText: '', killsText: BESTIARY.kills(0), label: BESTIARY.unknownLabel,
      kills: 0, progressText: '', title: '', nowText: '', nextText: '', details: null }
  }
  const now = entry.now ?? []
  const damageNow = sumOf(now, 'raceDamage')
  const title = prestige > 0 ? prestigeTitle(content.title, prestige) : ''
  const next = nextOf(content, game, entry)
  const pointsText = BESTIARY.toNext(points, entry.to)
  return {
    ...base,
    name: content.name,
    title,
    kills: entry.kills,
    levelText: BESTIARY.level(level),
    killsText: BESTIARY.kills(entry.kills),
    progressText: pointsText,
    nowText: BESTIARY.cardNow(damageNow > 0 ? percent(damageNow) : null),
    nextText: BESTIARY.cardNext(next),
    label: BESTIARY.cardLabel(content.name, BESTIARY.kills(entry.kills), level, pointsText, title),
    details: {
      ranks: RANKS.map((rank, at) => ({
        rank, name: RANK_NAMES[rank], count: entry.ranks?.[at] ?? 0,
        title: BESTIARY.pointsOf(RANK_NAMES[rank], game.bestiary.points?.[rank] ?? 0)
      })),
      eliteText: BESTIARY.eliteKills(entry.eliteKills ?? 0),
      firstKill: Number.isInteger(entry.firstDay) ? BESTIARY.firstKill(dayText(entry.firstDay)) : '',
      now: effectLines(now, raceNames),
      next: next.title
        ? { at: BESTIARY.nextTitle(next.title), lines: [BESTIARY.prestigeNote(content.title, entry.maxLevel)] }
        : { at: BESTIARY.next(level + 1, entry.to), lines: effectLines(entry.next ?? [], raceNames) }
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

/** The orders the creatures can be shown in: the default, and the closest to a new level first. */
export const CREATURE_SORTS = Object.freeze(['points', 'next'])

/** Discovered first, then by `count`, highest first, then the content's order. */
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

/** The world's hunter rank: its number, its bar to the next rank and its bonus now and next. */
function rankModel(rank, raceNames) {
  return {
    rankText: BESTIARY.rankValue(rank.rank),
    progressText: BESTIARY.rankProgress(rank.points, rank.to),
    share: share(rank.points, rank.from, rank.to),
    now: effectLines(rank.now ?? [], raceNames),
    next: effectLines(rank.next ?? [], raceNames)
  }
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
 * @param {{ sort?: 'points' | 'next' }} [options] how the creatures are sorted: by points (the
 *   default) or the closest to a new level first; the discovered come first either way
 * @returns {object | null} null when the game or the world has no bestiary
 */
export function bestiaryModel(game, world, { sort = 'points' } = {}) {
  const content = game?.bestiary
  const counts = world?.bestiary
  if (!content || !counts) return null
  const raceNames = Object.fromEntries(content.races.map((race) => [race.id, race.name]))
  const raceEntries = new Map(counts.races.map((entry) => [entry.id, entry]))
  const bossEntries = new Map(counts.bosses.map((entry) => [entry.id, entry]))
  const creatures = content.races.map((race) => raceCard(race, raceEntries.get(race.id), { raceNames, game }))
  const bosses = content.bosses.map((boss) => bossCard(boss, bossEntries.get(boss.id), game.legendary?.entries))
  return {
    worldId: world.id,
    racesText: BESTIARY.races(counts.discovered, counts.raceCount),
    bossesText: BESTIARY.bosses(counts.beaten, counts.bossCount),
    rank: counts.rank ? rankModel(counts.rank, raceNames) : null,
    hunter: hunterModel(counts.hunter, raceNames),
    bonuses: bonusLines(counts.bonuses ?? [], raceNames),
    creatures: sortCards(creatures, sort === 'next' ? (card) => card.nearness : (card) => card.points),
    bosses: sortCards(bosses, (card) => card.beaten),
    others: counts.others ? BESTIARY.others(counts.others.kills) : null
  }
}

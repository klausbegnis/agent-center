// What the World tab's Roadmap and a run's card show, worked out from the view state: the roadmap's
// picture and live markers, one card per instance with its state and its Enter control, and a run's
// rooms, progress, boon, modifier and vault. Never touches the DOM.
import { formatAmount, formatShare } from './game-format.js'
import { INSTANCES, ROOM_KIND_LABEL, boonText, modifierText, workTimeText } from './instance-labels.js'
import { effectText } from './legendary-labels.js'
import { legendaryArtUrl, legendaryEntry } from './legendary-model.js'

/** The room icon of each kind of room, from ui/instances/. */
const ROOM_ICON = {
  entrance: 'icon-entrance', hall: 'icon-fight', trap: 'icon-trap', puzzle: 'icon-puzzle', elite: 'icon-elite',
  vault: 'icon-treasure', boss: 'icon-boss'
}
/** The marker drawn over the roadmap for each state of a site. */
const STATE_ICON = { hidden: 'icon-locked', locked: 'icon-locked', open: 'icon-flag', inside: 'icon-party' }
/** Which picture of a route goes with the room the party is in: the start, the middle, the boss. */
const ROUTE_STAGE = ['start', 'start', 'mid', 'mid', 'mid', 'boss']

/** The World tab's views, in the order of its switch; the Roadmap is a tab of its own. */
export const WORLD_VIEWS = Object.freeze(['creatures', 'bosses', 'achievements'])

/** A saved or asked-for view of the World tab, or the creatures. */
export const worldViewOrDefault = (value) => (WORLD_VIEWS.includes(value) ? value : 'creatures')

/** A picture of ui/instances/ under the surface's base. */
export const instanceArtUrl = (base, path) => `${base ?? ''}${path}`
/** A room icon's picture. */
export const roomIconUrl = (base, icon) => `${base ?? ''}ui/instances/${icon}.png`

/** The content entry of an instance, as the view state sends it. */
export const instanceContent = (game, id) => game?.instances?.instances?.find((entry) => entry.id === id) ?? null

/** A race's or a boss's name from the bestiary's content, or its id. */
const raceName = (game, id) => game?.bestiary?.races?.find((race) => race.id === id)?.name ?? id
function bossText(game, id) {
  const boss = game?.bestiary?.bosses?.find((each) => each.id === id)
  return boss ? `${boss.name}, ${boss.epithet}` : id
}

/** An instance's state in words, for its card and its marker. */
function stateText(entry, content, names) {
  if (entry.state === 'hidden') return INSTANCES.hiddenNote
  if (entry.state === 'locked') return INSTANCES.locked(content.opensAt)
  if (entry.state === 'inside') return INSTANCES.inside(names(entry.roomInside), entry.roomIndex)
  return entry.clears > 0 ? INSTANCES.clearedCount(entry.clears, entry.bestTier) : INSTANCES.open
}

/** The tier modifier of an instance at a tier: none at 1, then its rotation in turn. */
export function tierModifier(game, content, tier) {
  if (tier < 2 || !content?.rotation?.length) return null
  const id = content.rotation[(tier - 2) % content.rotation.length]
  const modifier = game?.instances?.modifiers?.[id]
  return modifier ? { id, name: modifier.name, text: modifierText(modifier.effect) } : null
}

/**
 * The Enter control of an open instance: the rooms of the world on screen with why each cannot
 * enter, the default room (the one picked above the tabs when it can), and the tiers.
 */
function enterModel(game, entry, content, { roomIds, roomId, names }) {
  if (entry.state !== 'open') return null
  const rooms = roomIds.filter((id) => Object.hasOwn(entry.entry, id))
    .map((id) => ({ id, name: names(id), reason: entry.entry[id] }))
  if (rooms.length === 0) return null
  const ready = rooms.filter((room) => room.reason === null)
  const chosen = rooms.find((room) => room.id === roomId && room.reason === null) ?? ready[0] ?? rooms.find((room) => room.id === roomId) ?? rooms[0]
  const tiers = Array.from({ length: entry.highestTier }, (_, at) => at + 1).reverse()
    .map((tier) => ({ tier, text: INSTANCES.tierOption(tier, tierModifier(game, content, tier)?.name) }))
  return { rooms, defaultRoomId: chosen.id, tiers, defaultTier: entry.highestTier, canEnter: ready.length > 0 }
}

/**
 * The rematch control of a beaten instance: the next rematch, the reason of each room on screen, and
 * the lines that say the best one and what the next asks. Null before the boss is beaten.
 */
function rematchModel(entry, { roomIds, names }) {
  const best = entry.rematch ?? 0
  const next = entry.nextRematch ?? null
  if (!next && best === 0) return null
  const rooms = next ? roomIds.filter((id) => Object.hasOwn(next.entry, id)).map((id) => ({ id, name: names(id), reason: next.entry[id] })) : []
  return {
    best,
    bestText: best ? INSTANCES.rematchBest(best) : INSTANCES.rematchNone,
    next: next?.rematch ?? null,
    nextText: next ? `${INSTANCES.rematchNext(next.rematch, next.tier)}. ${INSTANCES.rematchOpens(next.opensAt)}.` : INSTANCES.rematchDone,
    buttonText: next ? INSTANCES.rematch(next.rematch) : '',
    rooms
  }
}

/**
 * A card of the roadmap.
 *
 * @param {object} game
 * @param {object} entry the world's state of the instance
 * @param {{ base: string, roomIds: string[], roomId: string | null, names: (id: string) => string }} context
 */
export function instanceCard(game, entry, context) {
  const content = instanceContent(game, entry.id)
  if (!content) return null
  const hidden = entry.state === 'hidden'
  const relic = legendaryEntry(game, entry.relic)
  return {
    id: entry.id,
    key: `instance:${entry.id}`,
    state: entry.state,
    hidden,
    name: hidden ? INSTANCES.hidden : content.name,
    banner: instanceArtUrl(context.base, content.card),
    alt: hidden ? INSTANCES.hiddenNote : content.alt,
    stateText: stateText(entry, content, context.names),
    // The state line says it for an open instance; one a room is inside says it here.
    clearedText: entry.state === 'inside' && entry.clears > 0 ? INSTANCES.clearedCount(entry.clears, entry.bestTier) : '',
    racesText: hidden ? '' : INSTANCES.races(content.races.map((id) => raceName(game, id)).join(', ')),
    bossText: hidden ? '' : INSTANCES.boss(bossText(game, content.boss), bossText(game, content.elite)),
    relic: relic && !hidden ? {
      id: relic.id,
      name: relic.name,
      art: legendaryArtUrl(context.base, relic.id, { glow: entry.relicFound }),
      found: entry.relicFound,
      text: effectText(relic.effect),
      foundText: entry.relicFound ? INSTANCES.relicFound : INSTANCES.relicNotFound
    } : null,
    roomInside: entry.roomInside,
    rematchBadge: entry.rematch ? INSTANCES.rematchBadge(entry.rematch) : null,
    rematch: hidden ? null : rematchModel(entry, context),
    enter: hidden ? null : enterModel(game, entry, content, context)
  }
}

/**
 * The Roadmap view of a world's region: the switch between regions, the picture for the region's
 * progress, a marker on each site and on the party of a run, and a card per instance; a locked
 * region says what opens it. Null without instances or a world.
 *
 * @param {object | undefined} game the view state's game
 * @param {object | null} world the world picked above the tabs
 * @param {{ base: string, roomIds: string[], roomId: string | null, names: (id: string) => string,
 *   regionId?: string | null }} context `roomIds` the rooms on screen in that world, `names` a room's
 *   name as shown, `regionId` the region picked (the furthest open one otherwise)
 */
export function roadmapModel(game, world, context) {
  const content = game?.instances
  const road = world?.instances
  if (!content?.region || !road) return null
  const first = content.region.id
  const regions = content.regions ?? [{ ...content.region, after: null }]
  const places = road.regions ?? [{ id: first, unlocked: true, map: road.map, cleared: road.cleared, total: road.total, complete: road.complete }]
  const placeOf = (id) => places.find((place) => place.id === id) ?? places[0]
  const unlocked = regions.filter((region) => placeOf(region.id).unlocked)
  // The region picked, or the furthest one open: where the world's road goes on.
  const region = regions.find((each) => each.id === context.regionId) ?? unlocked.at(-1) ?? regions[0]
  const place = placeOf(region.id)
  const list = road.list.filter((entry) => (entry.region ?? first) === region.id)
  const before = regions.find((each) => each.id === region.after)
  const markers = list.map((entry) => {
    const entryContent = instanceContent(game, entry.id)
    const name = entry.state === 'hidden' ? INSTANCES.hidden : entryContent?.name ?? entry.id
    const isCleared = entry.clears > 0 && entry.state !== 'inside'
    return {
      id: entry.id,
      left: (100 * (entryContent?.map.x ?? 0)) / region.width,
      top: (100 * (entryContent?.map.y ?? 0)) / region.height,
      state: isCleared ? 'cleared' : entry.state,
      icon: roomIconUrl(context.base, isCleared ? 'icon-cleared' : STATE_ICON[entry.state] ?? 'icon-locked'),
      badge: entry.rematch ? INSTANCES.rematchBadge(entry.rematch) : null,
      label: INSTANCES.marker(name, entryContent ? stateText(entry, entryContent, context.names) : '') +
        (entry.rematch ? `, ${INSTANCES.rematchMarker(entry.rematch)}` : '')
    }
  })
  return {
    regionId: region.id,
    // The region switch: one button per region, a locked one saying what opens it.
    regions: regions.length > 1 ? regions.map((each) => {
      const eachPlace = placeOf(each.id)
      return {
        id: each.id,
        name: each.name,
        text: eachPlace.unlocked ? each.name : INSTANCES.regionLockedText(each.name),
        locked: !eachPlace.unlocked,
        pressed: each.id === region.id,
        label: eachPlace.unlocked ? INSTANCES.regionOpen(each.name, eachPlace.cleared, eachPlace.total) : INSTANCES.regionLockedLabel(each.name)
      }
    }) : [],
    locked: place.unlocked ? null : INSTANCES.regionLocked(before?.name ?? '', placeOf(before?.id).cleared, placeOf(before?.id).total),
    title: INSTANCES.title(region),
    summary: INSTANCES.cleared(place.cleared, place.total),
    complete: place.complete ? INSTANCES.complete(region.title) : null,
    map: { src: instanceArtUrl(context.base, place.map.art), alt: place.map.alt, width: region.width, height: region.height },
    markers: place.unlocked ? markers : [],
    cards: list.map((entry) => instanceCard(game, entry, context)).filter(Boolean)
  }
}

/** The six room icons of a run: cleared ones checked, the current one marked, the ones ahead dim. */
function roomIcons(run, content, base) {
  return content.rooms.map((room, index) => {
    const stage = index < run.room ? 'cleared' : index === run.room ? 'current' : 'ahead'
    const label = ROOM_KIND_LABEL[room.kind] ?? room.kind
    return {
      key: `room:${index}`,
      stage,
      icon: roomIconUrl(base, ROOM_ICON[room.kind] ?? 'icon-fight'),
      overlay: stage === 'cleared' ? roomIconUrl(base, 'icon-cleared') : stage === 'current' ? roomIconUrl(base, 'icon-party') : null,
      label: INSTANCES.roomIcon(index, label, room.name, INSTANCES.stages[stage])
    }
  })
}

/**
 * A room's run as its card shows it, or null when the room is on its waves.
 *
 * @param {object | undefined} game
 * @param {string} roomId
 * @param {{ base: string }} context
 */
export function runCardModel(game, roomId, { base }) {
  const run = game?.rooms?.[roomId]?.run
  const content = run ? instanceContent(game, run.instance) : null
  if (!run || !content) return null
  const route = content.route
  return {
    roomId,
    title: INSTANCES.runTitle(run.name, run.tier, run.rematch),
    roomLine: `${INSTANCES.roomLine(run.room, run.roomName)}${run.fights > 1 ? ` · ${INSTANCES.fights(run.fight, run.fights)}` : ''}`,
    icons: roomIcons(run, content, base),
    route: route ? { src: instanceArtUrl(base, route[ROUTE_STAGE[run.room] ?? 'mid']), alt: route.alt } : null,
    progress: run.progress,
    progressText: formatShare(run.progress),
    triesText: INSTANCES.triesLeft(run.triesLeft),
    timeShare: run.timeShare,
    timeText: INSTANCES.timeUsed(formatShare(run.timeShare)),
    hasTime: run.fights > 0,
    boonText: run.boon ? INSTANCES.boon(run.boon.name, boonText(run.boon.effect)) : INSTANCES.boonNone,
    modifierText: run.modifier ? INSTANCES.modifier(run.modifier.name, modifierText(run.modifier.effect)) : INSTANCES.modifierNone,
    workedText: INSTANCES.worked(workTimeText(run.workedMs)),
    foundText: INSTANCES.found(run.found.kills, formatAmount(run.found.coins)),
    offered: run.offered?.map((boon) => ({ id: boon.id, name: boon.name, text: boonText(boon.effect), key: `boon:${boon.id}` })) ?? null,
    vaultWaitText: run.vaultWaitMs !== null && run.vaultWaitMs !== undefined ? INSTANCES.vaultWait(workTimeText(run.vaultWaitMs)) : '',
    recallKey: `recall:${roomId}`
  }
}

/**
 * The room's cooldowns in words, one line per instance.
 *
 * @param {object | undefined} game
 * @param {string} roomId
 */
export function cooldownLines(game, roomId) {
  const cooldowns = game?.rooms?.[roomId]?.instanceCooldowns ?? {}
  return Object.entries(cooldowns).map(([id, ms]) => INSTANCES.cooldown(instanceContent(game, id)?.name ?? id, workTimeText(ms)))
}

/**
 * A room's band inside an instance: the instance, the room it is in and its icon. Null on the waves.
 *
 * @param {object | undefined} game
 * @param {string} roomId
 * @param {string} base
 */
export function instanceBand(game, roomId, base) {
  const run = game?.rooms?.[roomId]?.run
  const content = run ? instanceContent(game, run.instance) : null
  if (!run || !content) return null
  return {
    text: INSTANCES.band(run.name, run.room, run.roomName),
    short: INSTANCES.bandShort(run.name, run.room),
    icon: roomIconUrl(base, ROOM_ICON[run.roomKind] ?? 'icon-fight'),
    backdrop: instanceArtUrl(base, content.banner),
    alt: content.alt
  }
}

/**
 * What a room says of its run's news: entering and the clear celebrated like a legendary drop (with
 * the instance's relic's picture on a first clear), the other steps as bestiary news. Null for an
 * event it does not tell.
 *
 * @param {{ kind: string, instance: string, room: number, passed?: boolean, boon?: string,
 *   drops?: { id: string }[] }} event
 * @param {object | undefined} game
 * @returns {{ text: string, tone: string, artId?: string } | null}
 */
export function instanceNews(event, game) {
  const content = instanceContent(game, event.instance)
  const name = content?.name ?? event.instance
  const roomName = content?.rooms?.[event.room]?.name ?? ''
  const relic = event.drops?.find((drop) => drop.id === content?.relic)
  switch (event.kind) {
    case 'enter': return { text: INSTANCES.news.enter(name), tone: 'legendary' }
    case 'room': return { text: INSTANCES.news.room(roomName), tone: 'instance' }
    case 'check': return { text: (event.passed ? INSTANCES.news.checkPassed : INSTANCES.news.checkFailed)(roomName), tone: 'instance' }
    case 'vault': return { text: INSTANCES.news.vault, tone: 'instance' }
    case 'boon': {
      const boon = game?.rooms?.[event.roomId]?.run?.boon
      return { text: INSTANCES.news.boon(boon?.id === event.boon ? boon.name : event.boon), tone: 'instance' }
    }
    case 'cleared': {
      const text = event.rematch ? INSTANCES.news.rematchCleared(name, event.rematch) : INSTANCES.news.cleared(name)
      return { text, tone: 'legendary', ...(relic ? { artId: relic.id } : {}) }
    }
    case 'failed': return { text: INSTANCES.news.failed(name), tone: 'instance' }
    case 'recalled': return { text: INSTANCES.news.recalled(name), tone: 'instance' }
    default: return null
  }
}

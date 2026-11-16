// Which of the game's events are new since the last state, so each plays once. The first state a
// page sees is only remembered: after a reload nothing old is replayed. Never touches the DOM.

/** A monster's health has to fall by at least this share to show a damage number. */
const MIN_HIT_SHARE = 0.005

/** What identifies the monster a room is fighting, so a new one is not taken for a hit. */
function monsterKey(room) {
  if (!room?.joined || !room.monster) return null
  return `${room.wave}|${room.waveKills}|${room.monster.id}|${room.monster.level}`
}

/**
 * Remembers what the last state held and tells what is new in the next one.
 *
 * @returns {{ take: (game: object | undefined) => {
 *   events: object[],
 *   arrivals: string[],
 *   hits: { roomId: string, share: number }[]
 * } }} `arrivals` are agent ids whose character is new; `hits` the health a monster lost
 */
export function createGameFeed() {
  let lastEventId = null
  let knownCharacters = null
  let monsters = null

  function forget() {
    lastEventId = null
    knownCharacters = null
    monsters = null
  }

  function newEvents(recent) {
    const newest = recent.reduce((highest, event) => Math.max(highest, event.id ?? 0), 0)
    // The first look, or a worker that started its count over: remember, play nothing.
    if (lastEventId === null || newest < lastEventId) {
      lastEventId = newest
      return []
    }
    const fresh = recent.filter((event) => event.id > lastEventId)
    lastEventId = newest
    return fresh
  }

  function newArrivals(characters) {
    const members = Object.keys(characters).filter((agentId) => !characters[agentId].guest)
    const arrivals = knownCharacters ? members.filter((agentId) => !knownCharacters.has(agentId)) : []
    knownCharacters = new Set(members)
    return arrivals
  }

  function newHits(rooms) {
    const hits = []
    const next = new Map()
    for (const [roomId, room] of Object.entries(rooms)) {
      const key = monsterKey(room)
      if (!key) continue
      next.set(roomId, { key, health: room.monster.healthShare })
      const before = monsters?.get(roomId)
      const lost = before && before.key === key ? before.health - room.monster.healthShare : 0
      if (lost >= MIN_HIT_SHARE) hits.push({ roomId, share: lost })
    }
    monsters = next
    return hits
  }

  return {
    take(game) {
      if (game?.status !== 'running' || !game.rooms) {
        forget()
        return { events: [], arrivals: [], hits: [] }
      }
      return {
        events: newEvents(game.recent ?? []),
        arrivals: newArrivals(game.characters ?? {}),
        hits: newHits(game.rooms)
      }
    }
  }
}

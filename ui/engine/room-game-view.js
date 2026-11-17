// The game drawn in one room: the monster standing on the floor with the characters, the blows
// of the fight, a band along the top with the wave, the monster's name, level and health in
// words and the party's state, and a mark on each character with its class or trade and level.
// Draws what game-model.js, foe-phases.js and fight-schedule.js work out.
import { el } from './dom.js'
import { createFightSchedule, fightPeriodMs } from './fight-schedule.js'
import { createFightView } from './fight-view.js'
import { createFoePhases } from './foe-phases.js'
import { bandHeight } from './game-band.js'
import { meter } from './game-controls.js'
import { formatAmount, formatShare } from './game-format.js'
import { characterBadge, roomFight, roomFighters, standingMonsterKey } from './game-model.js'
import { gameIcon } from './icon-view.js'
import {
  badgeDescription,
  classLabel,
  foeState,
  foeTag,
  GUEST_MARK,
  HEALTH_NAME,
  healthText,
  levelShort,
  monsterDescription,
  monsterTag,
  noMonsterLabel,
  partyLabel,
  partyReason,
  skillLabel,
  STAMINA_NAME,
  waveKillsLabel,
  waveLabel
} from './labels.js'
import { legendaryPicture } from './legendary-art.js'
import { bandRelicLabel } from './legendary-labels.js'
import { activeRelic } from './legendary-model.js'
import { monsterSpot } from './monster-place.js'
import { createMonsterView } from './monster-view.js'
import { settlementArtUrl } from './settlement-model.js'

/** How long an event stays over the room; the CSS animation lasts as long. */
const EFFECT_MS = 2600
/** A legendary drop and a new stage of the settlement are celebrated twice as long (ui/legendary.css, ui/settlement.css). */
const LEGENDARY_EFFECT_MS = 5200
const LONG_TONES = new Set(['legendary', 'stage'])

/** A settlement picture by a line over the room: a building's sprite, or the stage's picture, larger. */
function settlementPicture(base, path, tone) {
  const image = el('img', tone === 'stage' ? 'ac-settlement-pop-stage' : 'ac-settlement-pop-art')
  image.src = settlementArtUrl(base, path)
  image.alt = ''
  image.decoding = 'async'
  image.draggable = false
  return image
}

/**
 * @param {{ scene: HTMLElement, theme: object, roomId: string, mirrored: boolean, base?: string }} options
 *   `base` is where the surface loads legendary pictures from
 */
export function createRoomGame({ scene, theme, roomId, mirrored, base = '' }) {
  const band = el('div', 'ac-game-band')
  band.style.height = `${bandHeight(theme) * 100}%`

  const wave = el('div', 'ac-game-pill ac-game-wave')
  const waveNumber = el('strong', 'ac-game-wave-number')
  const waveKills = el('span', 'ac-game-wave-kills')
  wave.append(waveNumber, waveKills)

  const foeInfo = el('div', 'ac-game-pill ac-game-foe-info')
  const foeTitle = el('span', 'ac-game-foe-title')
  const foeTagNode = el('span', 'ac-game-foe-tag')
  const foeName = el('span', 'ac-game-foe-name')
  foeTitle.append(foeTagNode, foeName)
  const health = meter('ac-game-health', HEALTH_NAME)
  const foeLevel = el('span', 'ac-game-foe-level')
  const healthRow = el('span', 'ac-game-foe-row')
  healthRow.append(foeLevel, health.element)
  foeInfo.append(foeTitle, healthRow)

  const party = el('div', 'ac-game-pill ac-game-party')
  const partyState = el('span', 'ac-game-party-state')
  const stamina = meter('ac-game-stamina', STAMINA_NAME)
  party.append(partyState, stamina.element)

  // The room's active relic, a small mark by the wave; narrow cells leave it out (ui/legendary.css).
  const relicMark = el('span', 'ac-game-pill ac-legendary-band-relic')
  relicMark.setAttribute('role', 'img')
  relicMark.hidden = true
  let drawnRelic = null
  band.append(wave, relicMark, foeInfo, party)

  const foe = createMonsterView({ theme, spot: monsterSpot(theme), mirrored })
  foe.setPhase('gone')
  const phases = createFoePhases()
  /** The monsters seen, by key, so the one falling is still drawn while the next one waits. */
  let monsters = new Map()
  let lastFight = null
  /** What the last update was given, to tell the schedule again when the monster's phase moves. */
  let lastInputs = null
  let lastPhase = 'gone'
  /** What the monster was last drawn with, so the clock redraws it only when that changes. */
  let drawnFight = null
  let drawnFoe = ''

  const schedule = createFightSchedule(roomId)
  const fightView = createFightView({ scene, theme })
  /** Agent ids whose character carries a mark now. */
  const marked = new Set()

  // Lines about loot, drops and arrivals appear just under the band, clear of the characters' heads.
  const lines = el('div', 'ac-game-lines')
  lines.setAttribute('aria-hidden', 'true')
  lines.style.top = `${bandHeight(theme) * 100}%`
  /** Every effect on screen, with the time it is taken away. */
  const playing = new Map()

  /** Shows the room's active relic by the wave, or hides the mark. */
  function drawRelic(game) {
    const relic = activeRelic(game, roomId)
    relicMark.hidden = !relic
    if (!relic || drawnRelic === relic.id) return
    drawnRelic = relic.id
    const label = bandRelicLabel(relic.name, relic.text)
    relicMark.setAttribute('aria-label', label)
    relicMark.title = label
    relicMark.replaceChildren(legendaryPicture(base, relic.id, { glow: true, className: 'ac-legendary-band-art' }))
  }

  function drawBand(fight) {
    waveNumber.textContent = waveLabel(fight.wave)
    const kills = waveKillsLabel(fight)
    waveKills.textContent = kills.short
    wave.title = kills.full
    wave.setAttribute('aria-label', `${waveLabel(fight.wave)}: ${kills.full}`)

    foeName.textContent = fight.monster ? fight.monster.name : noMonsterLabel(fight.party)
    const tag = monsterTag(fight.monster)
    foeTagNode.textContent = tag ?? ''
    foeTagNode.hidden = !tag
    foeInfo.classList.toggle('ac-game-foe-boss', fight.isBoss)
    foeInfo.classList.toggle('ac-game-foe-elite', fight.isElite && !fight.isBoss)
    foeInfo.dataset.rank = fight.rank ?? ''
    healthRow.hidden = !fight.monster
    foeInfo.classList.toggle('ac-game-foe-none', !fight.monster)
    if (fight.monster) {
      foeLevel.textContent = levelShort(fight.monster.level)
      health.set(fight.health, healthText(fight, formatAmount, formatShare))
    }

    partyState.textContent = partyLabel(fight.party)
    party.title = partyReason(fight.party)
    party.dataset.party = fight.party
    stamina.set(fight.stamina, formatShare(fight.stamina))
  }

  /** Draws the monster that stands in the room, which may be the one falling to its kill. */
  function drawFoe(fight, shownKey) {
    const monster = monsters.get(shownKey)
    if (!monster) return
    const isCurrent = standingMonsterKey(fight) === shownKey
    const facts = isCurrent ? fight : { hp: 0, maxHp: monster.maxHp ?? null, health: 0 }
    foe.draw(monster, {
      health: facts.health,
      tag: foeTag(monster),
      state: isCurrent ? foeState(fight.party) : '',
      description: monsterDescription(monster, healthText(facts, formatAmount, formatShare))
    })
  }

  /** Moves the monster's phase on and draws it; returns what is shown. */
  function updateFoe(fight, now) {
    const key = standingMonsterKey(fight)
    if (key) monsters.set(key, fight.monster)
    phases.observe(key, now)
    const shown = phases.tick(now)
    // Only the monster on screen and the one coming next are worth keeping.
    monsters = new Map([...monsters].filter(([known]) => known === shown.key || known === key))
    foe.setPhase(shown.phase)
    // Drawn again only when the fight or what is shown changed, not on every tick of the clock.
    const drawing = `${shown.key}|${shown.phase}`
    if (shown.key && (fight !== drawnFight || drawing !== drawnFoe)) drawFoe(fight, shown.key)
    drawnFight = fight
    drawnFoe = drawing
    if (shown.phase === 'gone') {
      foe.element.remove()
      foe.plate.remove()
    } else if (!foe.element.isConnected) {
      scene.append(foe.plate, foe.element)
    }
    return shown
  }

  /**
   * Tells the fight schedule who fights, how fast and against what.
   *
   * @returns {Set<string>} the agents whose characters fight now
   */
  function observeFight(room, game, fight, shown, placeOf, now) {
    const fighters = fight && shown.phase === 'present' ? roomFighters(room, game, fight) : []
    if (!fighters.length) {
      schedule.observe(null, now)
      fightView.stopAll()
      return new Set()
    }
    const world = game.worlds?.find((item) => item.id === game.rooms?.[room.id]?.worldId)
    schedule.observe({
      members: fighters.map((fighter) => ({ ...fighter, place: placeOf(fighter.id) ?? '' })),
      periodMs: fightPeriodMs(game.tickSeconds, world?.attackSpeed),
      monsterKey: shown.key,
      affix: fight.monster.affix ?? null,
      hp: fight.hp,
      maxHp: fight.maxHp
    }, now)
    return new Set(fighters.map((fighter) => fighter.id))
  }

  function markFor(badge) {
    if (badge.kind === 'guest') return [el('span', 'ac-game-badge-text', GUEST_MARK)]
    const iconId = badge.isGathering ? badge.trade : badge.classId
    return [gameIcon(iconId, 'ac-game-badge-icon'), el('span', 'ac-game-badge-text', String(badge.level))]
  }

  function badgeTitle(badge) {
    if (badge.kind !== 'member') return GUEST_MARK
    const base = `${levelShort(badge.level)} ${classLabel(badge.classId)}`
    return badge.isGathering ? `${base}, gathering ${skillLabel(badge.trade)}` : base
  }

  /** Puts a character's mark on it, or takes it off. The mark sits on the sprite's lower corner. */
  function drawBadge(actor, badge) {
    let node = actor.querySelector(':scope > .ac-game-badge')
    if (!badge) {
      node?.remove()
      return
    }
    if (!node) {
      node = el('span', 'ac-game-badge')
      node.setAttribute('aria-hidden', 'true')
      actor.append(node)
    }
    const signature = JSON.stringify(badge)
    if (node.dataset.badge !== signature) {
      node.dataset.badge = signature
      node.replaceChildren(...markFor(badge))
      node.classList.toggle('ac-game-badge-guest', badge.kind === 'guest')
      node.classList.toggle('ac-game-badge-gathering', badge.kind === 'member' && badge.isGathering)
      node.title = badgeTitle(badge)
    }
    // drawActor wrote the character's description in this same update; the mark adds to it.
    const note = badgeDescription(badge)
    const description = actor.getAttribute('aria-label') ?? ''
    if (!description.endsWith(`, ${note}`)) actor.setAttribute('aria-label', `${description}, ${note}`)
  }

  function drawBadges(agents, game, actorOf) {
    const present = new Set()
    for (const agent of agents) {
      const actor = actorOf(agent.id)
      if (!actor) continue
      const badge = game ? characterBadge(game.characters?.[agent.id]) : null
      drawBadge(actor, badge)
      if (badge) present.add(agent.id)
    }
    for (const agentId of marked) {
      if (!present.has(agentId)) {
        const actor = actorOf(agentId)
        if (actor) drawBadge(actor, null)
      }
    }
    marked.clear()
    for (const agentId of present) marked.add(agentId)
  }

  /** Where an effect plays, or null when that part is not on screen. */
  function placeFor(effect, actorOf) {
    if (effect.target === 'monster') {
      // The health lost since the last round sits by the health written in the band; a kill
      // plays over the monster as it falls.
      if (effect.tone !== 'hit' && foe.element.isConnected) return foe.marks
      return band.isConnected ? foeInfo : null
    }
    if (effect.target === 'agent') return actorOf(effect.agentId) ?? null
    if (!lines.isConnected) scene.append(lines)
    return lines
  }

  return {
    /**
     * Plays new events once. They are taken away by the stage's clock (`tick`).
     *
     * @param {import('./game-effects.js').Effect[]} effects this room's
     * @param {number} now
     * @param {(agentId: string) => HTMLElement | undefined} actorOf
     */
    play(effects, now, actorOf) {
      for (const effect of effects) {
        const place = placeFor(effect, actorOf)
        if (!place) continue
        const className = `ac-game-pop ac-game-pop-${effect.target} ac-game-tone-${effect.tone}`
        const node = el('span', className, effect.text)
        if (effect.artId) node.prepend(legendaryPicture(base, effect.artId, { glow: true, className: 'ac-legendary-pop-art' }))
        if (effect.settlementArt) node.prepend(settlementPicture(base, effect.settlementArt, effect.tone))
        node.setAttribute('aria-hidden', 'true')
        place.append(node)
        playing.set(node, now + (LONG_TONES.has(effect.tone) ? LEGENDARY_EFFECT_MS : EFFECT_MS))
      }
    },
    /**
     * Moves the monster's phase and the fight on to `now` and takes away what is over.
     *
     * @param {number} now
     * @param {(agentId: string) => HTMLElement | undefined} actorOf
     * @param {boolean} isMoving false while the page is hidden or motion is unwanted: no blows
     * @returns {Set<string> | null} the agents whose characters fight now, when that changed
     */
    tick(now, actorOf, isMoving) {
      for (const [node, until] of playing) {
        if (now < until) continue
        node.remove()
        playing.delete(node)
      }
      if (playing.size === 0) lines.remove()
      const shown = updateFoe(lastFight, now)
      // A monster that has just walked in starts the fight; one that falls or leaves ends it.
      let fighting = null
      if (shown.phase !== lastPhase && lastInputs) {
        const { room, game, placeOf } = lastInputs
        fighting = observeFight(room, game, lastFight, shown, placeOf, now)
      }
      lastPhase = shown.phase
      fightView.tick(now)
      if (!isMoving) {
        schedule.stopAll()
        fightView.stopAll()
        return fighting
      }
      const beats = schedule.tick(now)
      if (beats.length) fightView.play(beats, { foe: foe.element.isConnected ? foe : null, actorOf, now })
      return fighting
    },
    /**
     * @param {{ id: string, agents: object[] }} room the room as it is now
     * @param {object | null} game the view state's `game` while it runs, otherwise null
     * @param {(agentId: string) => HTMLElement | undefined} actorOf the character of an agent
     * @param {(agentId: string) => string | undefined} placeOf where a character stands, as text
     * @param {number} now
     * @returns {Set<string>} the agents whose characters fight now
     */
    update(room, game, actorOf, placeOf, now) {
      const fight = game ? roomFight(game, room.id) : null
      lastFight = fight
      if (fight) {
        drawBand(fight)
        drawRelic(game)
        if (!band.isConnected) scene.append(band)
      } else {
        band.remove()
      }
      const shown = updateFoe(fight, now)
      lastPhase = shown.phase
      lastInputs = { room, game, placeOf }
      drawBadges(room.agents, game, actorOf)
      return observeFight(room, game, fight, shown, placeOf, now)
    }
  }
}

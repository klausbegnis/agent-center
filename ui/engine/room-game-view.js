// The game drawn over one room: a band along the top with the wave, the monster and the party,
// and a mark on each character with its level and class. Draws what game-model.js picks out.
import { el, svgIcon } from './dom.js'
import { bandHeight } from './game-band.js'
import { meter } from './game-controls.js'
import { formatShare } from './game-format.js'
import { characterBadge, roomFight } from './game-model.js'
import {
  badgeDescription,
  classLabel,
  GUEST_MARK,
  HEALTH_NAME,
  levelShort,
  monsterDescription,
  monsterTag,
  NO_MONSTER,
  partyLabel,
  partyReason,
  STAMINA_NAME,
  waveKillsLabel,
  waveLabel
} from './labels.js'
import { createMonsterView } from './monster-view.js'
import { CLASS_MARKS, pixelPath, TRADE_MARKS } from './pixel-art.js'

/** The grid the class and trade marks are drawn on. */
const MARK_GRID = 8
/** How long an event stays over the room; the CSS animation lasts as long. */
const EFFECT_MS = 2600

/** @param {{ scene: HTMLElement, theme: object }} options */
export function createRoomGame({ scene, theme }) {
  const band = el('div', 'ac-game-band')
  band.style.height = `${bandHeight(theme) * 100}%`

  const wave = el('div', 'ac-game-pill ac-game-wave')
  const waveNumber = el('strong', 'ac-game-wave-number')
  const waveKills = el('span', 'ac-game-wave-kills')
  wave.append(waveNumber, waveKills)

  const foe = el('div', 'ac-game-foe')
  const monster = createMonsterView()
  const foeInfo = el('div', 'ac-game-pill ac-game-foe-info')
  const foeTitle = el('span', 'ac-game-foe-title')
  const foeTag = el('span', 'ac-game-foe-tag')
  const foeName = el('span', 'ac-game-foe-name')
  foeTitle.append(foeTag, foeName)
  const health = meter('ac-game-health', HEALTH_NAME)
  const foeLevel = el('span', 'ac-game-foe-level')
  const healthRow = el('span', 'ac-game-foe-row')
  healthRow.append(foeLevel, health.element)
  foeInfo.append(foeTitle, healthRow)
  foe.append(monster.element, foeInfo)

  const party = el('div', 'ac-game-pill ac-game-party')
  const partyState = el('span', 'ac-game-party-state')
  const stamina = meter('ac-game-stamina', STAMINA_NAME)
  party.append(partyState, stamina.element)

  band.append(wave, foe, party)
  /** Agent ids whose character carries a mark now. */
  const marked = new Set()

  // Lines about loot, drops and arrivals appear just under the band, clear of the characters' heads.
  const lines = el('div', 'ac-game-lines')
  lines.setAttribute('aria-hidden', 'true')
  lines.style.top = `${bandHeight(theme) * 100}%`
  /** Every effect on screen, with the time it is taken away. */
  const playing = new Map()

  function drawFight(fight) {
    waveNumber.textContent = waveLabel(fight.wave)
    const kills = waveKillsLabel(fight)
    waveKills.textContent = kills.short
    wave.title = kills.full
    wave.setAttribute('aria-label', `${waveLabel(fight.wave)}: ${kills.full}`)

    const healthText = formatShare(fight.health)
    monster.draw(fight.monster, fight.monster ? monsterDescription(fight.monster, healthText) : '')
    foeName.textContent = fight.monster ? fight.monster.name : NO_MONSTER
    const tag = monsterTag(fight.monster)
    foeTag.textContent = tag ?? ''
    foeTag.hidden = !tag
    foeInfo.classList.toggle('ac-game-foe-boss', fight.isBoss)
    foeInfo.classList.toggle('ac-game-foe-elite', fight.isElite && !fight.isBoss)
    healthRow.hidden = !fight.monster
    foeInfo.classList.toggle('ac-game-foe-none', !fight.monster)
    if (fight.monster) {
      foeLevel.textContent = levelShort(fight.monster.level)
      health.set(fight.health, healthText)
    }

    partyState.textContent = partyLabel(fight.party)
    party.title = partyReason(fight.party)
    party.dataset.party = fight.party
    stamina.set(fight.stamina, formatShare(fight.stamina))
  }

  function markFor(badge) {
    if (badge.kind === 'guest') return [el('span', 'ac-game-badge-text', GUEST_MARK)]
    const rows = badge.isGathering ? TRADE_MARKS[badge.trade] : CLASS_MARKS[badge.classId]
    const parts = []
    if (rows) parts.push(svgIcon('ac-game-badge-icon', MARK_GRID, pixelPath(rows, '#')))
    parts.push(el('span', 'ac-game-badge-text', String(badge.level)))
    return parts
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
      node.title = badge.kind === 'member'
        ? `${levelShort(badge.level)} ${classLabel(badge.classId)}`
        : GUEST_MARK
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
    if (effect.target === 'monster') return band.isConnected ? foe : null
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
        node.setAttribute('aria-hidden', 'true')
        place.append(node)
        playing.set(node, now + EFFECT_MS)
      }
    },
    /** Takes away the effects whose time is up. */
    tick(now) {
      for (const [node, until] of playing) {
        if (now < until) continue
        node.remove()
        playing.delete(node)
      }
      if (playing.size === 0) lines.remove()
    },
    /**
     * @param {{ id: string, agents: object[] }} room the room as it is now
     * @param {object | null} game the view state's `game` while it runs, otherwise null
     * @param {(agentId: string) => HTMLElement | undefined} actorOf the character of an agent
     */
    update(room, game, actorOf) {
      const fight = game ? roomFight(game, room.id) : null
      if (fight) {
        drawFight(fight)
        if (!band.isConnected) scene.append(band)
      } else {
        band.remove()
      }
      drawBadges(room.agents, game, actorOf)
    }
  }
}

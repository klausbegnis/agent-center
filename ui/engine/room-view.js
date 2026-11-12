// One room: its title row, its controls, its scenery and the characters inside.
import { createActor, drawActor, placeActor } from './actor-view.js'
import { button, el, select, setOptions } from './dom.js'
import { playEmote, stopEmote } from './emote-view.js'
import { createEmoteSchedule } from './emotes.js'
import { createFamiliarMarker, drawFamiliar, drawFamiliarMarker, placeFamiliar } from './familiar-view.js'
import { familiarPoints, household, subagentScale } from './familiars.js'
import { occupancy, roomThemeOptions } from './labels.js'
import { ROOM_ASPECT, slotPoint, stationFor } from './stations.js'

/**
 * @param {{
 *   room: { id: string, name: string, host: string | null },
 *   theme: object,
 *   variant: { hue: number, flip: boolean, background: string },
 *   transport: object,
 *   emotePace: object | null,
 *   onSelectAgent: (agentId: string) => void,
 *   onTogglePin: (roomId: string) => void
 * }} options `emotePace` is a pace from emotes.js, or null for a room without emotes
 */
export function createRoomView({ room, theme, variant, transport, emotePace, onSelectAgent, onTogglePin }) {
  const section = el('section', 'ac-room')
  const ui = theme.ui ?? {}
  for (const [name, value] of Object.entries(ui.vars ?? {})) section.style.setProperty(`--ac-${name}`, value)
  section.classList.toggle('ac-pixelated', ui.pixelated === true)

  const head = el('div', 'ac-room-head')
  const title = el('h2', 'ac-room-name', room.name)
  if (room.host && room.host !== 'local') title.append(el('span', 'ac-room-host', ` · ${room.host}`))
  const meta = el('span', 'ac-room-meta')
  head.append(title, meta)

  const pin = button('pin', 'ac-link ac-room-control ac-pin', {
    title: 'Show this room large, with the others in a strip (Gallery view)',
    onClick: () => onTogglePin(room.id)
  })
  head.append(pin)

  let themePicker = null
  if (transport.setRoomTheme) {
    themePicker = select('ac-select ac-room-control', `Theme for the ${room.name} room`)
    themePicker.title = 'Theme for this room'
    themePicker.addEventListener('change', () => transport.setRoomTheme(room.id, themePicker.value || null))
    head.append(themePicker)
  }
  if (transport.setRoomHidden) {
    head.append(
      button('hide', 'ac-link ac-room-control', {
        title: `Hide the ${room.name} room`,
        onClick: () => transport.setRoomHidden(room.id, true)
      })
    )
  }

  // The stage is the space the room gets; the scene inside keeps the fixed room shape and holds
  // the scenery and the characters.
  const stage = el('div', 'ac-stage')
  const scene = el('div', 'ac-scene')
  scene.style.aspectRatio = String(ROOM_ASPECT)
  const scenery = el('div', 'ac-bg')
  scenery.style.backgroundImage = `url("${theme.dir}${variant.background}")`
  if (variant.hue) scenery.style.filter = `hue-rotate(${variant.hue}deg)`
  if (variant.flip) scenery.style.transform = 'scaleX(-1)'
  scene.append(scenery)
  stage.append(scene)
  section.append(head, stage)

  /** @type {Map<string, HTMLElement>} characters by agent id */
  const actors = new Map()
  /** @type {Map<string, HTMLElement>} "+N" markers by the id of the agent they belong to */
  const markers = new Map()
  const emoteSchedule = emotePace ? createEmoteSchedule(theme, emotePace) : null

  function updateThemePicker(state) {
    if (!themePicker) return
    setOptions(themePicker, roomThemeOptions(state))
    themePicker.value = state.roomThemes?.[room.id] ?? ''
  }

  /**
   * The character of an agent, moved to where it now stands. A new one appears at `start` and
   * goes to its place from there.
   *
   * @param {(actor: HTMLElement, point: { x: number, y: number }) => void} place
   */
  function actorAt(agentId, start, point, place) {
    const existing = actors.get(agentId)
    if (existing) {
      place(existing, point)
      return existing
    }
    const actor = createActor(() => onSelectAgent(agentId))
    place(actor, start)
    scene.append(actor)
    actors.set(agentId, actor)
    requestAnimationFrame(() => requestAnimationFrame(() => place(actor, point)))
    return actor
  }

  function updateMarker(parentId, layout) {
    let marker = markers.get(parentId)
    if (!layout.marker) {
      marker?.remove()
      markers.delete(parentId)
      return
    }
    if (!marker) {
      marker = createFamiliarMarker()
      scene.append(marker)
      markers.set(parentId, marker)
    }
    drawFamiliarMarker(theme, marker, layout.marker, layout.hidden, variant.flip)
  }

  /** Gathers an agent's subagents round the point where it stands. */
  function updateFamiliars(parent, parentPoint, subagents, selectedAgentId, cast) {
    const layout = familiarPoints(theme, { id: parent.id, point: parentPoint }, subagents.length)
    const place = (actor, point) => placeFamiliar(theme, actor, point, variant.flip)
    layout.points.forEach((point, index) => {
      const agent = subagents[index]
      cast.set(agent.id, castMember(agent, point, theme.actors.familiar !== undefined))
      // A new familiar appears where its parent stands and steps out to its place.
      const actor = actorAt(agent.id, parentPoint, point, place)
      drawFamiliar(theme, actor, agent, parent, selectedAgentId === agent.id)
    })
    updateMarker(parent.id, layout)
  }

  /** What the emote schedule needs to know of a character that is in the room. */
  function castMember(agent, point, isFamiliar) {
    return { id: agent.id, activity: agent.activity, place: `${point.x},${point.y}`, isFamiliar }
  }

  function stopEmoteOf(agentId) {
    const actor = actors.get(agentId)
    if (actor) stopEmote(actor)
  }

  /** @returns {Map<string, object>} the characters now in the room, by agent id */
  function updateActors(agents, selectedAgentId) {
    const { mains, familiars } = household(agents)
    const used = new Map()
    const cast = new Map()
    for (const agent of mains) {
      const slots = stationFor(theme, agent.activity)
      const index = used.get(slots) ?? 0
      used.set(slots, index + 1)
      const point = slotPoint(theme, slots, index)
      const scale = agent.parentId === null ? 1 : subagentScale(theme)
      cast.set(agent.id, castMember(agent, point, false))
      const place = (actor, target) => placeActor(theme, actor, target, scale, variant.flip)

      // A new character appears at the entrance and walks to its station.
      const actor = actorAt(agent.id, theme.stations?.enter ?? point, point, place)
      drawActor(theme, actor, agent, selectedAgentId === agent.id)
      updateFamiliars(agent, point, familiars.get(agent.id) ?? [], selectedAgentId, cast)
    }
    for (const [id, actor] of actors) {
      if (!cast.has(id)) {
        actor.remove()
        actors.delete(id)
      }
    }
    for (const [id, marker] of markers) {
      if (!cast.has(id)) {
        marker.remove()
        markers.delete(id)
      }
    }
    return cast
  }

  return {
    section,
    stage,
    themeId: theme.id,
    /**
     * @param {{ agents: object[] }} current the room as it is now
     * @param {object} state the full view state
     * @param {{ selectedAgentId: string | null, isPinned: boolean, now: number }} options
     */
    update(current, state, { selectedAgentId, isPinned, now }) {
      meta.textContent = occupancy(current.agents)
      pin.textContent = isPinned ? 'unpin' : 'pin'
      section.classList.toggle('ac-room-pinned', isPinned)
      updateThemePicker(state)
      const cast = updateActors(current.agents, selectedAgentId)
      emoteSchedule?.observe([...cast.values()], now).forEach(stopEmoteOf)
    },
    /** Starts the emotes that are due at `now` and ends the ones that are over. */
    tickEmotes(now) {
      if (!emoteSchedule) return
      const { started, ended } = emoteSchedule.tick(now)
      ended.forEach(stopEmoteOf)
      for (const { id, emote } of started) {
        const actor = actors.get(id)
        if (actor) playEmote(theme, actor, emote)
      }
    },
    /** Ends every emote at once, for when the page is hidden or motion is unwanted. */
    stopEmotes() {
      emoteSchedule?.stopAll().forEach(stopEmoteOf)
    }
  }
}

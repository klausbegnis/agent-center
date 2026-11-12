// One character in a room: the button, its sprite, its bubble and its name.
import { el } from './dom.js'
import { actorDescription, BUBBLE } from './labels.js'
import { speciesFor } from './stations.js'
import { lookFor } from './variants.js'

/** @param {() => void} onClick */
export function createActor(onClick) {
  const actor = el('button', 'ac-actor')
  actor.type = 'button'
  actor.append(el('span', 'ac-bubble'), el('span', 'ac-sprite'), el('span', 'ac-label'))
  actor.addEventListener('click', onClick)
  return actor
}

/**
 * Positions a character. The point is where its feet go, in the theme's room units.
 *
 * @param {boolean} mirrored whether this room draws its scenery mirrored
 */
export function placeActor(theme, actor, point, scale, mirrored) {
  const x = mirrored ? theme.room.width - point.x : point.x
  actor.style.left = `${(x / theme.room.width) * 100}%`
  actor.style.top = `${(point.y / theme.room.height) * 100}%`
  actor.style.width = `${((theme.actors.width * scale) / theme.room.width) * 100}%`
  actor.style.zIndex = String(Math.round(point.y))
}

function spriteMarkup(symbolIds, width, height) {
  const uses = symbolIds.map((id) => `<use href="#${id}"/>`).join('')
  return `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true">${uses}</svg>`
}

/**
 * Draws symbols from the theme's sprite sheet as a character's sprite. Symbol ids come from the
 * theme's own files; the sprite is rebuilt only when they change.
 *
 * @param {string[]} symbolIds
 * @param {{ width: number, height: number }} [size] the size they are drawn at, in room units
 */
export function drawSprite(theme, actor, symbolIds, size = theme.actors) {
  const { width, height } = size
  const signature = `${theme.id}|${symbolIds.join(',')}|${width}x${height}`
  if (actor.dataset.sprite === signature) return
  actor.dataset.sprite = signature
  actor.querySelector('.ac-sprite').innerHTML = spriteMarkup(symbolIds, width, height)
}

/**
 * Gives a character the colours of a kind of agent and the look derived from an id.
 *
 * @param {string} kind the agent kind that picks the species
 * @param {string} lookId the id the outfit, outfit colour and tint are derived from
 * @returns {{ species: object, look: { outfit: string[], outfitColor: string | null, hue: number } }}
 */
export function applyLook(theme, actor, kind, lookId) {
  const species = speciesFor(theme, kind)
  const look = lookFor(theme, lookId)
  actor.querySelector('.ac-sprite').style.filter = look.hue ? `hue-rotate(${look.hue}deg)` : ''
  if (look.outfitColor) actor.style.setProperty('--o1', look.outfitColor)
  for (const [name, value] of Object.entries(species.colors ?? {})) actor.style.setProperty(`--${name}`, value)
  return { species, look }
}

/**
 * Updates a character to show an agent's current activity.
 *
 * @param {{ id: string, name: string } | null} [parent] the agent this one is a subagent of; a
 *   subagent drawn as a character wears its parent's look
 */
export function drawActor(theme, actor, agent, isSelected, parent = null) {
  const poses = theme.actors.poses ?? {}
  const pose = poses[agent.activity] ?? poses.idle
  const { species, look } = applyLook(theme, actor, agent.kind, parent?.id ?? agent.id)
  drawSprite(theme, actor, [pose, ...(species.parts ?? []), ...look.outfit])

  actor.dataset.activity = agent.activity
  actor.classList.toggle('ac-sub', agent.parentId !== null)
  actor.classList.toggle('ac-selected', isSelected)
  actor.querySelector('.ac-bubble').textContent = BUBBLE[agent.activity] ?? ''
  actor.querySelector('.ac-label').textContent = agent.name
  actor.setAttribute('aria-label', actorDescription(agent, parent?.name))
}

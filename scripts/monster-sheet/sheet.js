// Draws the contact sheet from /monsters.json with the room's own drawing code and glows.
import { foeTag } from '/ui/engine/labels.js'
import { drawMonsterArt } from '/ui/engine/monster-view.js'

/** A monster as a room shows it: the body with its aura and art, its rank and affix set. */
function foe(monster, className) {
  const element = document.createElement('div')
  element.className = `ac-foe ${className}`
  element.dataset.rank = monster.rank ?? 'normal'
  element.dataset.affix = monster.affix ?? ''
  element.dataset.phase = 'present'
  const body = document.createElement('div')
  body.className = 'ac-foe-body'
  const aura = document.createElement('span')
  aura.className = 'ac-foe-aura'
  const art = document.createElement('span')
  art.className = 'ac-foe-art'
  drawMonsterArt(art, monster)
  body.append(aura, art)
  element.append(body)
  return element
}

function card(monster) {
  const node = document.createElement('figure')
  node.className = 'sheet-card'
  node.style.margin = '0'
  const name = document.createElement('figcaption')
  name.className = 'sheet-name'
  name.textContent = monster.name
  const tag = foeTag(monster)
  if (tag) {
    const rank = document.createElement('span')
    rank.className = 'sheet-rank'
    rank.textContent = ` (${tag})`
    name.append(rank)
  }
  node.append(foe(monster, 'sheet-room'), foe(monster, 'sheet-big'), name)
  return node
}

function section(title, monsters) {
  const heading = document.createElement('h2')
  heading.textContent = `${title} (${monsters.length})`
  const row = document.createElement('div')
  row.className = 'sheet-row'
  row.append(...monsters.map(card))
  return [heading, row]
}

const data = await (await fetch('/monsters.json')).json()
const sheet = document.getElementById('sheet')
// ?part=races or ?part=bosses shows one half, so a screenshot of either fits one page.
const part = new URLSearchParams(location.search).get('part')
if (part !== 'bosses') for (const row of data.rows) sheet.append(...section(row.title, row.monsters))
if (part !== 'races') sheet.append(...section('Bosses', data.bosses))

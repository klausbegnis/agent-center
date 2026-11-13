// The demo's contact sheet of generated monsters: every race in a row of variants (an elite, a
// champion and one of its bosses among them), the rank ladder, chimeras and the whole boss
// roster, each with its name, at room size and at three times that. It is how the monster art
// is reviewed; it is served by scripts/demo.mjs and is not part of the plugin's panels.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { AFFIXES } from '../src/game/monsters.mjs'
import { bossFor, CHIMERA_WORD, generateMonster } from '../src/game/races.mjs'
import { send, sendJson, serveFile } from '../src/server/static-files.mjs'

/** Variants shown per race: plain ones, then an elite, a champion and one of its bosses. */
const PLAIN_PER_RACE = 9
const CHIMERAS_SHOWN = 12
const SHEET_FILES = {
  '/monsters.html': ['index.html', 'text/html; charset=utf-8'],
  '/sheet/sheet.js': ['sheet.js', 'text/javascript; charset=utf-8'],
  '/sheet/sheet.css': ['sheet.css', 'text/css; charset=utf-8']
}

const readGame = (root, name) => JSON.parse(fs.readFileSync(path.join(root, 'game', name), 'utf8'))

/** A boss of the roster as the engine would bring it out. */
function rosterBoss(bosses, races, boss) {
  const drawn = bossFor({ bosses: [boss] }, races, { worldId: 'main', projectId: 'sheet', bossNumber: 0 })
  return { name: drawn.name, race: drawn.race, rank: 'boss', kind: 'boss', look: drawn.look }
}

/** One race's row: plain and veteran variants, an elite, a champion and its first boss. */
function raceRow(races, bosses, race) {
  const only = { ...races, races: [race] }
  const monsters = []
  for (let index = 0; index < PLAIN_PER_RACE; index += 1) {
    const rank = index === PLAIN_PER_RACE - 1 ? 'veteran' : 'normal'
    const monster = generateMonster(only, { seed: `sheet|${race.id}|${index}`, rank })
    monsters.push({ ...monster, rank, affix: null })
  }
  for (const [offset, rank] of ['elite', 'champion'].entries()) {
    const affix = AFFIXES[(race.id.length + offset) % AFFIXES.length]
    monsters.push({ ...generateMonster(only, { seed: `sheet|${race.id}|${rank}`, rank }), rank, affix })
  }
  const boss = bosses.bosses.find((each) => each.race === race.id)
  if (boss) monsters.push(rosterBoss(bosses, races, boss))
  return { title: race.noun || race.id, monsters }
}

/** The same monster at every rank, each affixed one with another affix. */
function ladderRow(races, bosses) {
  const orc = { ...races, races: [races.races.find((race) => race.id === 'orc')] }
  const ranks = [['normal', null], ['veteran', null], ['elite', 'regenerating'], ['elite', 'swift'],
    ['champion', 'enraged'], ['champion', 'ethereal']]
  const monsters = ranks.map(([rank, affix]) =>
    ({ ...generateMonster(orc, { seed: 'sheet|ladder', rank }), rank, affix }))
  const boss = rosterBoss(bosses, races, bosses.bosses[6])
  const legendary = ['thorny', 'armored'].map((affix) => ({ ...boss, rank: 'legendary', affix }))
  monsters.push(boss, ...legendary)
  return { title: 'Rank ladder', monsters }
}

function chimeraRow(races) {
  const humanoids = { ...races, races: races.races.filter((race) => race.rig === 'humanoid') }
  const monsters = []
  for (let index = 0; monsters.length < CHIMERAS_SHOWN && index < 5000; index += 1) {
    const monster = generateMonster(humanoids, { seed: `sheet|chimera|${index}` })
    if (monster.name.startsWith(CHIMERA_WORD)) monsters.push({ ...monster, rank: 'normal', affix: null })
  }
  return { title: 'Chimeras', monsters }
}

/** Everything the sheet draws. */
export function contactSheet(root) {
  const races = readGame(root, 'races.json')
  const bosses = readGame(root, 'bosses.json')
  return {
    rows: [
      ladderRow(races, bosses),
      ...races.races.map((race) => raceRow(races, bosses, race)),
      chimeraRow(races)
    ],
    bosses: bosses.bosses.map((boss) => rosterBoss(bosses, races, boss))
  }
}

/**
 * Serves the sheet at /monsters.html, with the UI's own files under /ui/.
 *
 * @param {{ root: string, port: number }} options
 * @returns {Promise<{ url: string, close: () => void } | null>} null when the port is taken
 */
export function startMonsterSheet({ root, port }) {
  const server = http.createServer((request, response) => {
    const { pathname } = new URL(request.url, 'http://localhost')
    if (pathname === '/monsters.json') return sendJson(response, 200, contactSheet(root))
    const sheetFile = SHEET_FILES[pathname]
    if (sheetFile) {
      const body = fs.readFileSync(path.join(root, 'scripts', 'monster-sheet', sheetFile[0]))
      return send(response, 200, body, sheetFile[1])
    }
    if (pathname.startsWith('/ui/')) return serveFile(response, root, pathname.slice(1))
    return send(response, 404, 'not found')
  })
  return new Promise((resolve) => {
    server.once('error', () => resolve(null))
    server.listen(port, '127.0.0.1', () => {
      resolve({ url: `http://127.0.0.1:${port}/monsters.html`, close: () => server.close() })
    })
  })
}

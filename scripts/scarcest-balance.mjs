// The simulator's check of "Auto: what is scarcest" (src/game/scarcest.mjs): every room set to it
// against the trades the game gives each character, by how far apart the world's gathered stocks
// sit and how much is gathered in all.
import { GATHERING_SKILLS, materialOfSkill } from '../src/game/skills.mjs'
import { fixed, meanOf, percent, printTable } from './game-balance.mjs'

/** The most a year's gathering may fall when every room follows the scarcest, as a share. */
const MAX_GATHERING_LOSS = 0.05

/** Sets every room of the main world to gather what is scarcest, once it plays. */
export function followScarcest(engine, save) {
  let next = save
  for (const projectId of Object.keys(save.worlds.main?.projects ?? {})) {
    next = engine.setRoomTrade(next, { projectId, trade: 'scarcest' })
  }
  return next
}

/**
 * How far apart the world's gathered stocks sit: (most - least) / mean, 0 when all are equal
 * or there is nothing yet.
 */
export function stockSpread(world) {
  const stocks = GATHERING_SKILLS.map((skillId) => world?.materials?.[materialOfSkill(skillId)] ?? 0)
  const mean = meanOf(stocks)
  return mean > 0 ? (Math.max(...stocks) - Math.min(...stocks)) / mean : 0
}

/** One table row per scenario, and a line that says whether the choice did its job. */
export function printScarcest(plainRuns, scarcestRuns) {
  console.log('\n## Gathering: each their own trade against every room on "Auto: what is scarcest"\n')
  const rows = plainRuns.map((plain, index) => {
    const scarce = scarcestRuns[index]
    return [plain.scenario.id, fixed(meanOf(plain.stockSpreads), 2), fixed(meanOf(scarce.stockSpreads), 2),
      Math.round(plain.totals.gathered), Math.round(scarce.totals.gathered),
      percent(scarce.totals.gathered / Math.max(1, plain.totals.gathered) - 1)]
  })
  printTable(['scenario', 'spread', 'scarcest', 'gathered', 'scarcest', 'change'], rows)
  const narrower = plainRuns.every((plain, index) => meanOf(scarcestRuns[index].stockSpreads) < meanOf(plain.stockSpreads))
  const kept = plainRuns.every((plain, index) =>
    scarcestRuns[index].totals.gathered >= plain.totals.gathered * (1 - MAX_GATHERING_LOSS))
  console.log(`Spread: (most - least) / mean of the gathered stocks after each day, averaged over the year. ` +
    `Scarcest narrows it in every scenario: ${narrower ? 'yes' : 'NO'}; gathering stays within ` +
    `${percent(MAX_GATHERING_LOSS)} of its own: ${kept ? 'yes' : 'NO'}.`)
}

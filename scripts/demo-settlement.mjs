// The demo's settlement: the frozen demo shows a Village with buildings at mixed levels, and
// SETTLEMENT=n shows stage n (1 to 7) instead, in the frozen or the live demo, so each stage's
// picture can be reviewed. The levels go in as an imported save would.
import { GROUP_UPGRADE_IDS } from '../src/game/spending.mjs'

/**
 * The frozen demo's Village: 31 building levels, so the bar to the Town has started; the Hearth
 * and the Sanctum at tier II, and the Workshop and the Defences a level short of it, so their
 * cards show the next tier as a teaser.
 */
export const DEMO_VILLAGE = Object.freeze({ campfire: 9, workbench: 4, runeCircle: 8, storehouse: 6, defences: 4 })
/** How a stage's levels are shared out: the buildings every world has get a little more. */
const SHARES = { campfire: 0.26, workbench: 0.2, runeCircle: 0.22, storehouse: 0.16, defences: 0.16 }
/** A stage shown is this far along the way to the next one. */
const PROGRESS = 0.4

/**
 * Building levels that reach a stage and go part of the way to the next, shared among the
 * buildings that stage has opened.
 *
 * @param {number} stageNumber 1 to the number of stages
 * @param {{ stages: { id: string, from: number }[], buildings: { upgrade: string, opensAt: string }[] }} settlement
 *   the parsed game/settlement.json
 * @returns {Record<string, number>}
 */
export function levelsForStage(stageNumber, settlement) {
  const at = Math.min(settlement.stages.length, Math.max(1, Math.round(stageNumber))) - 1
  const stage = settlement.stages[at]
  const next = settlement.stages[at + 1]
  const total = stage.from + (next ? Math.floor((next.from - stage.from) * PROGRESS) : 0)
  const stageIds = settlement.stages.map((entry) => entry.id)
  const open = settlement.buildings.filter((building) => stageIds.indexOf(building.opensAt) <= at).map((building) => building.upgrade)
  const weight = open.reduce((sum, id) => sum + SHARES[id], 0)
  const levels = Object.fromEntries(GROUP_UPGRADE_IDS.map((id) => [id, open.includes(id) ? Math.floor((total * SHARES[id]) / weight) : 0]))
  levels.campfire += total - Object.values(levels).reduce((sum, level) => sum + level, 0)
  return levels
}

/**
 * Gives the demo's world these building levels, as an imported save would, then a round with the
 * clock where it is links the agents again and earns nothing.
 *
 * @param {object} game the demo's game mode
 * @param {Record<string, number>} levels
 */
export async function showDemoSettlement(game, levels) {
  const file = await game.exportSave()
  file.save.worlds.main.upgrades = { ...levels }
  await game.importSave(file)
  await game.round()
}

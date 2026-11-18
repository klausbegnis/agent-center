// The demo's daily quests (docs/GAME.md, "Daily quests"): the day's three as the made-up day left
// them, then set to show what the card can show: the first quest done, the second half way and the
// third not begun, or, with QUESTS=done, all three done with the day's bonus paid and a streak.
// Every name here is made up.

/**
 * Gives the demo's world's quests a mixed progress, or every one done, as an imported save would.
 *
 * @param {object} game the demo's game mode
 * @param {{ allDone?: boolean }} options
 */
export async function showDemoQuests(game, { allDone = false } = {}) {
  const file = await game.exportSave()
  const daily = file.save.worlds.main?.daily
  if (!daily) return
  const shares = allDone ? [1, 1, 1] : [1, 0.5, 0]
  daily.quests = daily.quests.map((quest, at) => {
    const progress = Math.min(quest.target, Math.floor(quest.target * shares[at]))
    return { ...quest, progress, done: progress >= quest.target }
  })
  daily.bonus = allDone
  if (allDone) {
    daily.bonusReward = { ...daily.quests[0].reward }
    daily.streak = 4
  } else {
    delete daily.bonusReward
    daily.streak = Math.min(daily.streak, 3)
  }
  daily.best = Math.max(daily.best, daily.streak, 4)
  await game.importSave(file)
  await game.round()
}

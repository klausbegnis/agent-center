// The demo's achievements: the legendary room's party wearing a title it earned. The achievements
// themselves are the ones the demo's save really earns.

/**
 * Gives a room's party a title, then a round links the agents again.
 *
 * @param {object} game the demo's game mode
 * @param {{ titleRoom: string }} options `titleRoom` is the room whose party wears a title
 */
export async function showDemoChronicle(game, { titleRoom }) {
  // The title is chosen as a person would, from what the save has really earned.
  const titles = game.getView().achievements?.titles ?? []
  if (titles.length) await game.setPartyTitle({ roomId: titleRoom, achievementId: titles[0].id })
  await game.round()
}

// The rank ladder of monsters, from the view state. Never touches the DOM.

/** The ranks, from the plainest to the rarest. */
export const MONSTER_RANKS = ['normal', 'veteran', 'elite', 'champion', 'boss', 'legendary']

/**
 * The rank of a monster: the one the view state sends, or for a monster sent before ranks
 * `boss`, `elite` for one with an affix, otherwise `normal`.
 *
 * @param {{ rank?: string, kind?: string, affix?: string | null } | null} monster
 */
export function monsterRank(monster) {
  if (MONSTER_RANKS.includes(monster?.rank)) return monster.rank
  if (monster?.kind === 'boss') return 'boss'
  return monster?.affix ? 'elite' : 'normal'
}

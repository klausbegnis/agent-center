// The engine's side of achievements and the journal, bound to the content: after every change the
// bridge keeps, `chronicle` counts what it gained into the journal and grants what is now earned;
// the view, a party's title and "seen" are the rest. Pure: the caller passes the time and the day.
import { achievementIndexOf } from './achievement-content.mjs'
import { achievementsView, grantAchievements, setPartyTitle, titleProblem } from './achievements.mjs'
import { instanceIndexOf } from './instance-content.mjs'
import { journalGains } from './journal-gains.mjs'
import { journalView, markJournalSeen, recordJournal } from './journal.mjs'
import { legendaryIndexOf } from './legendary-effects.mjs'
import { settlementIndexOf } from './settlement-content.mjs'
import { traitIndexOf } from './trait-content.mjs'
import { eventIndexOf } from './weekly-content.mjs'

/** The name of what a highlight is about, from the content; null when it is not there. */
function highlightNamer(content) {
  const items = new Map((content.items?.items ?? []).map((entry) => [entry.id, entry.name]))
  const bosses = new Map((content.bosses?.bosses ?? []).map((boss) => [boss.id, boss.name]))
  const instances = new Map((content.instances?.instances ?? []).map((instance) => [instance.id, instance.name]))
  const cities = new Map((content.cities?.cities ?? []).map((city) => [city.id, city.name]))
  const stages = new Map((content.settlement?.stages ?? []).map((stage) => [stage.id, stage.name]))
  const buildings = new Map((content.settlement?.buildings ?? []).map((building) => [building.id, building]))
  return ({ kind, ref, value }) => {
    switch (kind) {
      case 'legendary': return legendaryIndexOf(content)?.byId.get(ref)?.name ?? null
      case 'loot': return items.get(ref) ?? null
      case 'boss': return bosses.get(ref) ?? null
      case 'achievement': return achievementIndexOf(content)?.byId.get(ref)?.name ?? null
      case 'stage': return stages.get(ref) ?? null
      case 'instance': return instances.get(ref) ?? null
      case 'rematch': return instances.get(ref) ?? null
      case 'region': return instanceIndexOf(content)?.regions.find((region) => region.id === ref)?.name ?? null
      case 'scroll': return traitIndexOf(content)?.byId.get(ref)?.name ?? null
      case 'weekly': return eventIndexOf(content)?.byId.get(ref)?.name ?? null
      case 'city': return cities.get(ref) ?? null
      case 'building': return buildings.get(ref)?.tiers?.[(value ?? 1) - 1]?.name ?? buildings.get(ref)?.name ?? null
      default: return null
    }
  }
}

/**
 * @param {object} content the game content; without game/achievements.json nothing is granted,
 *   but the journal is kept
 */
export function chronicleActions(content) {
  const tiers = new Map((content.items?.items ?? []).map((entry) => [entry.id, entry.tier]))
  const nameOf = highlightNamer(content)
  const index = () => achievementIndexOf(content)

  /**
   * Counts a change into the journal and grants what it earned.
   *
   * @param {object} save the save after the change
   * @param {{ before: object | null, midway?: object, events?: object[], at: number, day: number,
   *   isNews?: boolean }} change `isNews` false (an imported game) records nothing in the journal
   * @returns {{ save: object, earned: { id: string, name: string, points: number, title: string | null }[],
   *   backfilled: number | null }}
   */
  function chronicle(save, { before, midway, events = [], at, day, isNews = true }) {
    let next = save
    if (isNews) {
      const gains = journalGains({ before, after: save, midway, events, at, tierOf: (id) => tiers.get(id) ?? 0,
        settlementIndex: settlementIndexOf(content), instanceIndex: instanceIndexOf(content) })
      const journal = recordJournal(save.journal, { day, ...gains })
      if (journal !== save.journal) next = { ...next, journal }
    }
    const granted = grantAchievements(next, { content, index: index(), at })
    next = granted.save
    let earned = granted.earned
    // Achievements are journal news too, and a journal day they open can earn another one.
    for (let fresh = earned; fresh.length && isNews;) {
      next = { ...next, journal: recordJournal(next.journal, {
        day,
        counts: { achievements: fresh.length },
        highlights: fresh.map((id) => ({ at, kind: 'achievement', ref: id }))
      }) }
      const more = grantAchievements(next, { content, index: index(), at })
      next = more.save
      fresh = more.earned
      earned = [...earned, ...fresh]
    }
    return {
      save: next,
      earned: earned.map((id) => index().byId.get(id)).map(({ id, name, points, title }) => ({ id, name, points, title })),
      backfilled: granted.backfilled
    }
  }

  return {
    chronicle,
    /**
     * The achievements and the journal as a UI shows them.
     *
     * @param {object} save
     * @param {{ day: number }} today
     */
    chronicleView: (save, { day }) => ({
      achievements: achievementsView(save, { content, index: index() }),
      journal: journalView(save.journal, { day, nameOf })
    }),
    setPartyTitle: (save, choice) => setPartyTitle(save, choice, index()),
    titleProblem: (save, choice) => titleProblem(save, choice, index()),
    markJournalSeen: (save, at) => ({ ...save, journal: markJournalSeen(save.journal, at) })
  }
}

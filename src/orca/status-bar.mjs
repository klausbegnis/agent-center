// The one-line summary shown in Orca's status bar.

/**
 * @param {{ working: number, waiting: number, blocked: number, subs: number }} counts
 * @returns {{ text: string, tone: 'neutral' | 'accent' | 'warning' | 'danger' }}
 */
export function summarize(counts) {
  const active = counts.working + counts.subs
  const parts = [`${active} active`]
  if (counts.waiting) parts.push(`${counts.waiting} waiting`)
  if (counts.blocked) parts.push(`${counts.blocked} blocked`)

  // The most urgent state wins the colour.
  let tone = 'neutral'
  if (counts.blocked) tone = 'danger'
  else if (counts.waiting) tone = 'warning'
  else if (active) tone = 'accent'

  return { text: parts.join(' · '), tone }
}

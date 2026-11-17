// The content's legendary loot as a UI draws it: every entry with what it is, its buff as data
// (the UI words it from the effect, so text and behaviour cannot drift), its flavour line, colour
// and source. Pure.

/**
 * @param {object} entry a content entry
 * @param {Map<string, string>} bossNames
 */
function entryView(entry, bossNames, instanceNames) {
  const view = { id: entry.id, name: entry.name, kind: entry.kind, effect: { ...entry.effect } }
  for (const key of ['slot', 'damageType', 'class', 'trade', 'city']) {
    if (entry[key] !== undefined) view[key] = entry[key]
  }
  if (entry.boss) view.boss = { id: entry.boss, name: bossNames.get(entry.boss) ?? entry.boss }
  if (entry.instance) view.instance = { id: entry.instance, name: instanceNames.get(entry.instance) ?? entry.instance }
  return { ...view, flavour: entry.flavour, colour: entry.colour }
}

/**
 * @param {import('./legendary-content.mjs').LegendaryIndex | null} index
 * @param {{ bosses: { id: string, name: string }[] } | undefined} bosses for the bosses' names
 * @param {{ instances: { id: string, name: string }[] } | undefined} [instances] for the instances' names
 * @returns {{ relicCount: number, equipmentCount: number, entries: Record<string, object> } | null}
 */
export function legendaryView(index, bosses, instances) {
  if (!index) return null
  const bossNames = new Map((bosses?.bosses ?? []).map((boss) => [boss.id, boss.name]))
  const instanceNames = new Map((instances?.instances ?? []).map((entry) => [entry.id, entry.name]))
  return {
    relicCount: index.relicCount,
    equipmentCount: index.equipmentCount,
    entries: Object.fromEntries([...index.byId].map(([id, entry]) => [id, entryView(entry, bossNames, instanceNames)]))
  }
}

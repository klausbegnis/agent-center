// The words of the settlement: the Camp tab's stage, progress and buildings, the badge above the
// tabs, and the news over the rooms. The names of stages, buildings and tiers come from the view
// state (game/settlement.json). Never touches the DOM.

/** "a Town", "an Outpost". */
const withArticle = (name) => `${/^[AEIOU]/i.test(name) ? 'an' : 'a'} ${name}`
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`

export const SETTLEMENT = {
  title: 'Settlement',
  stageOf: (number, count) => `Stage ${number} of ${count}`,
  /** "31 of 45 building levels to become a Town". */
  toStage: (total, needed, name) => `${total} of ${needed} building levels to become ${withArticle(name)}`,
  toStar: (have, need) => `${have} of ${need} building levels past the last stage to the next renovation star`,
  progressName: 'Way to the next stage',
  stars: (count) => `${plural(count, 'renovation star', 'renovation stars')}`,
  starsShort: (count) => `★ ${count}`,
  heroAlt: (alt, name, number, count) => `${alt}. The settlement is ${withArticle(name)}, stage ${number} of ${count}.`,
  bonusTitle: 'Settlement bonus, for every room of the world',
  noBonus: 'None yet: the next stage brings the first.',
  buildings: 'Buildings',
  buildingsHint: 'Every level of any building counts towards the next stage.',
  level: (level) => `Lv ${level}`,
  notBuilt: 'Not built yet',
  tierOf: (tier, count) => `Tier ${tier} of ${count}`,
  nextTier: (name, levels) => `${name} in ${plural(levels, 'level', 'levels')}`,
  nextTierPicture: (name) => `The next tier, ${name}`,
  opensAt: (name, from) => `Opens at ${name} (${plural(from, 'building level', 'building levels')} in all)`,
  locked: 'Locked',
  now: 'Now',
  next: 'Next level',
  build: 'Build',
  buildAria: (name, level) => `Build ${name} level ${level}`,
  withCoins: 'Or pay half in coins',
  withCoinsHint: 'Half of each material is paid at its base value in coins instead: cheaper than buying it at a market.',
  buildWithCoins: 'Build with coins',
  buildWithCoinsAria: (name, level) => `Build ${name} level ${level}, paying half in coins`,
  coinsFrom: (tierName) => `From ${tierName} on, half can be paid in coins.`,
  needsCoins: (amountText) => `Needs ${amountText} more coins`,
  coins: 'coins',
  badge: (name) => `Settlement: ${name}`,
  badgeOpen: (name) => `Settlement: ${name}. Open the Camp tab`
}

/**
 * What a building does at a level, from its effect in the view state (`effect` or `nextEffect`).
 *
 * @param {string} upgradeId
 * @param {Record<string, number>} effect
 * @param {(share: number) => string} formatShare
 */
export function buildingEffectText(upgradeId, effect, formatShare) {
  const value = effect ?? {}
  if (upgradeId === 'campfire') return `Restores ${formatShare(value.staminaAfterKill)} of missing stamina after each kill`
  if (upgradeId === 'workbench') return `Item upgrades cost ${formatShare(value.upgradeCostFactor)} of their price`
  if (upgradeId === 'runeCircle') return `Monsters arrive with ${formatShare(value.monsterHealthCut)} less health`
  if (upgradeId === 'storehouse') return `The market's fee is ${formatShare(value.marketFee)}`
  if (upgradeId === 'defences') return `Monsters drain ${formatShare(value.staminaDrainCut)} less stamina`
  return ''
}

/** What the news of a settlement says over the rooms. */
export const SETTLEMENT_EVENT = {
  built: (building) => `${building} built!`,
  tier: (building, tierName) => `${building} grew into ${withArticle(tierName)}!`,
  stage: (name) => `The settlement is now ${withArticle(name)}!`,
  stars: (count) => `Renovated: ★ ${count}`
}

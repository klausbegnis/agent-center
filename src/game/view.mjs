// A plain summary of the save that a UI can draw without knowing any game rule: levels and
// progress, materials, upgrades with their next cost, and each project's fight and party.
import { bestiaryContentView, worldBestiaryView } from './bestiary-view.mjs'
import { seasoning } from './characters.mjs'
import { citiesOfWeek } from './city-festival.mjs'
import { cityRankIndexOf } from './city-ranks-content.mjs'
import { findItem } from './chest.mjs'
import { TICK_SECONDS } from './constants.mjs'
import { canAfford, effectiveGearLevel, itemFactor, upgradeCost } from './items.mjs'
import { legendaryIndexOf, upgradeDiscountOf } from './legendary-effects.mjs'
import { legendaryView } from './legendary-view.mjs'
import { legendaryOf } from './legendary.mjs'
import { marketView } from './market-view.mjs'
import { cooldownsView, instancesContentView, runView, worldInstancesView } from './instance-view.mjs'
import { killsToPass, rankOf } from './monsters.mjs'
import { engineeringSpeed } from './power.mjs'
import { canPrestige, characterXpToNext, effectiveLevel, emptySkill, worldLevel, xpToNext } from './progression.mjs'
import { retireeBonus } from './retirement.mjs'
import { settlementIndexOf } from './settlement-content.mjs'
import { groupEffect, settlementView } from './settlement-view.mjs'
import { GATHERING_SKILLS, MATERIALS, WORK_SKILLS } from './skills.mjs'
import { GROUP_UPGRADE_IDS, groupLevel, groupUpgradeCost, isUpgradeOpen } from './spending.mjs'
import { effectiveTrade, tradeChoiceOf } from './trades.mjs'
import { withTraitsView } from './trait-view.mjs'
import { weeklyView } from './weekly-view.mjs'
import { worldEffectsOf } from './world-effects.mjs'

/** A skill as a UI shows it: level, stars, effective level and progress to the next level. */
function skillView(skillId, skill = emptySkill()) {
  return {
    id: skillId,
    level: skill.level,
    stars: skill.stars,
    effectiveLevel: effectiveLevel(skill),
    progress: canPrestige(skill) ? 1 : skill.xp / xpToNext(skill.level),
    canPrestige: canPrestige(skill)
  }
}

function itemView(item, names, { workbenchLevel, level, materials, relicDiscount = 0 }) {
  const cost = upgradeCost(item, { workbenchLevel, worldLevel: level, relicDiscount })
  return {
    // Legendary equipment: its entry names its art, buff and flavour line (legendaryView).
    ...(item.legendary ? { legendary: true, entryId: item.entryId } : {}),
    id: item.id,
    name: names.get(item.entryId ?? item.id) ?? item.id,
    slot: item.slot,
    damageType: item.damageType ?? null,
    tier: item.tier,
    level: item.level,
    power: effectiveGearLevel(item),
    factor: itemFactor(item),
    heldBy: item.heldBy,
    upgradeCost: cost,
    affordable: canAfford(materials, cost)
  }
}

function characterView(character, project, names, prices) {
  const equipped = (id) => {
    const item = id ? findItem(project.chest, id) : null
    return item ? itemView(item, names, prices) : null
  }
  return {
    sessionId: character.sessionId,
    class: character.class,
    pinned: { ...character.pinned },
    level: character.level,
    levelProgress: Math.min(1, (character.xp ?? 0) / characterXpToNext(character.level)),
    seasoning: seasoning(character.level),
    attributes: { ...character.attributes },
    equipment: {
      weapon: equipped(character.equipment?.weapon),
      outfit: equipped(character.equipment?.outfit),
      tool: equipped(character.equipment?.tool)
    },
    trade: effectiveTrade(character, project),
    tradeChoice: tradeChoiceOf(character.tradeChoice),
    autoTrade: character.trade ?? null,
    state: character.state ?? 'idle',
    tokens: character.tokens
  }
}

function monsterView(monster) {
  if (!monster) return null
  return {
    id: monster.id,
    name: monster.name,
    kind: monster.kind,
    rank: rankOf(monster),
    affix: monster.affix,
    level: monster.level,
    healthShare: monster.maxHp > 0 ? monster.hp / monster.maxHp : 0,
    // Whole points: rounded up, so a monster still standing never reads 0.
    hp: Math.ceil(monster.hp),
    maxHp: Math.ceil(monster.maxHp),
    ...(monster.look ? { race: monster.race, look: monster.look } : { sprite: { ...monster.sprite } })
  }
}

function projectView(projectId, project, world, names, index, content, worldId) {
  const prices = {
    workbenchLevel: groupLevel(world.upgrades, 'workbench'),
    level: worldLevel(world.skills),
    materials: world.materials,
    relicDiscount: upgradeDiscountOf(project, index, worldEffectsOf(world, content))
  }
  return {
    id: projectId,
    wave: project.wave,
    waveKills: project.waveKills,
    kills: project.kills ?? 0,
    killsToPass: killsToPass(project.wave, worldLevel(world.skills)),
    monster: monsterView(project.monster),
    stamina: project.stamina,
    resting: project.restTicks > 0,
    tradeChoice: tradeChoiceOf(project.tradeChoice),
    party: Object.keys(project.characters).sort()
      .map((sessionId) => characterView(project.characters[sessionId], project, names, prices)),
    chest: project.chest.map((item) => itemView(item, names, prices)),
    retirees: project.retirees.map((retiree) => ({ ...retiree, attributes: { ...retiree.attributes } })),
    retiredCount: project.retiredCount,
    retireeBonus: retireeBonus(project),
    relics: { owned: [...legendaryOf(project).relics], active: legendaryOf(project).active },
    // A room inside an instance, and its cooldowns after a run that did not clear (instance-view.mjs).
    run: runView(worldId, projectId, project, world, content),
    instanceCooldowns: cooldownsView(project)
  }
}

function worldView(worldId, world, names, content, index) {
  const settlement = settlementIndexOf(content)
  return {
    id: worldId,
    level: worldLevel(world.skills),
    attackSpeed: engineeringSpeed(world.skills),
    workSkills: WORK_SKILLS.map((skillId) => skillView(skillId, world.skills[skillId])),
    gatheringSkills: GATHERING_SKILLS.map((skillId) => skillView(skillId, world.skills[skillId])),
    materials: Object.fromEntries(MATERIALS.map((id) => [id, world.materials[id] ?? 0])),
    // The buildings the settlement has opened: the Storehouse and the Defences come with its stages.
    upgrades: GROUP_UPGRADE_IDS.filter((id) => isUpgradeOpen(world, id, settlement)).map((upgradeId) => {
      const level = groupLevel(world.upgrades, upgradeId)
      const cost = groupUpgradeCost(upgradeId, level, worldLevel(world.skills))
      const affordable = canAfford(world.materials, cost)
      return { id: upgradeId, level, cost, affordable, effect: groupEffect(upgradeId, level) }
    }),
    projects: Object.keys(world.projects).sort()
      .map((projectId) => projectView(projectId, world.projects[projectId], world, names, index, content, worldId)),
    coins: world.coins ?? 0,
    market: marketView(worldId, world, { cities: citiesOfWeek(content.cities?.cities ?? [], world, content), items: content.items, legendary: content.legendary,
      cityRanks: cityRankIndexOf(content) }),
    bestiary: worldBestiaryView(world, content),
    settlement: settlementView(world, content),
    instances: worldInstancesView(worldId, world, content),
    // This week's event, its goal and next week's (weekly-view.mjs); null before the first advance.
    weekly: weeklyView(world, content)
  }
}

/**
 * The view of a save.
 *
 * @param {object} save
 * @param {{ items: { items: object[] }, cities?: { cities: object[] } }} content for item names,
 *   the market's cities and the stalls' gear
 * @returns {{ worlds: object[], projectWorld: Record<string, string | null>, keepTitles: boolean,
 *   tickSeconds: number, itemEntries: Record<string, { name: string, tier: number }>,
 *   legendary: object | null, bestiary: object | null }} `itemEntries` names the content's items by
 *   entry id, for telling what a drop was; `legendary` describes the content's legendary loot
 *   (legendary-view.mjs); `bestiary` the bestiary's races and bosses (bestiary-view.mjs)
 */
export function viewOf(save, content) {
  const names = new Map(content.items.items.map((entry) => [entry.id, entry.name]))
  const index = legendaryIndexOf(content)
  for (const [id, entry] of index?.byId ?? []) names.set(id, entry.name)
  // Traits add their parts to the worlds, rooms and characters (trait-view.mjs).
  return withTraitsView({
    worlds: Object.keys(save.worlds).sort().map((worldId) => worldView(worldId, save.worlds[worldId], names, content, index)),
    projectWorld: { ...save.projectWorld },
    keepTitles: save.settings.keepTitles,
    tickSeconds: TICK_SECONDS,
    itemEntries: Object.fromEntries(content.items.items
      .map((entry) => [entry.id, { name: entry.name, tier: entry.tier }])),
    legendary: legendaryView(index, content.bosses, content.instances),
    bestiary: bestiaryContentView(content),
    instances: instancesContentView(content)
  }, save, content)
}

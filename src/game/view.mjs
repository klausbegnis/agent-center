// A plain summary of the save that a UI can draw without knowing any game rule: levels and
// progress, materials, upgrades with their next cost, and each project's fight and party.
import { seasoning } from './characters.mjs'
import { findItem } from './chest.mjs'
import { WORKBENCH_DISCOUNT_PER_LEVEL } from './constants.mjs'
import { canAfford, effectiveGearLevel, itemFactor, upgradeCost } from './items.mjs'
import { killsToPass } from './monsters.mjs'
import { engineeringSpeed } from './power.mjs'
import { canPrestige, characterXpToNext, effectiveLevel, emptySkill, worldLevel, xpToNext } from './progression.mjs'
import { retireeBonus } from './retirement.mjs'
import { GATHERING_SKILLS, MATERIALS, WORK_SKILLS } from './skills.mjs'
import {
  GROUP_UPGRADE_IDS,
  campfireShare,
  groupLevel,
  groupUpgradeCost,
  runeCircleShare
} from './spending.mjs'

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

/** What a group upgrade does at its level, as one number a UI can format. */
function groupEffect(upgradeId, level) {
  if (upgradeId === 'campfire') return { staminaAfterKill: campfireShare(level) }
  if (upgradeId === 'runeCircle') return { monsterHealthCut: runeCircleShare(level) }
  return { upgradeCostFactor: 1 / (1 + WORKBENCH_DISCOUNT_PER_LEVEL * level) }
}

function itemView(item, names, { workbenchLevel, level, materials }) {
  const cost = upgradeCost(item, { workbenchLevel, worldLevel: level })
  return {
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
    level: character.level,
    levelProgress: Math.min(1, (character.xp ?? 0) / characterXpToNext(character.level)),
    seasoning: seasoning(character.level),
    attributes: { ...character.attributes },
    equipment: {
      weapon: equipped(character.equipment?.weapon),
      outfit: equipped(character.equipment?.outfit),
      tool: equipped(character.equipment?.tool)
    },
    trade: character.trade,
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
    affix: monster.affix,
    level: monster.level,
    healthShare: monster.maxHp > 0 ? monster.hp / monster.maxHp : 0,
    sprite: { ...monster.sprite }
  }
}

function projectView(projectId, project, world, names) {
  const prices = {
    workbenchLevel: groupLevel(world.upgrades, 'workbench'),
    level: worldLevel(world.skills),
    materials: world.materials
  }
  return {
    id: projectId,
    wave: project.wave,
    waveKills: project.waveKills,
    killsToPass: killsToPass(project.wave, worldLevel(world.skills)),
    monster: monsterView(project.monster),
    stamina: project.stamina,
    resting: project.restTicks > 0,
    party: Object.keys(project.characters).sort()
      .map((sessionId) => characterView(project.characters[sessionId], project, names, prices)),
    chest: project.chest.map((item) => itemView(item, names, prices)),
    retirees: project.retirees.map((retiree) => ({ ...retiree, attributes: { ...retiree.attributes } })),
    retiredCount: project.retiredCount,
    retireeBonus: retireeBonus(project)
  }
}

function worldView(worldId, world, names) {
  return {
    id: worldId,
    level: worldLevel(world.skills),
    attackSpeed: engineeringSpeed(world.skills),
    workSkills: WORK_SKILLS.map((skillId) => skillView(skillId, world.skills[skillId])),
    gatheringSkills: GATHERING_SKILLS.map((skillId) => skillView(skillId, world.skills[skillId])),
    materials: Object.fromEntries(MATERIALS.map((id) => [id, world.materials[id] ?? 0])),
    upgrades: GROUP_UPGRADE_IDS.map((upgradeId) => {
      const level = groupLevel(world.upgrades, upgradeId)
      const cost = groupUpgradeCost(upgradeId, level, worldLevel(world.skills))
      const affordable = canAfford(world.materials, cost)
      return { id: upgradeId, level, cost, affordable, effect: groupEffect(upgradeId, level) }
    }),
    projects: Object.keys(world.projects).sort()
      .map((projectId) => projectView(projectId, world.projects[projectId], world, names))
  }
}

/**
 * The view of a save.
 *
 * @param {object} save
 * @param {{ items: { items: object[] } }} content for item names
 * @returns {{ worlds: object[], projectWorld: Record<string, string | null>, keepTitles: boolean }}
 */
export function viewOf(save, content) {
  const names = new Map(content.items.items.map((entry) => [entry.id, entry.name]))
  return {
    worlds: Object.keys(save.worlds).sort().map((worldId) => worldView(worldId, save.worlds[worldId], names)),
    projectWorld: { ...save.projectWorld },
    keepTitles: save.settings.keepTitles
  }
}

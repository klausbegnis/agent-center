// The Camp tab: the three group upgrades of the room's world, each with what its
// level does now and at the next level, its price and the Build button, then the auto-spend switch.
import { groupEffectAt } from './arsenal-model.js'
import { el } from './dom.js'
import { replaceKeepingFocus, section, settingSwitch } from './game-controls.js'
import { formatShare } from './game-format.js'
import { gameIcon } from './icon-view.js'
import { ARSENAL, levelShort, UPGRADE_LABEL, upgradeEffectText } from './labels.js'
import { purchase } from './price-view.js'

/**
 * @param {{ actions: Record<string, (...args: unknown[]) => Promise<boolean>> }} options
 */
export function createCampView({ actions }) {
  const element = el('div', 'ac-game-camp-section')
  const upgrades = el('div', 'ac-game-camp-upgrades')
  element.append(upgrades)
  const autoSpend = actions.setAutoSpend
    ? settingSwitch(ARSENAL.autoSpend, ARSENAL.autoSpendHint, actions.setAutoSpend)
    : null
  if (autoSpend) element.append(section(ARSENAL.spending, [autoSpend.element], 'ac-game-camp-spending'))
  let drawn = null

  function effectRows(upgrade) {
    const nextLevel = upgrade.level + 1
    const next = { ...upgrade, level: nextLevel, effect: groupEffectAt(upgrade.id, nextLevel) }
    const facts = el('dl', 'ac-game-item-facts')
    for (const [term, value] of [
      [ARSENAL.now, upgrade.level ? upgradeEffectText(upgrade, formatShare) : ARSENAL.notBuilt],
      [ARSENAL.nextLevel, upgradeEffectText(next, formatShare)]
    ]) {
      const pair = el('div', 'ac-game-item-fact')
      pair.append(el('dt', '', term), el('dd', '', value))
      facts.append(pair)
    }
    return facts
  }

  function upgradeCard(world, upgrade) {
    const name = UPGRADE_LABEL[upgrade.id] ?? upgrade.id
    const node = el('article', 'ac-game-card ac-game-camp-upgrade')
    const head = el('div', 'ac-game-item-head')
    const what = el('div', 'ac-game-item-what ac-game-item-what-inline')
    what.append(el('h3', 'ac-game-item-name', name), el('span', 'ac-muted', levelShort(upgrade.level)))
    head.append(gameIcon(upgrade.id, 'ac-game-item-icon'), what)
    node.append(head, effectRows(upgrade), purchase({
      cost: upgrade.cost,
      affordable: upgrade.affordable,
      materials: world.materials,
      label: ARSENAL.buy,
      ariaLabel: ARSENAL.buyUpgrade(name, upgrade.level + 1),
      key: `upgrade:${upgrade.id}`,
      onBuy: actions.buyGroupUpgrade && (() => actions.buyGroupUpgrade(world.id, upgrade.id))
    }))
    return node
  }

  return {
    element,
    /** @param {{ game: object, world: object }} next */
    update({ game, world }) {
      autoSpend?.set(game.autoSpend === true)
      const signature = JSON.stringify([world.id, world.upgrades, world.materials])
      if (signature === drawn) return
      drawn = signature
      replaceKeepingFocus(upgrades, (world.upgrades ?? []).map((upgrade) => upgradeCard(world, upgrade)))
    }
  }
}

// Connects the scene engine to Orca: used by the sidebar panel and the editor tab.
import { REPOSITORY_URL } from '../engine/project-link.js'
import { mountStage } from '../engine/stage.js'

const orca = window.orca
const app = document.getElementById('app')
const isTab = document.body.dataset.surface === 'tab'

const transport = {
  base: '../',
  getState: () => orca.plugin.request('state.get'),
  refresh: () => orca.plugin.request('state.refresh', undefined, { timeoutMs: 40_000 }),
  onState: (listener) => orca.plugin.on('state.changed', listener),
  setTheme: (id) => orca.plugin.request('theme.set', { id }),
  setRoomHidden: (id, hidden) => orca.plugin.request('room.hide', { id, hidden }),
  setRoomTheme: (id, theme) => orca.plugin.request('room.theme', { id, theme }),
  // The frame cannot navigate away from the plugin folder; Orca opens the browser on a click.
  openRepository: () => orca.shell.openExternal(REPOSITORY_URL),
  openWorkspace: (workspaceId, agentId) => orca.plugin.request('workspace.open', { workspaceId, agentId }),
  // The game. The worker checks every value and answers { changed }.
  prestigeSkill: (worldId, skillId) => orca.plugin.request('game.prestige', { worldId, skillId }),
  upgradeItem: (roomId, itemId) => orca.plugin.request('game.upgradeItem', { roomId, itemId }),
  buyGroupUpgrade: (worldId, upgradeId, useCoins = false) =>
    orca.plugin.request('game.buyUpgrade', { worldId, upgradeId, useCoins }),
  moveRoomToWorld: (roomId, worldId) => orca.plugin.request('game.assignRoom', { roomId, worldId }),
  resetWorld: (worldId) => orca.plugin.request('game.resetWorld', { worldId }),
  rebalanceSkills: (worldId) => orca.plugin.request('game.rebalanceSkills', { worldId }),
  setActiveRelic: (roomId, relicId) => orca.plugin.request('game.setActiveRelic', { roomId, relicId }),
  setAutoSpend: (on) => orca.plugin.request('game.autoSpend', { on }),
  setTravel: (on) => orca.plugin.request('game.travel', { on }),
  setCharacterTrade: (roomId, sessionId, trade) =>
    orca.plugin.request('game.characterTrade', { roomId, sessionId, trade }),
  setRoomTrade: (roomId, trade) => orca.plugin.request('game.roomTrade', { roomId, trade }),
  setEquipment: (roomId, sessionId, slot, itemId) =>
    orca.plugin.request('game.equip', { roomId, sessionId, slot, itemId }),
  bestGear: (roomId) => orca.plugin.request('game.bestGear', { roomId }),
  setKeepTitles: (on) => orca.plugin.request('game.keepTitles', { on }),
  exportSave: () => orca.plugin.request('game.exportSave'),
  importSave: (file) => orca.plugin.request('game.importSave', { file }),
  moveOrphanItems: (fromRoomId, toRoomId) => orca.plugin.request('game.moveOrphanItems', { fromRoomId, toRoomId }),
  sendItem: (roomId, toRoomId, itemIds, confirmHeld) =>
    orca.plugin.request('game.sendItem', { roomId, toRoomId, itemIds, confirmHeld }),
  sendRelic: (roomId, toRoomId, relicId) => orca.plugin.request('game.sendRelic', { roomId, toRoomId, relicId }),
  enterInstance: (roomId, instanceId, tier) => orca.plugin.request('game.enterInstance', { roomId, instanceId, tier }),
  chooseBoon: (roomId, boonId) => orca.plugin.request('game.chooseBoon', { roomId, boonId }),
  recallParty: (roomId) => orca.plugin.request('game.recallParty', { roomId }),
  setPartyTitle: (roomId, achievementId) => orca.plugin.request('game.partyTitle', { roomId, achievementId }),
  markSummarySeen: () => orca.plugin.request('game.summarySeen'),
  sellMaterial: (worldId, cityId, materialId, amount) =>
    orca.plugin.request('game.sell', { worldId, cityId, materialId, amount }),
  tradeMaterial: (worldId, cityId, fromId, toId, amount) =>
    orca.plugin.request('game.trade', { worldId, cityId, fromId, toId, amount }),
  buyStallOffer: (worldId, cityId, offerIndex, entryId, roomId) =>
    orca.plugin.request('game.buyOffer', { worldId, cityId, offerIndex, entryId, roomId }),
  // The panel and the tab keep their own view choice.
  prefs: {
    get: (key) => orca.storage.get(`${key}:${isTab ? 'tab' : 'panel'}`),
    set: (key, value) => orca.storage.set(`${key}:${isTab ? 'tab' : 'panel'}`, value)
  }
}

const actions = [
  {
    label: 'Pop out',
    title: 'Opens the external view in the browser: detached window, fullscreen or mini',
    onClick: async () => {
      const { webUrl } = await transport.getState()
      if (!webUrl) {
        await orca.host.call('notifications.show', { title: 'Agent Center', body: 'The external view is turned off.' }).catch(() => {})
        return
      }
      await orca.shell.openExternal(webUrl)
    }
  }
]

if (!isTab) {
  // Tray: collapses to a strip with only the counters and raises back to the full room.
  actions.push({
    label: 'Collapse',
    title: 'Collapses or raises the room',
    onClick: async (event) => {
      const collapsed = app.classList.toggle('ac-collapsed')
      event.currentTarget.textContent = collapsed ? 'Raise' : 'Collapse'
      await orca.storage.set('collapsed', collapsed).catch(() => {})
    }
  })
}

await mountStage(app, transport, { actions })

if (!isTab) {
  const collapsed = (await orca.storage.get('collapsed').catch(() => false)) === true
  app.classList.toggle('ac-collapsed', collapsed)
  if (collapsed) {
    const button = [...app.querySelectorAll('.ac-button')].find((node) => node.textContent === 'Collapse')
    if (button) button.textContent = 'Raise'
  }
}

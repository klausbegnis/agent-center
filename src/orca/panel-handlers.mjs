// Requests the sidebar panel and the editor tab send to the worker.

/**
 * @param {{ panels: { handle: (name: string, handler: (input: any) => unknown) => unknown } }} orca
 * @param {import('../controller.mjs').Controller} controller
 */
export function registerPanelHandlers(orca, controller) {
  const ok = { ok: true }

  orca.panels.handle('state.get', () => controller.getState())
  orca.panels.handle('state.refresh', () => controller.refresh())
  orca.panels.handle('theme.set', async (input) => {
    await controller.setTheme(String(input?.id))
    return ok
  })
  orca.panels.handle('room.theme', async (input) => {
    await controller.setRoomTheme(String(input?.id), input?.theme ?? null)
    return ok
  })
  orca.panels.handle('room.hide', async (input) => {
    await controller.setRoomHidden(String(input?.id), input?.hidden !== false)
    return ok
  })
  orca.panels.handle('workspace.open', async (input) => {
    await controller.openWorkspace(String(input?.workspaceId), input?.agentId ? String(input.agentId) : null)
    return ok
  })
  // The game. The controller checks every value; these only pick the fields out.
  orca.panels.handle('game.prestige', (input) => controller.gamePrestige(input?.worldId, input?.skillId))
  orca.panels.handle('game.upgradeItem', (input) => controller.gameUpgradeItem(input?.roomId, input?.itemId))
  orca.panels.handle('game.buyUpgrade', (input) =>
    controller.gameBuyUpgrade(input?.worldId, input?.upgradeId, input?.useCoins ?? false))
  orca.panels.handle('game.assignRoom', (input) => controller.gameAssignRoom(input?.roomId, input?.worldId ?? null))
  orca.panels.handle('game.resetWorld', (input) => controller.gameResetWorld(input?.worldId))
  orca.panels.handle('game.rebalanceSkills', (input) => controller.gameRebalanceSkills(input?.worldId))
  orca.panels.handle('game.setActiveRelic', (input) =>
    controller.gameSetActiveRelic(input?.roomId, input?.relicId ?? null))
  orca.panels.handle('game.autoSpend', (input) => controller.gameSetAutoSpend(input?.on))
  orca.panels.handle('game.travel', (input) => controller.gameSetTravel(input?.on))
  orca.panels.handle('game.characterTrade', (input) =>
    controller.gameSetCharacterTrade(input?.roomId, input?.sessionId, input?.trade ?? null))
  orca.panels.handle('game.equip', (input) =>
    controller.gameSetEquipment(input?.roomId, input?.sessionId, input?.slot, input?.itemId ?? null))
  orca.panels.handle('game.bestGear', (input) => controller.gameBestGear(input?.roomId))
  orca.panels.handle('game.roomTrade', (input) => controller.gameSetRoomTrade(input?.roomId, input?.trade ?? null))
  orca.panels.handle('game.keepTitles', (input) => controller.gameSetKeepTitles(input?.on))
  orca.panels.handle('game.exportSave', () => controller.gameExportSave())
  orca.panels.handle('game.importSave', (input) => controller.gameImportSave(input?.file))
  orca.panels.handle('game.moveOrphanItems', (input) =>
    controller.gameMoveOrphanItems(input?.fromRoomId, input?.toRoomId))
  orca.panels.handle('game.sendItem', (input) =>
    controller.gameSendItem(input?.roomId, input?.toRoomId,
      input?.itemIds ?? (input?.itemId === undefined ? undefined : [input.itemId]), input?.confirmHeld ?? false))
  orca.panels.handle('game.sendRelic', (input) =>
    controller.gameSendRelic(input?.roomId, input?.toRoomId, input?.relicId))
  orca.panels.handle('game.sell', (input) =>
    controller.gameSellMaterial(input?.worldId, input?.cityId, input?.materialId, input?.amount))
  orca.panels.handle('game.trade', (input) =>
    controller.gameTradeMaterial(input?.worldId, input?.cityId, input?.fromId, input?.toId, input?.amount))
  orca.panels.handle('game.buyOffer', (input) =>
    controller.gameBuyStallOffer(input?.worldId, input?.cityId, input?.offerIndex, input?.entryId, input?.roomId))
  orca.panels.handle('game.enterInstance', (input) =>
    controller.gameEnterInstance(input?.roomId, input?.instanceId, input?.tier, input?.rematch))
  orca.panels.handle('game.chooseBoon', (input) => controller.gameChooseBoon(input?.roomId, input?.boonId))
  orca.panels.handle('game.recallParty', (input) => controller.gameRecallParty(input?.roomId))
  orca.panels.handle('game.partyTitle', (input) => controller.gameSetPartyTitle(input?.roomId, input?.achievementId ?? null))
  orca.panels.handle('game.summarySeen', () => controller.gameMarkSummarySeen())
  orca.panels.handle('game.trait', (input) => controller.gameTraitAction(input)),
  orca.panels.handle('game.buyCharter', (input) => controller.gameBuyCharter(input?.worldId, input?.cityId))
}

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
}

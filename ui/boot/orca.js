// Connects the scene engine to Orca: used by the sidebar panel and the editor tab.
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
  openWorkspace: (workspaceId, agentId) => orca.plugin.request('workspace.open', { workspaceId, agentId }),
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

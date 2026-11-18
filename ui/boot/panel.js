// Loads the Orca panel and the editor tab. Orca serves a panel about 32 files at a time and answers
// 503 to the rest, and the browser asks for a module's imports all at once, so the scene's modules
// are loaded here one by one, each after the ones it imports (panel-modules.js). The last one is
// orca.js, which mounts the scene.
import { PANEL_MODULES } from './panel-modules.js'

/** Tries a module a few times: a busy host may still refuse a file now and then. */
const LOAD_TRIES = 3
const RETRY_DELAY_MS = 300

async function load(module) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await import(module)
    } catch (error) {
      if (attempt >= LOAD_TRIES) throw error
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt))
    }
  }
}

try {
  for (const module of PANEL_MODULES) await load(module)
} catch (error) {
  console.error('load the panel', error)
  const message = document.createElement('p')
  message.textContent = 'Agent Center could not load. Close and open the panel again.'
  message.style.padding = '12px'
  document.getElementById('app')?.replaceChildren(message)
}

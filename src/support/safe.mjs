// Host calls can fail for reasons the plugin cannot fix (a capability the user has not granted,
// a service that is not up yet). One failed call must never take the worker down.

/**
 * @param {(message: string) => void} log
 * @returns {<T>(label: string, run: () => T | Promise<T>, fallback?: T) => Promise<T>}
 */
export function createSafe(log) {
  return async function safe(label, run, fallback) {
    try {
      return await run()
    } catch (error) {
      log(`${label}: ${error?.code ?? ''} ${error?.message ?? error}`.replace(/\s+/g, ' '))
      return fallback
    }
  }
}

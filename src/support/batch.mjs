// Collapses a burst of "something changed" signals into one call.

/**
 * @param {number} delayMs how long to wait for more signals before running
 * @param {() => void} run
 * @param {(message: string) => void} [log] told when `run` throws; a throw inside a timer would
 *   otherwise end the process
 * @returns {(() => void) & { cancel: () => void }} call it on every change; `run` fires once
 *   per burst. `cancel` drops a burst that has not fired yet.
 */
export function createBatcher(delayMs, run, log = () => {}) {
  let timer = null
  function schedule() {
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      try {
        run()
      } catch (error) {
        log(`publish: ${error?.message ?? error}`)
      }
    }, delayMs)
  }
  schedule.cancel = () => {
    clearTimeout(timer)
    timer = null
  }
  return schedule
}

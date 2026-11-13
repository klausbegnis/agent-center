// Counts how long an agent worked at each activity and how many tool calls it started, so the
// game can estimate its tokens when Orca gives no token totals. Pure: the caller passes the time.

/**
 * @typedef {{ startedAt: number, countedAt: number, workedMs: Record<string, number>,
 *   toolCalls: number }} WorkMeter `countedAt` is when working time was last added up
 * @typedef {{ startedAt: number, workedMs: Record<string, number>, toolCalls: number }} MeterReading
 */

/**
 * A meter that starts counting now.
 *
 * @param {number} at
 * @returns {WorkMeter}
 */
export function createWorkMeter(at) {
  return { startedAt: at, countedAt: at, workedMs: {}, toolCalls: 0 }
}

/**
 * Adds the time since the meter was last settled to the activity the agent had during it, when
 * it was working. Call it before the agent's state or activity changes, and before reading.
 *
 * @param {WorkMeter} meter changed in place: the store owns it
 * @param {{ state: string, activity: string }} agent the state and activity the agent had until `at`
 * @param {number} at
 */
export function settleWorkMeter(meter, { state, activity }, at) {
  const elapsed = Math.max(0, at - meter.countedAt)
  if (state === 'working' && elapsed > 0) meter.workedMs[activity] = (meter.workedMs[activity] ?? 0) + elapsed
  meter.countedAt = Math.max(meter.countedAt, at)
}

/**
 * Counts one tool call started.
 *
 * @param {WorkMeter} meter changed in place
 */
export function countToolCall(meter) {
  meter.toolCalls += 1
}

/**
 * Adds what one meter counted to another, for two entries found to be the same agent.
 *
 * @param {WorkMeter} into changed in place
 * @param {WorkMeter} from
 */
export function mergeWorkMeters(into, from) {
  for (const [activity, ms] of Object.entries(from.workedMs)) into.workedMs[activity] = (into.workedMs[activity] ?? 0) + ms
  into.toolCalls += from.toolCalls
  into.startedAt = Math.min(into.startedAt, from.startedAt)
}

/**
 * A copy of what the meter counted, safe to hand out.
 *
 * @param {WorkMeter} meter
 * @returns {MeterReading}
 */
export function readWorkMeter(meter) {
  return { startedAt: meter.startedAt, workedMs: { ...meter.workedMs }, toolCalls: meter.toolCalls }
}

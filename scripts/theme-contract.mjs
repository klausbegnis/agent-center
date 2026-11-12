// The theme contract as `npm run check` enforces it: what every folder under themes/ must hold,
// the template included. rules/themes.md states the contract in words and THEMES.md explains it
// to theme authors.
import fs from 'node:fs'
import path from 'node:path'
import { RANDOM_THEME } from '../src/preferences.mjs'
import { TEMPLATE_THEME } from '../src/themes.mjs'
import {
  EFFECT_MOTIONS,
  EMOTE_MOMENTS,
  EMOTE_MOTIONS,
  MAX_EMOTE_SECONDS,
  MIN_EMOTE_SECONDS
} from '../ui/engine/emotes.js'

const ROOM_ASPECT = 8 / 5
const ASPECT_TOLERANCE = 0.01
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const ACTIVITIES = ['idle', 'think', 'delegate', 'write', 'run', 'read', 'wait', 'blocked', 'done', 'sleep']
const OTHER_ACTIVITIES = ACTIVITIES.filter((activity) => activity !== 'idle')
/** The idle motions the engine can give a familiar. ui/stage.css has an animation for each. */
const FAMILIAR_MOTIONS = ['bob', 'hover']
/**
 * The keys of one entry of actors.emotes. The motions, effect motions and moments an emote may
 * name are the engine's own lists, in ui/engine/emotes.js.
 */
export const EMOTE_KEYS = ['id', 'on', 'when', 'motion', 'effect', 'effectMotion', 'pose', 'seconds']
const REQUIRED_EMOTE_KEYS = ['id', 'on']
/** What a theme may set under ui.vars. ui/stage.css reads each one as `--ac-<name>`. */
const UI_VARS = [
  'frame',
  'label',
  'label-shadow',
  'bubble-wait',
  'bubble-blocked',
  'bubble-sleep',
  'bubble-ink',
  'font'
]

/** The fields no theme works without. A species named "default" is required as well. */
const REQUIRED_THEME_FIELDS = [
  'name',
  'room.width',
  'room.height',
  'room.background',
  'actors.file',
  'actors.width',
  'actors.height',
  'actors.poses.idle',
  'stations.idle'
]

/**
 * Every field of theme.json the engine reads. This is the only list of them: a theme may use
 * nothing else, the template (themes/_template) must use all of them and THEMES.md must name
 * all of them, so a field added here cannot be forgotten in either. "*" stands for a species,
 * whose name is the theme's choice.
 */
export const THEME_FIELDS = [
  ...REQUIRED_THEME_FIELDS,
  'version',
  'room.backgrounds',
  'room.variants.hues',
  'room.variants.flip',
  'actors.subScale',
  'actors.familiar.symbol',
  'actors.familiar.width',
  'actors.familiar.height',
  'actors.familiar.lift',
  'actors.familiar.motion',
  'actors.familiar.emotes',
  'actors.emotes',
  'actors.hueShift',
  'actors.outfits',
  'actors.outfitColors',
  ...OTHER_ACTIVITIES.map((activity) => `actors.poses.${activity}`),
  'actors.species.*.parts',
  'actors.species.*.colors',
  'stations.enter',
  ...OTHER_ACTIVITIES.map((activity) => `stations.${activity}`),
  'ui.pixelated',
  ...UI_VARS.map((name) => `ui.vars.${name}`)
]
const SPECIES_KEYS = THEME_FIELDS.filter((field) => field.includes('*')).map((field) =>
  field.split('.').pop()
)

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * The fields a theme.json uses, spelled as in THEME_FIELDS, and the ones the contract lacks.
 *
 * @returns {{ used: Set<string>, unknown: string[] }}
 */
export function themeFields(theme) {
  const used = new Set()
  const unknown = []
  const walk = (value, trail) => {
    for (const [key, child] of Object.entries(value)) {
      const field = [...trail, trail.join('.') === 'actors.species' ? '*' : key].join('.')
      if (THEME_FIELDS.includes(field)) used.add(field)
      else if (isObject(child)) walk(child, field.split('.'))
      else unknown.push([...trail, key].join('.'))
    }
  }
  walk(theme, [])
  return { used, unknown }
}

/** Reports unknown and missing fields. Returns whether the theme can be read any further. */
function checkFields(file, theme, isTemplate, report) {
  const { used, unknown } = themeFields(theme)
  for (const field of unknown) {
    report(file, `"${field}" is not a theme field; they are listed in scripts/theme-contract.mjs`)
  }
  const missingRequired = REQUIRED_THEME_FIELDS.filter((field) => !used.has(field))
  for (const field of missingRequired) report(file, `is missing "${field}"`)
  if (isTemplate) checkTemplateShowsEverything(file, theme, used, report)
  return missingRequired.length === 0
}

/** The template is what people copy, so it shows every field, pose, station and UI variable. */
function checkTemplateShowsEverything(file, theme, used, report) {
  for (const field of THEME_FIELDS) {
    const isOptional = !REQUIRED_THEME_FIELDS.includes(field) && !field.includes('*')
    if (isOptional && !used.has(field)) report(file, `the template must show every field: add "${field}"`)
  }
  for (const [name, species] of Object.entries(theme.actors?.species ?? {})) {
    for (const key of SPECIES_KEYS) {
      if (!(key in species)) report(file, `the template must show every field: add "${key}" to "${name}"`)
    }
  }
  const emotes = Array.isArray(theme.actors?.emotes) ? theme.actors.emotes.filter(isObject) : []
  for (const key of EMOTE_KEYS) {
    if (!emotes.some((emote) => key in emote)) {
      report(file, `the template must show every field: use "${key}" in one of actors.emotes`)
    }
  }
}

function symbolIds(svgText) {
  return new Set([...svgText.matchAll(/<symbol[^>]*\sid="([^"]+)"/g)].map((match) => match[1]))
}

function checkSvgComments(file, svgText, report) {
  // A comment holding "--" makes the file invalid XML, which image tools refuse.
  for (const comment of svgText.match(/<!--[\s\S]*?-->/g) ?? []) {
    if (comment.slice(4, -3).includes('--')) report(file, 'has "--" inside a comment')
  }
}

function checkSceneries(folder, file, theme, report) {
  const aspect = theme.room.width / theme.room.height
  if (Math.abs(aspect - ROOM_ASPECT) > ASPECT_TOLERANCE) {
    report(file, `room is ${theme.room.width}x${theme.room.height}; sceneries must be 8:5`)
  }
  for (const scenery of new Set([theme.room.background, ...(theme.room.backgrounds ?? [])])) {
    const sceneryFile = path.join(folder, String(scenery))
    if (!fs.existsSync(sceneryFile)) {
      report(file, `scenery not found: ${scenery}`)
      continue
    }
    if (path.extname(sceneryFile) !== '.svg') continue
    const svgText = fs.readFileSync(sceneryFile, 'utf8')
    checkSvgComments(sceneryFile, svgText, report)
    const viewBox = svgText.match(/<svg[^>]*\sviewBox="([^"]+)"/)?.[1]
    const size = viewBox?.trim().split(/[\s,]+/).slice(2).map(Number)
    if (size && Math.abs(size[0] / size[1] - ROOM_ASPECT) > ASPECT_TOLERANCE) {
      report(sceneryFile, `viewBox is ${size[0]}x${size[1]}; sceneries must be 8:5`)
    }
  }
}

/**
 * Several themes can be on screen at once, so each keeps its symbols under a prefix of its own.
 *
 * @param {Map<string, string>} prefixOwners symbol prefix -> the theme folder that uses it
 */
function checkPrefix(folder, sheetFile, ids, prefixOwners, report) {
  const prefix = [...ids][0]?.match(/^[a-z0-9]+-/)?.[0]
  if (!prefix) return report(sheetFile, 'symbol ids need a prefix of the theme\'s own, as in "mt-idle"')
  for (const id of ids) {
    if (!id.startsWith(prefix)) report(sheetFile, `symbol "${id}" lacks the theme's prefix "${prefix}"`)
  }
  const owner = prefixOwners.get(prefix)
  if (owner) report(sheetFile, `the prefix "${prefix}" is also used by "${owner}"; each theme needs its own`)
  else prefixOwners.set(prefix, path.basename(folder))
}

/** A familiar is optional; one that is declared names a symbol in the sheet and sane sizes. */
function checkFamiliar(file, theme, ids, report) {
  const familiar = theme.actors.familiar
  if (familiar === undefined) return
  if (!isObject(familiar)) return report(file, 'actors.familiar must be an object')
  if (typeof familiar.symbol !== 'string' || !ids.has(familiar.symbol)) {
    report(file, `actors.familiar uses a symbol that is not in the sheet: ${familiar.symbol}`)
  }
  for (const key of ['width', 'height']) {
    if (familiar[key] === undefined) continue
    const fits = typeof familiar[key] === 'number' && familiar[key] > 0 && familiar[key] <= theme.actors[key]
    if (!fits) report(file, `actors.familiar.${key} must be above 0 and no larger than a character`)
  }
  const { lift } = familiar
  if (lift !== undefined && !(typeof lift === 'number' && lift >= 0 && lift <= theme.actors.height)) {
    report(file, 'actors.familiar.lift must be between 0 and the height of a character')
  }
  if (familiar.motion !== undefined && !FAMILIAR_MOTIONS.includes(familiar.motion)) {
    report(file, `actors.familiar.motion must be one of: ${FAMILIAR_MOTIONS.join(', ')}`)
  }
  const isMotionList = Array.isArray(familiar.emotes) && familiar.emotes.every(isEmoteMotion)
  if (familiar.emotes !== undefined && !isMotionList) {
    report(file, `actors.familiar.emotes must be a list of: ${EMOTE_MOTIONS.join(', ')}`)
  }
}

const isEmoteMotion = (value) => EMOTE_MOTIONS.includes(value)

/** What one emote shows: a known motion, symbols that are in the sheet, or both. */
function checkEmoteLooks(file, emote, name, ids, report) {
  if (emote.motion !== undefined && !isEmoteMotion(emote.motion)) {
    report(file, `${name}: "motion" must be one of: ${EMOTE_MOTIONS.join(', ')}`)
  }
  for (const key of ['effect', 'pose']) {
    if (emote[key] !== undefined && !ids.has(emote[key])) {
      report(file, `${name}: "${key}" uses a symbol that is not in the sheet: ${emote[key]}`)
    }
  }
  if (emote.effectMotion !== undefined && !EFFECT_MOTIONS.includes(emote.effectMotion)) {
    report(file, `${name}: "effectMotion" must be one of: ${EFFECT_MOTIONS.join(', ')}`)
  }
  if (emote.effectMotion !== undefined && emote.effect === undefined) {
    report(file, `${name}: "effectMotion" needs an "effect" to move`)
  }
  if (['motion', 'effect', 'pose'].every((key) => emote[key] === undefined)) {
    report(file, `${name}: shows nothing; give it a "motion", an "effect" or a "pose"`)
  }
}

/** When one emote plays and for how long. */
function checkEmoteTiming(file, emote, name, report) {
  const isActivityList =
    Array.isArray(emote.on) && emote.on.length > 0 && emote.on.every((item) => ACTIVITIES.includes(item))
  if (!isActivityList) report(file, `${name}: "on" must list one or more of: ${ACTIVITIES.join(', ')}`)
  if (emote.when !== undefined && !EMOTE_MOMENTS.includes(emote.when)) {
    report(file, `${name}: "when" must be one of: ${EMOTE_MOMENTS.join(', ')}`)
  }
  const { seconds } = emote
  const lastsWell =
    typeof seconds === 'number' && seconds >= MIN_EMOTE_SECONDS && seconds <= MAX_EMOTE_SECONDS
  if (seconds !== undefined && !lastsWell) {
    report(file, `${name}: "seconds" must be between ${MIN_EMOTE_SECONDS} and ${MAX_EMOTE_SECONDS}`)
  }
}

/** Emotes are optional; each one declared has an id of its own and only keys the engine reads. */
function checkEmotes(file, theme, ids, report) {
  const emotes = theme.actors.emotes
  if (emotes === undefined) return
  if (!Array.isArray(emotes)) return report(file, 'actors.emotes must be a list')
  const seen = new Set()
  emotes.forEach((emote, index) => {
    if (!isObject(emote)) return report(file, `actors.emotes[${index}] must be an object`)
    const name = `emote "${emote.id ?? index}"`
    for (const key of Object.keys(emote)) {
      if (!EMOTE_KEYS.includes(key)) report(file, `${name}: "${key}" is not an emote key`)
    }
    for (const key of REQUIRED_EMOTE_KEYS) {
      if (emote[key] === undefined) report(file, `${name}: is missing "${key}"`)
    }
    if (typeof emote.id !== 'string' || !KEBAB_CASE.test(emote.id)) {
      report(file, `${name}: "id" must be a name in kebab-case`)
    }
    if (seen.has(emote.id)) report(file, `${name}: another emote has the same id`)
    seen.add(emote.id)
    checkEmoteLooks(file, emote, name, ids, report)
    checkEmoteTiming(file, emote, name, report)
  })
}

function checkSprites(folder, file, theme, prefixOwners, report) {
  const sheetFile = path.join(folder, String(theme.actors.file))
  if (!fs.existsSync(sheetFile)) return report(file, `sprite sheet not found: ${theme.actors.file}`)
  const sheet = fs.readFileSync(sheetFile, 'utf8')
  checkSvgComments(sheetFile, sheet, report)
  const ids = symbolIds(sheet)
  checkPrefix(folder, sheetFile, ids, prefixOwners, report)

  for (const [activity, id] of Object.entries(theme.actors.poses)) {
    if (!ids.has(id)) report(file, `pose "${activity}" uses a symbol that is not in the sheet: ${id}`)
  }
  const parts = Object.values(theme.actors.species ?? {}).flatMap((species) => species.parts ?? [])
  const outfits = (theme.actors.outfits ?? []).flat()
  for (const id of [...parts, ...outfits]) {
    if (!ids.has(id)) report(file, `uses a symbol that is not in the sheet: ${id}`)
  }
  if (!theme.actors.species?.default) report(file, 'actors.species needs a "default"')
  checkFamiliar(file, theme, ids, report)
  checkEmotes(file, theme, ids, report)
}

function checkStations(file, theme, report) {
  for (const [name, value] of Object.entries(theme.stations)) {
    for (const point of Array.isArray(value) ? value : [value]) {
      const isInside =
        point.x >= 0 && point.x <= theme.room.width && point.y >= 0 && point.y <= theme.room.height
      if (!isInside) report(file, `station "${name}" has a point outside the room: ${JSON.stringify(point)}`)
    }
  }
  if (!theme.stations.idle.length) report(file, 'stations needs at least one "idle" slot')
}

function checkTheme(folder, prefixOwners, { report, readJson }) {
  const id = path.basename(folder)
  const isTemplate = id === TEMPLATE_THEME
  if (id === RANDOM_THEME) report(folder, 'this name is reserved for the Random default theme')
  if (!isTemplate && !KEBAB_CASE.test(id)) report(folder, 'theme folders are named in kebab-case')

  const file = path.join(folder, 'theme.json')
  const theme = readJson(file)
  if (!theme || !checkFields(file, theme, isTemplate, report)) return
  checkSceneries(folder, file, theme, report)
  checkSprites(folder, file, theme, prefixOwners, report)
  checkStations(file, theme, report)
}

/**
 * @param {{
 *   root: string,
 *   report: (file: string, message: string) => void,
 *   readJson: (file: string) => object | null
 * }} context `root` is the plugin folder; `readJson` reports a file it cannot read
 */
export function checkThemes({ root, report, readJson }) {
  const themesDir = path.join(root, 'themes')
  const names = fs
    .readdirSync(themesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
  if (names.every((name) => name === TEMPLATE_THEME)) report(themesDir, 'has no themes')
  if (!names.includes(TEMPLATE_THEME)) report(themesDir, `has no theme template (${TEMPLATE_THEME}/)`)
  const prefixOwners = new Map()
  for (const name of names) checkTheme(path.join(themesDir, name), prefixOwners, { report, readJson })
}

/**
 * THEMES.md is the reference for theme.json, so it names every field the contract knows.
 *
 * @param {{ root: string, report: (file: string, message: string) => void }} context
 */
export function checkThemeGuide({ root, report }) {
  const file = path.join(root, 'THEMES.md')
  const guide = fs.readFileSync(file, 'utf8')
  for (const field of THEME_FIELDS) {
    const key = field.split('.').pop()
    // In backticks, alone or as the end of a path: `hueShift`, `variants.hues`.
    const isNamed = guide.includes(`\`${key}\``) || guide.includes(`.${key}\``)
    if (!isNamed) report(file, `does not explain the theme field "${field}"`)
  }
  for (const key of EMOTE_KEYS) {
    if (!guide.includes(`\`${key}\``)) report(file, `does not explain the emote key "${key}"`)
  }
  for (const motion of [...EMOTE_MOTIONS, ...EFFECT_MOTIONS]) {
    if (!guide.includes(`\`${motion}\``)) report(file, `does not explain the emote motion "${motion}"`)
  }
}

/**
 * The engine names its emote motions in ui/engine/emotes.js and animates them in ui/stage.css;
 * a motion in one and not the other would play as nothing.
 *
 * @param {{ root: string, report: (file: string, message: string) => void }} context
 */
export function checkEmoteMotions({ root, report }) {
  const file = path.join(root, 'ui', 'stage.css')
  const styles = fs.readFileSync(file, 'utf8')
  const wanted = [
    ...EMOTE_MOTIONS.map((motion) => `ac-emote-${motion}`),
    ...EFFECT_MOTIONS.map((motion) => `ac-effect-${motion}`)
  ]
  for (const name of wanted) {
    if (!styles.includes(`@keyframes ${name} `)) report(file, `has no animation "${name}"`)
  }
}

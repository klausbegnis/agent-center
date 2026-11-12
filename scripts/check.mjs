// Static checks that need nothing but Node: every module parses, the manifest points at files
// that exist, every theme and the theme template follow the theme contract, THEMES.md names
// every theme field and every emote motion has its animation. Run with `npm run check`.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkEmoteMotions, checkThemeGuide, checkThemes } from './theme-contract.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CODE_FOLDERS = ['src', 'ui', 'scripts']
const CODE_EXTENSIONS = ['.mjs', '.js']

const problems = []
const report = (file, message) => problems.push(`${path.relative(ROOT, file)}: ${message}`)

function filesUnder(folder) {
  const found = []
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name)
    if (entry.isDirectory()) found.push(...filesUnder(full))
    else found.push(full)
  }
  return found
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    report(file, `is not valid JSON (${error.message})`)
    return null
  }
}

function checkSyntax() {
  for (const folder of CODE_FOLDERS) {
    for (const file of filesUnder(path.join(ROOT, folder))) {
      if (!CODE_EXTENSIONS.includes(path.extname(file))) continue
      try {
        execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' })
      } catch (error) {
        report(file, `does not parse: ${String(error.stderr).split('\n').find(Boolean) ?? error.message}`)
      }
    }
  }
}

function checkManifest() {
  const file = path.join(ROOT, 'orca-plugin.json')
  const manifest = readJson(file)
  if (!manifest) return
  const entries = [
    manifest.main,
    ...(manifest.contributes?.panels ?? []).map((panel) => panel.entry),
    ...(manifest.contributes?.customEditors ?? []).map((editor) => editor.entry),
    // What Orca's plugin directory shows on the plugin's page.
    manifest.icon,
    manifest.cover?.path,
    ...(manifest.screenshots ?? []).map((screenshot) => screenshot.path)
  ]
  for (const entry of entries.filter(Boolean)) {
    if (!fs.existsSync(path.join(ROOT, entry))) report(file, `points at a missing file: ${entry}`)
  }
  const packageJson = readJson(path.join(ROOT, 'package.json'))
  if (packageJson && packageJson.version !== manifest.version) {
    report(file, `version ${manifest.version} differs from package.json ${packageJson.version}`)
  }
}

/** Every file and folder of the repository, without git's own and without dependencies. */
function everythingUnder(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.orca') return []
    const full = path.join(folder, entry.name)
    return entry.isDirectory() ? [full, ...everythingUnder(full)] : [full]
  })
}

/** Orca's plugin directory leaves out a repository that holds a link, so none may be added. */
function checkNoLinks() {
  for (const file of everythingUnder(ROOT)) {
    if (fs.lstatSync(file).isSymbolicLink()) report(file, 'is a symbolic link; Orca\'s plugin directory refuses those')
  }
}

/** .claude/rules/ is a copy of rules/ for Claude Code; the two must hold the same files. */
function checkRulesCopy() {
  const source = path.join(ROOT, 'rules')
  const copy = path.join(ROOT, '.claude', 'rules')
  const list = (folder) => (fs.existsSync(folder) ? fs.readdirSync(folder).filter((name) => name.endsWith('.md')).sort() : [])
  const isSame =
    list(source).join() === list(copy).join() &&
    list(source).every((name) => fs.readFileSync(path.join(source, name)).equals(fs.readFileSync(path.join(copy, name))))
  if (!isSame) report(copy, 'differs from rules/; edit rules/ and run `npm run sync-rules`')
}

checkSyntax()
checkManifest()
checkNoLinks()
checkRulesCopy()
checkThemes({ root: ROOT, report, readJson })
checkThemeGuide({ root: ROOT, report })
checkEmoteMotions({ root: ROOT, report })

if (problems.length) {
  console.error(problems.map((problem) => `  ${problem}`).join('\n'))
  console.error(`\n${problems.length} problem${problems.length === 1 ? '' : 's'} found.`)
  process.exit(1)
}
console.log(
  'check: all modules parse, the manifest is consistent, the rules copy is current, and every theme ' +
    'and the theme template follow the contract.'
)

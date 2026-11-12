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
    ...(manifest.contributes?.customEditors ?? []).map((editor) => editor.entry)
  ]
  for (const entry of entries.filter(Boolean)) {
    if (!fs.existsSync(path.join(ROOT, entry))) report(file, `points at a missing file: ${entry}`)
  }
  const packageJson = readJson(path.join(ROOT, 'package.json'))
  if (packageJson && packageJson.version !== manifest.version) {
    report(file, `version ${manifest.version} differs from package.json ${packageJson.version}`)
  }
}

checkSyntax()
checkManifest()
checkThemes({ root: ROOT, report, readJson })
checkThemeGuide({ root: ROOT, report })
checkEmoteMotions({ root: ROOT, report })

if (problems.length) {
  console.error(problems.map((problem) => `  ${problem}`).join('\n'))
  console.error(`\n${problems.length} problem${problems.length === 1 ? '' : 's'} found.`)
  process.exit(1)
}
console.log(
  'check: all modules parse, the manifest is consistent, and every theme and the theme template ' +
    'follow the contract.'
)

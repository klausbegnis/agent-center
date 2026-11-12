// Copies rules/ to .claude/rules/, which is where Claude Code looks for path-scoped rules.
// rules/ is the one place to edit; `npm run check` fails while the copy differs. A link would
// do the same with no copy, but Orca's plugin directory does not list a repository with links.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = path.join(ROOT, 'rules')
const COPY = path.join(ROOT, '.claude', 'rules')

fs.rmSync(COPY, { recursive: true, force: true })
fs.mkdirSync(COPY, { recursive: true })
const names = fs.readdirSync(SOURCE).filter((name) => name.endsWith('.md'))
for (const name of names) fs.copyFileSync(path.join(SOURCE, name), path.join(COPY, name))
console.log(`sync-rules: copied ${names.length} rules to .claude/rules/`)

---
description: Index of the project rules and how to write one.
paths:
  - "rules/**"
---

# Rules

Short, enforceable rules for this repository, one file per area. They are written for people
and for coding agents alike.

Each file starts with frontmatter:

```yaml
---
description: One line saying what the rule covers.
paths:
  - "src/**"
---
```

- `paths` lists the files the rule applies to. Claude Code loads a rule only when it reads or
  edits a matching file, so a rule costs nothing until it is needed. It finds these files
  through `.claude/rules`, which is a link to this folder.
- `description` is for readers and for other tools. Claude Code ignores it.
- Tools that read `AGENTS.md` (Codex and others) do not load rules by path. `AGENTS.md` tells
  them to pick the matching rule from the table below, and `.agents/rules` links here too.
- A rule without `paths` applies everywhere and is always loaded. Keep those few and short.

| Rule | Applies to |
|---|---|
| [architecture.md](architecture.md) | `src/`, `ui/`, the manifest |
| [code-style.md](code-style.md) | all JavaScript |
| [worker.md](worker.md) | `src/` |
| [ui.md](ui.md) | `ui/` |
| [themes.md](themes.md) | `themes/`, `THEMES.md`, the theme contract check |
| [testing.md](testing.md) | tests and the code they cover |
| [docs.md](docs.md) | Markdown and screenshots |
| [git-workflow.md](git-workflow.md) | everything |

## Writing a rule

- State what to do and why in a sentence each. A rule nobody can check is a wish.
- Prefer one concrete example over a paragraph of explanation.
- When a rule and the code disagree, fix one of them in the same pull request.

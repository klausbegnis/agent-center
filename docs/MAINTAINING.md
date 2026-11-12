# Maintaining Agent Center

How issues are triaged, how pull requests are reviewed and merged, and how releases are cut.
Contributors do not need this page; [CONTRIBUTING.md](../CONTRIBUTING.md) is theirs.

The process borrows from projects that have run it at scale: label-driven triage as in VS Code
and Kubernetes, squash merges with Conventional Commit titles as in Angular and Vite, and a
human-written changelog as in Keep a Changelog.

## Issues

### Triage

Every new issue gets a first response within a week. Triage means giving it exactly one type
label and one status label, then either a priority or a closing comment.

| Step | Do |
|---|---|
| Is it a question? | Answer it, then close. Questions are not tracked as issues. |
| Is it a duplicate? | Link the original, label `duplicate`, close. |
| Is it a security report? | Ask the reporter to use the private channel in `SECURITY.md`, then delete the details. |
| Can it be reproduced? | If not, label `needs-info` and ask for the missing step. |
| Is it in scope? | If not, say why kindly, label `wontfix`, close. |
| Otherwise | Label `accepted`, add a priority, and `good first issue` when it fits. |

An issue labelled `needs-info` with no answer for 21 days is closed with a note that it can be
reopened. Nothing else is closed for being old.

### Labels

Type, exactly one:

| Label | Meaning |
|---|---|
| `bug` | Something does not work as documented |
| `feature` | New behaviour |
| `theme` | A new theme or a change to one |
| `docs` | Documentation only |
| `chore` | Tooling, CI, refactors with no behaviour change |

Status, exactly one while open:

| Label | Meaning |
|---|---|
| `needs-triage` | New; nobody has looked yet. Applied by the issue forms. |
| `needs-info` | Waiting on the reporter |
| `accepted` | Confirmed and welcome; anyone may pick it up |
| `in-progress` | Someone is on it; the issue is assigned |
| `blocked` | Waiting on something outside the repository, such as an Orca API |

Priority, for accepted bugs and features:

| Label | Meaning |
|---|---|
| `p0` | The plugin fails to load or leaks data. Drop everything. |
| `p1` | A main feature is broken with no workaround. Next release. |
| `p2` | Annoying, has a workaround. |
| `p3` | Nice to have. |

Area, any that apply: `area:worker`, `area:ui`, `area:themes`, `area:demo`, `area:repo`.

Others: `good first issue`, `help wanted`, `duplicate`, `wontfix`, `breaking`.

## Pull requests

### Before review

A pull request is ready for review when:

- its title is a valid Conventional Commit, because it becomes the commit on `main`;
- the template is filled in, including how the change was checked;
- CI is green;
- it does one thing. Ask for a split when it does not, before reading further.

### Review

Check, in this order:

1. **Is it the right change?** Does it solve the linked issue, and is this the place to solve it?
2. **Does it follow the rules?** Read the files in [rules/](../rules/) that cover the changed
   paths. The ones most often missed: logic creeping into `worker.mjs` or `stage.js`, a theme
   id mentioned in the engine, a missing test for a domain change.
3. **Does it work?** For UI and theme changes, check out the branch and run the demo. Reading a
   diff is not looking at it.
4. **Is it safe?** New capability in the manifest, new route on the local server, anything
   that reads more from Orca: these need a second maintainer.
5. **Are the docs true afterwards?** README, THEMES.md, rules, changelog.

Say what must change and what is only a suggestion. Approve when the "must" list is empty.

### Merging

- **Squash and merge**, always. One pull request is one commit on `main`, titled with the pull
  request's Conventional Commit title and ending with the pull request number.
- At least one approval from a maintainer who did not write the change. Two for the cases in
  step 4 above.
- CI green on the latest commit, and the branch up to date with `main`.
- The author merges their own pull request once approved, if they have the rights; otherwise
  the approving maintainer does.
- Never force-push to `main`. Never merge with failing checks "to fix later".
- Delete the branch after merging.

### Reverting

If a merged change breaks `main`, revert it first and discuss after. A revert needs no review.
The fix comes back as a new pull request.

### Stale pull requests

A pull request waiting on its author for 30 days gets a friendly ping. After 14 more days it is
closed with a note that it can be reopened, and the linked issue goes back to `accepted`.

## Themes from contributors

Themes are personal first: people make one for themselves from the template and keep it in
their copy. The shipped set stays small, so a new theme is added only when it brings a look
the set lacks, and after a theme proposal was accepted. Do not label theme work
`good first issue`.

A theme pull request is merged when `npm run check` passes, the art is original or correctly
licensed (see [rules/themes.md](../rules/themes.md)), and it reads clearly in List, Gallery and
a narrow window. Art in the spirit of a game is welcome; art that copies a game is not, however
good it looks.

## Releases

Versions follow [Semantic Versioning](https://semver.org/). Before 1.0, a minor version may
break things.

| Change | Bump |
|---|---|
| Fixes only | patch |
| New features, new themes | minor |
| A theme-format change that breaks existing themes, a new Orca capability, a higher minimum Orca version | major (minor before 1.0), with the `breaking` label |

To cut a release:

1. Make sure `main` is green.
2. Move the "Unreleased" entries in `CHANGELOG.md` under a new version heading with the date.
3. Set the same version in `orca-plugin.json` and `package.json`. `npm run check` fails when
   they differ.
4. Open a pull request titled `chore(repo): release vX.Y.Z` and merge it.
5. Tag the merge commit `vX.Y.Z` and push the tag.
6. Publish a GitHub release with the changelog section as its notes.

## Repository settings

These are the settings the repository runs with, under Settings, so the process above is
enforced rather than hoped for. Check them again after a transfer or a visibility change.

General:

- Default branch: `main`.
- Pull requests: allow **squash merging** only; turn off merge commits and rebase merging.
  Default commit message: pull request title.
- Automatically delete head branches: on.
- Issues: on. Discussions: on, for questions.

Branch protection for `main`:

- Require a pull request before merging. Approvals required: 0 while there is one maintainer
  (nobody can approve their own pull request); raise it to 1 when a second maintainer joins.
- Dismiss stale approvals when new commits are pushed.
- Require status checks to pass: `verify`. Require branches to be up to date.
- Require conversation resolution.
- Require linear history.
- Do not allow bypassing, force pushes or deletions.

Security:

- Private vulnerability reporting: on. GitHub only offers it on public repositories, so turn
  it on the day the repository becomes public.
- Dependabot alerts and security updates: on.
- Secret scanning with push protection: on. Like private reporting, GitHub only offers it on
  public repositories.
- CodeQL: `.github/workflows/codeql.yml` runs on its own once the repository is public.
- Actions in the workflows are pinned to a commit, with the version in a comment. Dependabot
  updates both. Never change a pin to a tag such as `@v7`: a tag can be moved.
- Dependabot for GitHub Actions: on (`.github/dependabot.yml`).

Labels: create the ones listed above and delete GitHub's defaults that are not in the list.

The same settings with the GitHub CLI, to run once from a checkout:

```bash
gh repo edit --enable-squash-merge --enable-merge-commit=false --enable-rebase-merge=false --delete-branch-on-merge --enable-discussions
```

Check them against `gh repo edit --help` before use: the options change between versions of the
GitHub CLI. Branch protection is easiest to set in the web interface.

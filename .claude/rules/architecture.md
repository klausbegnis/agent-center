---
description: Module boundaries, dependency direction, and the no-build, no-dependency constraint.
paths:
  - "src/**"
  - "ui/**"
  - "orca-plugin.json"
  - "package.json"
---

# Architecture

## Two programs, one contract

- `src/` runs in Node inside Orca's plugin worker. `ui/` runs in a browser frame. They share no
  code and talk only through the view state: the object `Controller.getState()` returns.
- Changing the shape of the view state is a change to both sides. Update `src/controller.mjs`,
  the engine and `scripts/demo.mjs` in the same pull request.

## Dependency direction

```
worker.mjs ──> controller.mjs ──> domain/        (pure, no I/O)
     │              │
     ├──> orca/     └──> preferences.mjs
     ├──> server/
     └──> support/
```

- `src/domain/` imports nothing outside itself. No `node:` modules, no Orca API, no timers. It
  is where behaviour lives, and it is fully unit tested.
- `src/orca/` is the only place that knows Orca's CLI and host API shapes.
- `src/server/` is the only place that knows HTTP.
- `src/worker.mjs` and `ui/engine/stage.js` are composition roots: they create parts and connect
  them. If either grows logic of its own, move that logic into a module.
- In `ui/engine/`, the modules that compute (`hash`, `variants`, `room-themes`, `stations`,
  `gallery`, `familiars`, `emotes`, `labels`) never touch the DOM. The modules that draw never
  compute layout or looks inline.

## One operation, one place

Every action a surface can take goes through the `Controller`. The Orca panel reaches it through
`src/orca/panel-handlers.mjs` and the external view through `src/server/http-server.mjs`. Add a
new action to the controller first, then expose it in both.

## No build step, no runtime dependencies

- The plugin loads as written: `.mjs` in the worker, native ES modules in the browser. No
  TypeScript, no bundler, no transpiler.
- No packages in `dependencies`. Orca limits a plugin folder to 2,000 files and a `node_modules`
  folder inside it would break loading.
- Dev tooling must also work with Node alone: `node --test` and `scripts/check.mjs`.
- Requires Node 22 or later and Orca 1.4.248 or later.

## The manifest

- `orca-plugin.json` declares every capability the plugin uses. Asking for a new capability, or
  changing a command, makes Orca ask every user to approve again: say so in the pull request.
- Keep `version` equal in `orca-plugin.json` and `package.json`. `npm run check` enforces it.

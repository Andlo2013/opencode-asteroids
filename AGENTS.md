# AGENTS.md

Vanilla HTML5 Canvas Asteroids clone. No dependencies, bundler, package.json, tests, lint, or CI — do not introduce them unless asked.

## Run / verify

- Open `index.html` directly in a browser, or `npx serve .` (README says `http://localhost:3000`).
- `game.js` is loaded as a classic `<script>` (no modules/imports). It runs immediately and assumes `#canvas` exists; there is no build step.
- Verify changes by playing the game in a browser. There is no automated test command.

## Structure

- `index.html` — canvas element (`800x600`) and styling; `game.js` — entire game.
- `game.js` is organized in labeled sections (Input, Utils, entities, game state, Update, Draw, main loop). Follow that layout.
- All state is module-level globals (`ship`, `bullets`, `asteroids`, `particles`, `score`, `lives`, `level`, `state`); `update(dt)`/`draw()` are driven by the `requestAnimationFrame` loop in `loop()`, with `dt` capped at `0.05` s.

## Gotchas

- Canvas dimensions are duplicated: `width`/`height` in `index.html` and `W`/`H` in `game.js`. Change both together.
- The playfield is toroidal. Moving entities must use `wrap()`; collision checks use plain Euclidean `dist()` and deliberately ignore wrap-around.
- Asteroid `size` is `1..3`; `RADII`, `SPEEDS` and `POINTS` are indexed by size with index `0` unused. `POINTS` is in small-to-large order (`[0, 100, 50, 20]`).
- Input uses two maps: `keys` for held movement and `justPressed` consumed via `pressed()` for one-shot actions. Do not read `keys` for fire/restart.
- `state` is `'playing' | 'dead' | 'gameover'`; each branch has its own update flow. Preserve that when touching `update()`.

## Conventions

- User-facing text, comments, and README are in Spanish; keep it that way.
- README advertises power-ups and special asteroid types (e.g. "estrella fugaz") that are **not** implemented in `game.js`. Trust the code, not the README's feature list.

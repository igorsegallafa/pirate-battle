# Architecture

## Layers

```
src/
  game/        rules, rendering, input and audio; no React
    config.ts      typed gameplay configuration and option limits
    arena.ts       arena size, islands, spawn points, collision helpers
    simulation.ts  the rules: a plain-data Match and stepMatch()
    renderer.ts    PixiJS scene that mirrors a Match
    input.ts       keyboard bindings
    audio.ts       sound effects and loops
    assets.ts      texture loading
    session.ts     one match: owns the Pixi app, the loop, pause and the HUD store
  api/         contracts, Axios client, TanStack Query hooks
  mocks/       MSW handlers, fixtures, network scenarios
  ui/          React screens, HUD, dialogs
  appState.ts  persisted stores: options, last result, pending records, player
  storage.ts   tiny store + localStorage helper
```

Dependencies point one way: `ui` imports `game/session`, which imports `simulation`. The simulation itself imports
only `arena` and `config`, so the rules run without a browser, a renderer or React.

## React and PixiJS

React renders menus, forms, the HUD, touch controls and dialogs. PixiJS renders the arena, ships, projectiles, effects
and the health bars above ships.

`GameScreen` mounts an empty `div` and, in an effect, loads the textures and calls `GameSession.start`. The effect's
cleanup destroys the session. Both steps are asynchronous, so the effect passes an `AbortSignal`: if the cleanup runs
while PixiJS is still initializing, the half-built application is destroyed and no session is created. That makes
mounting, unmounting and mounting again (React Strict Mode) safe. "Play Again" remounts `GameScreen` with a new
`key`, so every match gets a fresh session.

The continuous state (positions, cooldowns, timers) lives only in the `Match` object. React never reads it. The session
publishes a small `HudState` (phase, score, whole seconds left, health) to a store and only writes to it when one of
those values changes, so React renders at most a few times per second. Components subscribe with
`useSyncExternalStore`.

The arena is a CSS box with a fixed 16:9 aspect ratio that fits the viewport. Pixi resizes its canvas to that box
(`resizeTo`) with `resolution = devicePixelRatio` and `autoDensity`, and the renderer scales its root container by
`box width / 1280`. The simulation always works in the same 1280×720 coordinates, so resizing or rotating the device
never changes the rules. The HUD and touch controls sit inside the same box and are sized in `em` relative to its
width, so they are never cut. Input comes from the keyboard and DOM buttons, so there is no canvas coordinate mapping.
Landscape is the supported mobile orientation; portrait still works at a smaller size and shows a hint.

## Simulation loop

`stepMatch(match, input, dt)` advances the rules by a fixed step of 1/60 s. On every Pixi ticker frame the session adds
the frame time to an accumulator and runs as many fixed steps as fit, then renders once. Movement, damage, cooldowns
and spawns therefore depend only on elapsed time, whatever the frame rate. A frame longer than 250 ms is clamped.

One step, in order: player movement and weapons, spawn, enemy steering and attacks, enemy separation, projectiles,
removal of destroyed enemies, end conditions. Once `endReason` is set every later step returns immediately, which stops
movement, attacks, damage, spawns and scoring together.

When a match ends the session reports the result at once, so it is stored and sent even if the page is closed during
the final explosion, and asks React to show the result screen 1.2 s later.

The simulation reports what happened through `match.events` (shot, hit, miss, destroyed). After each frame the session
hands them to the renderer (effects) and to the audio module, then clears the list. The rules never call presentation
code.

Randomness comes from a mulberry32 generator whose state is a number inside the `Match`, seeded from the clock or from
`?seed=`. A match is plain serializable data.

Pause sets the HUD phase to `paused`: frames return early, so the clock, cooldowns and simulation stop. Pausing also
detaches the keyboard listener and clears the input state, and resuming resets the accumulator, so no movement or
shots from the paused period reach the match. The window `blur` and `visibilitychange` events pause automatically, and only the
player resumes (Resume button or Esc in the dialog). The pause dialog is a native modal `<dialog>`, which provides the
focus trap and focus restoration.

## Enemies

- A chaser steers at the player and advances. On contact it damages the player and is destroyed without scoring.
- A shooter advances until the player is within `attackRange` and no island crosses the line between them, then
  stops, turns to face the player and fires when aligned.

Both steer around islands: if an island's bounding circle blocks the straight line to the player, the course bends to
the edge of that circle. Enemies that overlap are pushed apart, and an enemy overlapping the player is pushed away.

Spawns happen every `spawnSeconds`, cycling through `spawnSequence`, which guarantees both kinds appear. The spawn
position is picked among fixed open-water points that are at least `spawnMinPlayerDistance` from the player.

## Collisions

- Ships are circles. Islands are rounded squares: a point is clamped to the island's inner square and the remaining
  distance is compared with the corner radius plus the ship radius. `constrainToWater` pushes a ship out along that
  vector, which makes it slide along the shore, and clamps it to the arena.
- Projectiles are points. Each step a projectile is removed when it leaves the arena, hits a ship of the other side
  (damage applied once, then removed), reaches an island, or runs out of range.
- Destroyed enemies are skipped by every check in the same step and removed at its end.

## Resources

- Textures are loaded once through Pixi `Assets` (two atlases, the tile sheet and the water tile) and reused by every
  match. A failed load shows an error with a retry before any combat starts. Sub-textures for island tiles and health
  bar fills are created once.
- A session owns everything else and releases it in `destroy()`: keyboard listener, `blur`/`visibilitychange`
  listeners (one `AbortController`), the result timer, the ticker callback, the renderer's display objects and the
  Pixi application with its canvas and WebGL context.
- Ship and projectile sprites are created when an entity appears and destroyed when it is gone. Effects are short-lived
  sprites that fade out and destroy themselves.

## Local persistence

All keys are prefixed with `pirate-battle:` in `localStorage`.

| Key | Content |
| --- | --- |
| `options` | Session time and spawn interval. Invalid stored values fall back to the defaults. |
| `last-result` | The last completed match. |
| `pending-matches` | Completed matches the API has not confirmed yet. |
| `player-id` | Identifier generated on first visit. |
| `muted` | Sound preference. |
| `scenario`, `mock-matches` | Mock API: selected network scenario and confirmed records. |

A match in progress is never stored. Reloading or leaving the game screen discards it, and only a match that reaches
its end produces a record.

## Ranking and match history

Contracts are in `src/api/contracts.ts` and shared by the client and the mock handlers.

| Request | Response |
| --- | --- |
| `GET /api/ranking?sessionSeconds&spawnSeconds&page&pageSize` | `Page<RankingEntry>`: matches played with those options, best first |
| `GET /api/players/:playerId/matches?page&pageSize` | `Page<MatchRecord>`: that player's matches, newest first |
| `POST /api/matches` with a `MatchRecord` | The stored record: `201` when created, `200` when the id already existed |

Ranking order is score descending, then earlier `playedAt`, then `id`. Each match is one ranking entry, compared only
with matches that used the same options.

### Queries

`useRanking` and `useMatchHistory` use keys that include the options/player and the page, with
`keepPreviousData` so paging does not flash. Queries are stale immediately, so opening a tab again refetches in the
background while cached data is shown. The Axios call receives TanStack Query's abort signal. A response only ever
fills the cache entry of its own key and a superseded request is cancelled, so a late response cannot replace newer
data. Requests retry twice, except on 4xx.

### Registering a match

The record id is generated on the client when the match ends, and the API is idempotent on
that id. The record is first appended to `pending-matches`, then sent by a mutation. On success it is removed from the
pending list and both the `ranking` and `history` queries are invalidated. On failure it stays pending: the result
screen and the main menu show "not saved yet" with a Retry button, and every app start sends the pending records again.
Because the server returns the existing record for a known id, retries, repeated clicks and a timeout that happened
after the server stored the match never create duplicates. The game does not wait for any of this.

## Mock API

`src/mocks` runs in the page through an MSW service worker in development, tests and the published build. Handlers
read fixtures plus the confirmed records kept in `localStorage`. A scenario (`src/mocks/scenarios.ts`) declares which
fixtures to serve, the latency of successive responses and a failure per endpoint. Variable latency uses a seeded
generator, so every run sees the same delays.

## Test instrumentation

With `?e2e` the session exposes `window.__pirateBattle = { match, advance }`. With `&clock=manual` the ticker no longer
advances the match and `advance(ms)` runs the same frame function instead. Tests press real keys and buttons, advance
the clock and read the state; rules, input, collisions and rendering are the production code paths.

## Balancing decisions

- The player is faster than both enemy kinds (170 vs 120 and 80 px/s), so retreating is always possible.
- A chaser dies to two front shots and a shooter to three; a full broadside (3 × 15) kills a chaser outright but
  reloads slower and has shorter range.
- A chaser impact costs a quarter of the player's health; shooter projectiles are slow (300 px/s) and can be dodged.
- Default pace: one enemy every 3 s for 120 s.

All values are in `src/game/config.ts`.

## Limitations

- Ship art is only provided at 1× in the challenge atlas, so ships are slightly soft on high-density screens. Tiles and
  UI use the 2× assets.
- Collision shapes are approximations: circles for ships, rounded squares for islands.
- Enemy steering is local. It handles the convex islands of this arena, not arbitrary mazes.
- Each action is a single on/off flag shared by the keyboard and the touch buttons. Holding two inputs for the same
  action and releasing one stops the action.
- Stores read `localStorage` once at startup, so two tabs open at the same time can overwrite each other's records.
- There is no enemy cap. With long sessions and a 1 s spawn interval the arena gets crowded by design.
- Visual regression baselines are per platform; the committed ones are for Windows.

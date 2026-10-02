# Pirate Battle

A 2D top-down naval shooter built with React, TypeScript and PixiJS. Sail between islands, sink enemy ships and score
as many points as you can before the time runs out.

Ranking and match history are served by a mocked REST API (MSW) and consumed with Axios and TanStack Query.

- Play it: https://pirate-battle-gray.vercel.app
- Architecture and decisions: [ARCHITECTURE.md](ARCHITECTURE.md)
- Performance and memory profiling: [reports/PERFORMANCE.md](reports/PERFORMANCE.md)
- Test report: `reports/playwright/index.html`

## Setup

Requires Node.js 22+ and pnpm.

```sh
pnpm install
pnpm dev
```

| Command | What it does |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` | Type check and optimized build into `dist/` |
| `pnpm preview` | Serves the build at http://localhost:4173 |
| `pnpm lint` | Lint (oxlint) |
| `pnpm typecheck` | TypeScript in strict mode |
| `pnpm test` | Playwright E2E and visual tests (builds and serves the app itself) |
| `pnpm test:report` | Opens the HTML test report |
| `pnpm profile` | Performance and memory profiling against a running `pnpm preview` |

The first test run needs the browser: `pnpm exec playwright install chromium`.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_TIMEOUT_MS` | `5000` | Timeout of ranking and match history requests. The tests build with `2000`. |

See [.env.example](.env.example). No variable is required.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Sail forward | `W` or `↑` | Forward button |
| Turn left / right | `A` / `D` or `←` / `→` | Turn buttons |
| Fire front cannon (1 projectile) | `Space` | Front cannon button |
| Fire broadside (3 parallel projectiles) | `Q` left, `E` right | Broadside buttons |
| Pause | `P` or `Esc` | Pause button |

Keys can be held together, so you can sail, turn and fire at once. The game also pauses when the window loses focus or
the tab is hidden, and only resumes when you choose Resume. On mobile, play in landscape.

## Gameplay configuration

Every gameplay value lives in the typed `GameConfig` in [src/game/config.ts](src/game/config.ts): session length,
spawn interval, spawn sequence and minimum spawn distance, ship health, speed, turn speed and radius, weapon damage,
cooldown, projectile speed and range, chaser contact damage and shooter attack range. To rebalance the game, edit
that object. The game systems only read values from it.

The Options screen exposes two of them. Each match snapshots the options when it starts.

| Option | Range | Default |
| --- | --- | --- |
| Game session time | 60 to 180 seconds | 120 |
| Enemy spawn time | 1 to 10 seconds | 3 |

## Mock API and network scenarios

The API only exists as MSW handlers, which also run in the published build. Records confirmed by the mock and records
still waiting to be sent are kept in `localStorage`, so they survive a refresh.

Select a scenario in the "Mock API" panel at the bottom left of the main menu, or with `?scenario=<name>` in the URL.
The choice is remembered, and the parameter is removed from the address once applied. "Reset all data" in the same panel clears every stored value (options, results, pending
and confirmed records, scenario) and reloads.

| Scenario | Behaviour |
| --- | --- |
| `success` | Everything works; three pages of ranking |
| `empty` | No fixtures: lists are empty until you play |
| `many-pages` | Long ranking and a 23-match history |
| `slow` | Every response takes 1.5 s |
| `variable-latency` | Seeded random delay from 100 ms to 2 s |
| `out-of-order` | Responses alternate between 1.5 s and 100 ms |
| `timeout` | No request is answered |
| `offline` | Every request fails to connect |
| `bad-request` | Every request gets HTTP 400 |
| `server-error` | Every request gets HTTP 500 |
| `ranking-error` | Only the ranking fails |
| `history-error` | Only the match history fails |
| `submit-timeout` | The match is stored, but the response never arrives |
| `submit-unavailable` | Registering a match gets HTTP 503 |

Scenarios are defined in [src/mocks/scenarios.ts](src/mocks/scenarios.ts).

### Reproducing failures

A list that fails to load: select `ranking-error` and open Ranking. After the retries an error with "Try again"
appears, while Match History still loads. Switch to `success` and try again.

An outage when the match ends: select `submit-unavailable` and finish a match. The result shows "Battle record not
saved yet", and you can play again meanwhile. Refresh the page and the record is still pending. Select `success` and
press Retry (or refresh) to save it; it then appears in both tabs.

A timeout after the match was registered: select `submit-timeout`, finish a match and wait for "not saved yet". The
mock has already stored it. Select `success` and press Retry. The match appears exactly once in Ranking and in Match
History.

Late responses: select `out-of-order`, open Ranking, press Next twice and then Previous right away. The slow
response for page 3 arrives later and the screen stays on page 2.

An asset failure: go offline in the browser devtools before pressing Play. The loading screen reports the failure.
Go back online and press "Try again".

## Other URL parameters

| Parameter | Effect |
| --- | --- |
| `seed=<number>` | Seeds the match's random generator, making spawns reproducible |
| `e2e` | Exposes `window.__pirateBattle` (`match` state and `advance(ms)`) for tests and profiling |
| `clock=manual` | With `e2e`: the match only advances through `advance(ms)` |

## Tests

```sh
pnpm test
```

Playwright runs every spec in Chromium on a desktop viewport and on an emulated phone in landscape, against the
optimized build. Tests use a fixed seed and drive the simulation clock, while pressing the real keys and buttons.
Each test starts from an empty browser context.

- HTML report: `reports/playwright`. Traces of failed tests are recorded on retry and linked from the report.
- Visual baselines (menu, arena, result) are in `e2e/visual.spec.ts-snapshots`. They are platform-specific and were
  generated on Windows; on another OS create them with `pnpm test --update-snapshots`.

## Assets and licenses

All images and sounds come from the challenge repository's `assets/` folder and are used unmodified, except:

- `public/assets/ships.json` is the challenge's `ships_miscellaneous_sheet.xml` converted to the JSON atlas format
  PixiJS reads, by [scripts/convert-ships-atlas.mjs](scripts/convert-ships-atlas.mjs).
- Files were renamed where PixiJS needs the `@2x` suffix to detect their resolution.

No other fonts, images or sounds were added; text uses system fonts.

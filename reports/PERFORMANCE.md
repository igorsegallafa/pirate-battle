# Performance and memory profiling

Raw data: [performance.json](performance.json). Reproduce with:

```sh
pnpm build
pnpm preview          # in one terminal
pnpm profile          # in another; takes about 8 minutes
```

## Reference environment

| | |
| --- | --- |
| Machine | Laptop, Intel Core i7-12650H (10 cores, 16 threads), 32 GB RAM |
| GPU used by the browser | Intel UHD Graphics (integrated), through ANGLE / Direct3D 11 |
| Display | 1920×1080 at 143 Hz |
| OS | Windows 11 |
| Browser | Chromium 153 (Playwright build), headless, GPU enabled |
| Game resolution | 1280×720 viewport, device pixel ratio 1 |
| Build | `pnpm build` served by `pnpm preview` |

## Method

[scripts/profile.mjs](../scripts/profile.mjs) drives the real game with the real clock. Frame intervals are collected
with `requestAnimationFrame` inside the page; entity counts (player + enemies + projectiles) are sampled every 100 ms.

- In the played match a scripted pilot holds forward and fire and steers at the nearest enemy.
- In the crowded match the player stays idle with a 1 s spawn interval, so shooters and their projectiles accumulate.
  This is the worst case for entity count.
- In both, the script refills the player's health on every frame so the match runs its full 180 s. This is the only
  state the profiler changes.
- The memory test runs five cycles of start, play 10 s, pause, exit to the menu. After each cycle the script forces
  a garbage collection and reads the JS heap, DOM node count and event listener count from the DevTools protocol.

## Frame pacing

Target: 60 FPS (16.7 ms per frame).

| | Played match | Crowded match |
| --- | ---: | ---: |
| Session / spawn interval | 180 s / 3 s | 180 s / 1 s |
| Duration | 180 s (time up) | 180 s (time up) |
| Frames measured | 25,908 | 25,919 |
| Average frame rate | 144.0 FPS | 144.0 FPS |
| Frame time, 95th percentile | 7.2 ms | 7.2 ms |
| Longest frame | 29.9 ms | 21.0 ms |
| Frames over 20 ms | 1 | 2 |
| Entities, average | 3.2 | 62.0 |
| Entities, peak | 7 | 132 |
| Score | 48 | 0 |

The game runs at the display's refresh rate in both cases, well above the 60 FPS target, and the fixed-step simulation
keeps the rules identical at 144 Hz.

## Memory over five cycles

| After cycle | JS heap (MB) | DOM nodes | Event listeners |
| ---: | ---: | ---: | ---: |
| 0 (menu, before playing) | 6.24 | 48 | 5 |
| 1 | 8.61 | 298 | 221 |
| 2 | 8.30 | 298 | 221 |
| 3 | 8.54 | 298 | 221 |
| 4 | 8.59 | 298 | 221 |
| 5 | 8.72 | 298 | 221 |

The first cycle loads textures, sounds and the PixiJS renderer code, which stay cached on purpose. After that, DOM
nodes and event listeners are constant, so sessions release their listeners and canvas.

The heap moves by a few hundred KB between cycles, without a steady climb. To check for a slow leak, the same loop was
run for 24 cycles in an earlier build: growth per cycle fell from about 0.3 MB to about 0.015 MB (8.31 MB after 24
cycles), and Chromium never warned about too many
WebGL contexts, which it does when contexts are not released. Destroying the application with PixiJS's
`releaseGlobalResources` option gave the same numbers, so the remainder is not PixiJS pooling. A retained match or
renderer would cost far more than 15 KB per cycle; the curve is consistent with engine and library caches warming up.

## Limitations

- Measured headless. Chromium picked the integrated GPU; the laptop's discrete GPU was not used.
- With vsync at 143 Hz the frame rate is capped by the display, so the game could run faster than these numbers show.
- No mobile device was profiled. Tests cover the mobile layout on an emulated phone only.
- Each sprite is created and destroyed with its entity. At these entity counts pooling was not needed.

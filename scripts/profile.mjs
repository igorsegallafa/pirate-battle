// Profiles the built game: frame pacing over a played and a crowded match, then memory over five play/exit cycles.
// Usage: pnpm build && pnpm preview, then: node scripts/profile.mjs [url]
import { writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const URL = process.argv[2] ?? 'http://localhost:4173'
const VIEWPORT = { width: 1280, height: 720 }
const PLAYED_MATCH = { sessionSeconds: 180, spawnSeconds: 3 }
const CROWDED_MATCH = { sessionSeconds: 180, spawnSeconds: 1 }
const MEMORY_CYCLES = 5
const CYCLE_PLAY_MS = 10_000
const POLL_MS = 100

const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--js-flags=--expose-gc'],
})
const page = await browser.newPage({ viewport: VIEWPORT })
const devtools = await page.context().newCDPSession(page)
await devtools.send('Performance.enable')

await page.addInitScript(() => localStorage.setItem('pirate-battle:muted', 'true'))
await page.goto(`${URL}/?e2e&seed=1`)

async function applyOptions(options) {
  await page.evaluate((stored) => localStorage.setItem('pirate-battle:options', stored), JSON.stringify(options))
  await page.reload()
}

async function startMatch() {
  await page.getByRole('button', { name: /^Play/ }).click()
  await page.waitForFunction(() => window.__pirateBattle !== undefined)
}

/** Steers at the nearest enemy and keeps the player alive, so the match always runs its full length. */
function pilot() {
  return page.evaluate(() => {
    const { match } = window.__pirateBattle
    const { player, enemies } = match
    player.health = player.maxHealth

    const target = enemies.reduce(
      (nearest, enemy) =>
        !nearest || Math.hypot(enemy.x - player.x, enemy.y - player.y) < Math.hypot(nearest.x - player.x, nearest.y - player.y)
          ? enemy
          : nearest,
      undefined,
    )
    const offset = target ? Math.atan2(target.y - player.y, target.x - player.x) - player.heading : 0
    return {
      ended: match.endReason !== null,
      score: match.score,
      entities: 1 + enemies.length + match.projectiles.length,
      bearing: Math.atan2(Math.sin(offset), Math.cos(offset)),
    }
  })
}

async function steer(bearing) {
  const key = Math.abs(bearing) < 0.05 ? null : bearing > 0 ? 'KeyD' : 'KeyA'
  for (const candidate of ['KeyA', 'KeyD']) {
    if (candidate === key) await page.keyboard.down(candidate)
    else await page.keyboard.up(candidate)
  }
}

/** With `fights` off the player stays idle and enemies pile up: the worst case for entity count. */
async function profileMatch(options, fights) {
  await applyOptions(options)
  await startMatch()
  await page.evaluate(() => {
    window.frameTimes = []
    let last = performance.now()
    const record = (now) => {
      window.frameTimes.push(now - last)
      last = now
      requestAnimationFrame(record)
    }
    requestAnimationFrame(record)
  })

  const heldKeys = fights ? ['Space', 'KeyW'] : []
  for (const key of heldKeys) await page.keyboard.down(key)
  const entityCounts = []
  let state = await pilot()
  while (!state.ended) {
    entityCounts.push(state.entities)
    if (fights) await steer(state.bearing)
    await page.waitForTimeout(POLL_MS)
    state = await pilot()
  }
  for (const key of [...heldKeys, 'KeyA', 'KeyD']) await page.keyboard.up(key)

  const frameTimes = (await page.evaluate(() => window.frameTimes)).sort((a, b) => a - b)
  const totalMs = frameTimes.reduce((sum, ms) => sum + ms, 0)
  await page.getByRole('button', { name: 'Main Menu' }).click()

  return {
    options,
    frames: frameTimes.length,
    averageFps: round((frameTimes.length / totalMs) * 1000),
    p95FrameMs: round(frameTimes[Math.floor(frameTimes.length * 0.95)]),
    maxFrameMs: round(frameTimes.at(-1)),
    framesOver20Ms: frameTimes.filter((ms) => ms > 20).length,
    averageEntities: round(entityCounts.reduce((sum, count) => sum + count, 0) / entityCounts.length),
    maxEntities: Math.max(...entityCounts),
    score: state.score,
  }
}

async function measureMemory() {
  await page.evaluate(() => window.gc())
  const { metrics } = await devtools.send('Performance.getMetrics')
  const metric = (name) => metrics.find((entry) => entry.name === name).value
  return {
    jsHeapMb: round(metric('JSHeapUsedSize') / 1024 / 1024),
    domNodes: metric('Nodes'),
    eventListeners: metric('JSEventListeners'),
  }
}

async function profileMemory() {
  await applyOptions(PLAYED_MATCH)
  const samples = [{ cycle: 0, ...(await measureMemory()) }]
  for (let cycle = 1; cycle <= MEMORY_CYCLES; cycle++) {
    await startMatch()
    await page.keyboard.down('Space')
    await page.keyboard.down('KeyW')
    await page.keyboard.down('KeyD')
    await page.waitForTimeout(CYCLE_PLAY_MS)
    for (const key of ['Space', 'KeyW', 'KeyD']) await page.keyboard.up(key)

    await page.keyboard.press('KeyP')
    await page.getByRole('button', { name: 'Main Menu' }).click()
    await page.waitForFunction(() => window.__pirateBattle === undefined)
    samples.push({ cycle, ...(await measureMemory()) })
  }
  return samples
}

function round(value) {
  return Math.round(value * 100) / 100
}

const environment = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2')
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  return {
    userAgent: navigator.userAgent,
    gpu: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown',
    devicePixelRatio: window.devicePixelRatio,
    cpuThreads: navigator.hardwareConcurrency,
  }
})

const report = {
  date: new Date().toISOString(),
  url: URL,
  environment: { ...environment, viewport: VIEWPORT },
  playedMatch: await profileMatch(PLAYED_MATCH, true),
  crowdedMatch: await profileMatch(CROWDED_MATCH, false),
  memory: await profileMemory(),
}
await browser.close()

writeFileSync('reports/performance.json', `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))

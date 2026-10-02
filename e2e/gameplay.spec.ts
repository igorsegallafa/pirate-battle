import { ARENA, ISLANDS, PLAYER_START, constrainToWater } from '../src/game/arena'
import {
  advance,
  aimAt,
  distance,
  expect,
  fightUntil,
  holdKey,
  matchState,
  nearestEnemy,
  openMenu,
  startMatch,
  test,
} from './helpers'

const FRAME_MS = 1000 / 60

test.beforeEach(async ({ page }) => {
  await openMenu(page)
  await startMatch(page)
})

test('starts a match with full health, no score and the whole session ahead', async ({ page }) => {
  const match = await matchState(page)
  expect(match).toMatchObject({ elapsedSeconds: 0, score: 0, endReason: null, enemies: [], projectiles: [] })
  expect(match.player).toMatchObject({ x: PLAYER_START.x, y: PLAYER_START.y, health: 100 })

  await expect(page.getByRole('img', { name: 'Health 100 of 100' })).toBeVisible()
  await expect(page.getByLabel('Score')).toHaveText('0')
  await expect(page.getByRole('timer')).toHaveText('02:00')
})

test('sails forward and rotates both ways at the configured speeds', async ({ page }) => {
  const { config } = await matchState(page)

  await holdKey(page, 'KeyW', 1000)
  let { player } = await matchState(page)
  expect(player.x).toBeCloseTo(PLAYER_START.x, 3)
  expect(PLAYER_START.y - player.y).toBeCloseTo(config.player.speed, 3)

  await holdKey(page, 'KeyD', 500)
  player = (await matchState(page)).player
  expect(player.heading - PLAYER_START.heading).toBeCloseTo(config.player.turnSpeed / 2, 3)

  await holdKey(page, 'ArrowLeft', 1000)
  player = (await matchState(page)).player
  expect(player.heading - PLAYER_START.heading).toBeCloseTo(-config.player.turnSpeed / 2, 3)
})

test('moves and fires at the same time', async ({ page }) => {
  await page.keyboard.down('KeyW')
  await holdKey(page, 'Space', 200)
  await page.keyboard.up('KeyW')

  const match = await matchState(page)
  expect(match.player.y).toBeLessThan(PLAYER_START.y)
  expect(match.projectiles).toHaveLength(1)
})

test('stays inside the visible arena', async ({ page }) => {
  await holdKey(page, 'KeyW', 5000)

  const { player } = await matchState(page)
  expect(player.y).toBe(player.radius)
  expect(player.x).toBeGreaterThanOrEqual(player.radius)
  expect(player.x).toBeLessThanOrEqual(ARENA.width - player.radius)
})

test('is blocked by an island instead of crossing it', async ({ page }) => {
  const island = ISLANDS[0]
  const { config } = await matchState(page)
  const turn = Math.atan2(island.y - PLAYER_START.y, island.x - PLAYER_START.x) - PLAYER_START.heading

  await holdKey(page, 'KeyA', (Math.abs(turn) / config.player.turnSpeed) * 1000)
  await holdKey(page, 'KeyW', 2500)

  const { player } = await matchState(page)
  const corrected = { x: player.x, y: player.y }
  constrainToWater(corrected, player.radius)
  expect(corrected.x).toBeCloseTo(player.x, 6)
  expect(corrected.y).toBeCloseTo(player.y, 6)
  expect(distance(player, island)).toBeLessThan(island.size)
  expect(distance(player, PLAYER_START)).toBeLessThan(config.player.speed * 2.5 - 50)
})

test('front cannon fires one projectile ahead and respects its cooldown', async ({ page }) => {
  const { config } = await matchState(page)
  const cannon = config.player.frontCannon

  await holdKey(page, 'Space', FRAME_MS)
  let match = await matchState(page)
  expect(match.projectiles).toHaveLength(1)
  expect(match.projectiles[0]).toMatchObject({ fromPlayer: true, damage: cannon.damage })
  expect(match.projectiles[0].velocityX).toBeCloseTo(0, 6)
  expect(match.projectiles[0].velocityY).toBeCloseTo(-cannon.projectileSpeed, 6)

  await holdKey(page, 'Space', cannon.cooldownSeconds * 1000 - 3 * FRAME_MS)
  expect((await matchState(page)).projectiles).toHaveLength(1)

  await holdKey(page, 'Space', 4 * FRAME_MS)
  match = await matchState(page)
  expect(match.projectiles).toHaveLength(2)
})

test('broadsides fire three parallel projectiles from each side', async ({ page }) => {
  const { config } = await matchState(page)
  const { projectileSpeed, projectileSpacing } = config.player.broadside

  await holdKey(page, 'KeyQ', FRAME_MS)
  const left = (await matchState(page)).projectiles
  expect(left).toHaveLength(3)
  for (const projectile of left) {
    expect(projectile.velocityX).toBeCloseTo(-projectileSpeed, 6)
    expect(projectile.velocityY).toBeCloseTo(0, 6)
  }
  expect(left[1].y - left[0].y).toBeCloseTo(-projectileSpacing, 6)
  expect(left[2].y - left[1].y).toBeCloseTo(-projectileSpacing, 6)

  await holdKey(page, 'KeyE', FRAME_MS)
  const right = (await matchState(page)).projectiles.slice(3)
  expect(right).toHaveLength(3)
  for (const projectile of right) expect(projectile.velocityX).toBeCloseTo(projectileSpeed, 6)
})

test('projectiles expire after their range', async ({ page }) => {
  const { config } = await matchState(page)
  const { projectileRange, projectileSpeed } = config.player.broadside

  await holdKey(page, 'KeyQ', FRAME_MS)
  await advance(page, (projectileRange / projectileSpeed) * 1000 - 100)
  expect((await matchState(page)).projectiles).toHaveLength(3)

  await advance(page, 200)
  expect((await matchState(page)).projectiles).toHaveLength(0)
})

test('spawns enemies at the configured interval, alternating kinds, away from the player', async ({ page }) => {
  const { config } = await matchState(page)
  const intervalMs = config.spawnSeconds * 1000

  await advance(page, intervalMs - 100)
  expect((await matchState(page)).enemies).toHaveLength(0)

  await advance(page, 200)
  let match = await matchState(page)
  expect(match.enemies.map((enemy) => enemy.kind)).toEqual(['chaser'])
  expect(distance(match.enemies[0], match.player)).toBeGreaterThanOrEqual(config.spawnMinPlayerDistance - 30)

  await advance(page, intervalMs)
  match = await matchState(page)
  expect(match.enemies.map((enemy) => enemy.kind)).toEqual(['chaser', 'shooter'])
})

test('a hit damages the enemy once and a kill scores exactly one point', async ({ page }) => {
  const { config } = await matchState(page)
  await advance(page, config.spawnSeconds * 1000 + 100)
  const chaser = nearestEnemy(await matchState(page))!

  await aimAt(page, chaser.id)
  await holdKey(page, 'Space', FRAME_MS)
  const hit = await fightUntil(page, (match) => match.enemies[0]?.health !== config.chaser.maxHealth)
  expect(hit.enemies[0].health).toBe(config.chaser.maxHealth - config.player.frontCannon.damage)
  expect(hit.score).toBe(0)

  const killed = await fightUntil(page, (match) => match.score > 0)
  expect(killed.score).toBe(1)
  expect(killed.enemies.some((enemy) => enemy.id === chaser.id)).toBe(false)
  await expect(page.getByLabel('Score')).toHaveText('1')
})

test('a chaser pursues the player, explodes on impact and gives no points', async ({ page }) => {
  const { config } = await matchState(page)
  await advance(page, config.spawnSeconds * 1000 + 100)

  const spawned = await matchState(page)
  const startDistance = distance(spawned.enemies[0], spawned.player)
  await advance(page, 1000)
  const chasing = await matchState(page)
  expect(startDistance - distance(chasing.enemies[0], chasing.player)).toBeGreaterThan(config.chaser.speed * 0.8)

  const chaserId = chasing.enemies[0].id
  let after = chasing
  while (after.enemies.some((enemy) => enemy.id === chaserId)) after = await advance(page, 250)
  expect(after.player.health).toBe(config.player.maxHealth - config.chaser.contactDamage)
  expect(after.enemies.some((enemy) => enemy.kind === 'chaser')).toBe(false)
  expect(after.score).toBe(0)
})

test('a shooter closes in, stops at attack range and fires at the player', async ({ page }) => {
  const { config } = await matchState(page)
  await advance(page, config.spawnSeconds * 2000 + 100)

  const shooterId = (await matchState(page)).enemies.find((enemy) => enemy.kind === 'shooter')!.id
  let match = await matchState(page)
  for (let i = 0; i < 100 && !match.projectiles.some((projectile) => !projectile.fromPlayer); i++) {
    await advance(page, 100)
    match = await matchState(page)
  }

  const shooter = match.enemies.find((enemy) => enemy.id === shooterId)!
  expect(distance(shooter, match.player)).toBeLessThanOrEqual(config.shooter.attackRange)

  const healthBefore = match.player.health
  const position = { x: shooter.x, y: shooter.y }
  await advance(page, 1500)
  match = await matchState(page)
  const sameShooter = match.enemies.find((enemy) => enemy.id === shooterId)!
  expect(distance(sameShooter, position)).toBeLessThan(1)
  expect(match.player.health).toBeLessThan(healthBefore)
})

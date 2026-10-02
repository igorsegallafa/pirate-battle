import {
  ISLANDS,
  PLAYER_START,
  SPAWN_POINTS,
  constrainToWater,
  isInsideArena,
  isOnIsland,
  isSightBlocked,
  islandBoundingRadius,
  type Point,
} from './arena'
import type { EnemyKind, GameConfig, WeaponConfig } from './config'

export const STEP_SECONDS = 1 / 60

export type ShipKind = 'player' | EnemyKind
export type EndReason = 'time_up' | 'defeated'
export type Action = 'forward' | 'turnLeft' | 'turnRight' | 'fireFront' | 'fireLeft' | 'fireRight'
export type InputState = Record<Action, boolean>
type Weapon = 'front' | 'left' | 'right'

export interface Ship extends Point {
  id: number
  kind: ShipKind
  heading: number
  health: number
  maxHealth: number
  radius: number
  /** Seconds until each weapon can fire again. */
  cooldowns: Record<Weapon, number>
}

export interface Projectile extends Point {
  id: number
  velocityX: number
  velocityY: number
  damage: number
  secondsLeft: number
  fromPlayer: boolean
}

export type GameEvent =
  | { type: 'shot'; x: number; y: number; broadside: boolean }
  | { type: 'hit'; x: number; y: number; shipId: number }
  | { type: 'miss'; x: number; y: number; onLand: boolean }
  | { type: 'destroyed'; ship: Ship; scored: boolean }

export interface Match {
  config: GameConfig
  rngState: number
  elapsedSeconds: number
  score: number
  endReason: EndReason | null
  nextId: number
  secondsSinceSpawn: number
  spawnCount: number
  player: Ship
  enemies: Ship[]
  projectiles: Projectile[]
  /** Filled by the simulation, drained by whoever presents them. */
  events: GameEvent[]
}

const AIM_TOLERANCE = 0.15
const ISLAND_AVOIDANCE_MARGIN = 20

export function createInputState(): InputState {
  return { forward: false, turnLeft: false, turnRight: false, fireFront: false, fireLeft: false, fireRight: false }
}

export function createMatch(config: GameConfig, seed: number): Match {
  return {
    config,
    rngState: seed,
    elapsedSeconds: 0,
    score: 0,
    endReason: null,
    nextId: 2,
    secondsSinceSpawn: 0,
    spawnCount: 0,
    player: createShip(1, 'player', config.player, PLAYER_START, PLAYER_START.heading),
    enemies: [],
    projectiles: [],
    events: [],
  }
}

export function stepMatch(match: Match, input: InputState, dt: number): void {
  if (match.endReason) return

  match.elapsedSeconds += dt
  updatePlayer(match, input, dt)
  spawnEnemies(match, dt)
  for (const enemy of match.enemies) updateEnemy(match, enemy, dt)
  separateEnemies(match)
  updateProjectiles(match, dt)
  match.enemies = match.enemies.filter((enemy) => enemy.health > 0)

  if (match.player.health <= 0) {
    match.events.push({ type: 'destroyed', ship: match.player, scored: false })
    match.endReason = 'defeated'
  } else if (match.elapsedSeconds >= match.config.sessionSeconds) {
    match.elapsedSeconds = match.config.sessionSeconds
    match.endReason = 'time_up'
  }
}

function createShip(id: number, kind: ShipKind, config: GameConfig[ShipKind], position: Point, heading: number): Ship {
  return {
    id,
    kind,
    x: position.x,
    y: position.y,
    heading,
    health: config.maxHealth,
    maxHealth: config.maxHealth,
    radius: config.radius,
    cooldowns: { front: 0, left: 0, right: 0 },
  }
}

function updatePlayer(match: Match, input: InputState, dt: number): void {
  const { player, config } = match
  const turn = Number(input.turnRight) - Number(input.turnLeft)
  player.heading = normalizeAngle(player.heading + turn * config.player.turnSpeed * dt)
  if (input.forward) advance(player, config.player.speed * dt)

  coolDown(player, dt)
  if (input.fireFront) fireFront(match, player, config.player.frontCannon)
  if (input.fireLeft) fireBroadside(match, 'left')
  if (input.fireRight) fireBroadside(match, 'right')
}

function updateEnemy(match: Match, enemy: Ship, dt: number): void {
  const { player, config } = match
  coolDown(enemy, dt)

  const toPlayer = angleBetween(enemy, player)
  const inRange = distance(enemy, player) <= config.shooter.attackRange

  if (enemy.kind === 'shooter' && inRange && !isSightBlocked(enemy, player)) {
    turnToward(enemy, toPlayer, config.shooter.turnSpeed * dt)
    if (Math.abs(normalizeAngle(toPlayer - enemy.heading)) < AIM_TOLERANCE) {
      fireFront(match, enemy, config.shooter.cannon)
    }
    return
  }

  const shipConfig = config[enemy.kind]
  turnToward(enemy, courseAroundIslands(enemy, player), shipConfig.turnSpeed * dt)
  advance(enemy, shipConfig.speed * dt)

  if (enemy.kind === 'chaser' && distance(enemy, player) < enemy.radius + player.radius) {
    player.health -= config.chaser.contactDamage
    destroyEnemy(match, enemy, false)
  }
}

/** Heading towards the target, bent to the edge of any island standing in the way. */
function courseAroundIslands(ship: Ship, target: Point): number {
  const toTarget = angleBetween(ship, target)
  const targetDistance = distance(ship, target)

  for (const island of ISLANDS) {
    const islandDistance = distance(ship, island)
    if (islandDistance >= targetDistance) continue

    const clearance = islandBoundingRadius(island) + ship.radius + ISLAND_AVOIDANCE_MARGIN
    const blockedHalfAngle = Math.asin(Math.min(1, clearance / islandDistance))
    const toIsland = angleBetween(ship, island)
    const offset = normalizeAngle(toTarget - toIsland)
    if (Math.abs(offset) < blockedHalfAngle) {
      return normalizeAngle(toIsland + (offset < 0 ? -blockedHalfAngle : blockedHalfAngle))
    }
  }
  return toTarget
}

function spawnEnemies(match: Match, dt: number): void {
  const { config, player } = match
  match.secondsSinceSpawn += dt
  if (match.secondsSinceSpawn < config.spawnSeconds) return
  match.secondsSinceSpawn -= config.spawnSeconds

  const safePoints = SPAWN_POINTS.filter((point) => distance(point, player) >= config.spawnMinPlayerDistance)
  const position = safePoints[Math.floor(random(match) * safePoints.length)]
  if (!position) return

  const kind = config.spawnSequence[match.spawnCount % config.spawnSequence.length]
  match.spawnCount++
  match.enemies.push(createShip(match.nextId++, kind, config[kind], position, angleBetween(position, player)))
}

function separateEnemies(match: Match): void {
  const { enemies, player } = match
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i]
    for (let j = i + 1; j < enemies.length; j++) pushApart(enemy, enemies[j], 0.5)
    pushApart(enemy, player, 1)
    constrainToWater(enemy, enemy.radius)
  }
}

/** Moves `ship` (and `other`, by the remaining share) until they no longer overlap. */
function pushApart(ship: Ship, other: Ship, shipShare: number): void {
  const gap = distance(ship, other)
  const overlap = ship.radius + other.radius - gap
  if (overlap <= 0 || gap === 0 || ship.health <= 0 || other.health <= 0) return

  const directionX = (ship.x - other.x) / gap
  const directionY = (ship.y - other.y) / gap
  ship.x += directionX * overlap * shipShare
  ship.y += directionY * overlap * shipShare
  other.x -= directionX * overlap * (1 - shipShare)
  other.y -= directionY * overlap * (1 - shipShare)
}

function updateProjectiles(match: Match, dt: number): void {
  match.projectiles = match.projectiles.filter((projectile) => {
    projectile.x += projectile.velocityX * dt
    projectile.y += projectile.velocityY * dt
    projectile.secondsLeft -= dt

    if (!isInsideArena(projectile)) return false

    const targets = projectile.fromPlayer ? match.enemies : [match.player]
    const target = targets.find((ship) => ship.health > 0 && distance(ship, projectile) < ship.radius)
    if (target) {
      applyProjectileDamage(match, projectile, target)
      return false
    }

    const onLand = isOnIsland(projectile)
    if (onLand || projectile.secondsLeft <= 0) {
      match.events.push({ type: 'miss', x: projectile.x, y: projectile.y, onLand })
      return false
    }
    return true
  })
}

function applyProjectileDamage(match: Match, projectile: Projectile, target: Ship): void {
  target.health -= projectile.damage
  match.events.push({ type: 'hit', x: projectile.x, y: projectile.y, shipId: target.id })
  if (target.health <= 0 && target.kind !== 'player') {
    match.score++
    destroyEnemy(match, target, true)
  }
}

function destroyEnemy(match: Match, enemy: Ship, scored: boolean): void {
  enemy.health = 0
  match.events.push({ type: 'destroyed', ship: enemy, scored })
}

function fireFront(match: Match, ship: Ship, weapon: WeaponConfig): void {
  if (ship.cooldowns.front > 0) return
  ship.cooldowns.front = weapon.cooldownSeconds

  const muzzle = offsetPoint(ship, ship.heading, ship.radius)
  launchProjectile(match, muzzle, ship.heading, weapon, ship.kind === 'player')
  match.events.push({ type: 'shot', ...muzzle, broadside: false })
}

function fireBroadside(match: Match, side: 'left' | 'right'): void {
  const { player, config } = match
  const weapon = config.player.broadside
  if (player.cooldowns[side] > 0) return
  player.cooldowns[side] = weapon.cooldownSeconds

  const direction = player.heading + (side === 'left' ? -Math.PI / 2 : Math.PI / 2)
  const hullSide = offsetPoint(player, direction, player.radius * 0.6)
  for (let i = 0; i < weapon.projectileCount; i++) {
    const alongHull = (i - (weapon.projectileCount - 1) / 2) * weapon.projectileSpacing
    launchProjectile(match, offsetPoint(hullSide, player.heading, alongHull), direction, weapon, true)
  }
  match.events.push({ type: 'shot', ...hullSide, broadside: true })
}

function launchProjectile(match: Match, origin: Point, direction: number, weapon: WeaponConfig, fromPlayer: boolean): void {
  match.projectiles.push({
    id: match.nextId++,
    x: origin.x,
    y: origin.y,
    velocityX: Math.cos(direction) * weapon.projectileSpeed,
    velocityY: Math.sin(direction) * weapon.projectileSpeed,
    damage: weapon.damage,
    secondsLeft: weapon.projectileRange / weapon.projectileSpeed,
    fromPlayer,
  })
}

function coolDown(ship: Ship, dt: number): void {
  ship.cooldowns.front = Math.max(0, ship.cooldowns.front - dt)
  ship.cooldowns.left = Math.max(0, ship.cooldowns.left - dt)
  ship.cooldowns.right = Math.max(0, ship.cooldowns.right - dt)
}

function advance(ship: Ship, pixels: number): void {
  ship.x += Math.cos(ship.heading) * pixels
  ship.y += Math.sin(ship.heading) * pixels
  constrainToWater(ship, ship.radius)
}

function turnToward(ship: Ship, targetAngle: number, maxTurn: number): void {
  const difference = normalizeAngle(targetAngle - ship.heading)
  ship.heading = normalizeAngle(ship.heading + Math.max(-maxTurn, Math.min(maxTurn, difference)))
}

function offsetPoint(origin: Point, direction: number, pixels: number): Point {
  return { x: origin.x + Math.cos(direction) * pixels, y: origin.y + Math.sin(direction) * pixels }
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function angleBetween(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x)
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

/** mulberry32: a seeded generator whose whole state lives in the match. */
function random(match: Match): number {
  match.rngState = (match.rngState + 0x6d2b79f5) | 0
  let t = match.rngState
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

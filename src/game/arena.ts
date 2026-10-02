export interface Point {
  x: number
  y: number
}

export type IslandTexture = 'grassIsland' | 'sandIsland'
export type DecorationTexture = 'rock' | 'mossyRock' | 'palm' | 'bush'

export interface Island extends Point {
  /** Side of the drawn square sprite, in pixels. */
  size: number
  texture: IslandTexture
}

export interface Decoration extends Point {
  texture: DecorationTexture
}

export const ARENA = { width: 1280, height: 720 }

export const PLAYER_START = { x: 640, y: 400, heading: -Math.PI / 2 }

export const ISLANDS: Island[] = [
  { x: 340, y: 220, size: 300, texture: 'grassIsland' },
  { x: 960, y: 520, size: 220, texture: 'sandIsland' },
]

export const DECORATIONS: Decoration[] = [
  { x: 270, y: 170, texture: 'palm' },
  { x: 400, y: 270, texture: 'bush' },
  { x: 395, y: 150, texture: 'mossyRock' },
  { x: 930, y: 490, texture: 'rock' },
  { x: 1000, y: 560, texture: 'palm' },
]

/** Every point is on open water, away from the islands. */
export const SPAWN_POINTS: Point[] = [
  { x: 50, y: 450 },
  { x: 50, y: 670 },
  { x: 500, y: 670 },
  { x: 700, y: 50 },
  { x: 1000, y: 50 },
  { x: 1230, y: 50 },
  { x: 1230, y: 300 },
  { x: 1230, y: 670 },
]

// The island art is a rounded square slightly smaller than its sprite.
const SOLID_HALF_RATIO = 0.46
const CORNER_RATIO = 0.18

export function islandBoundingRadius(island: Island): number {
  const corner = island.size * CORNER_RATIO
  const innerHalf = island.size * SOLID_HALF_RATIO - corner
  return Math.hypot(innerHalf, innerHalf) + corner
}

/** Vector from the island's solid shape to the point, and the distance at which they touch. */
function islandOffset(island: Island, point: Point) {
  const corner = island.size * CORNER_RATIO
  const innerHalf = island.size * SOLID_HALF_RATIO - corner
  const dx = point.x - clamp(point.x, island.x - innerHalf, island.x + innerHalf)
  const dy = point.y - clamp(point.y, island.y - innerHalf, island.y + innerHalf)
  return { dx, dy, distance: Math.hypot(dx, dy), corner }
}

export function isOnIsland(point: Point): boolean {
  return ISLANDS.some((island) => {
    const { distance, corner } = islandOffset(island, point)
    return distance < corner
  })
}

const SIGHT_SAMPLE_SPACING = 8

export function isSightBlocked(from: Point, to: Point): boolean {
  const samples = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / SIGHT_SAMPLE_SPACING)
  for (let i = 1; i < samples; i++) {
    const t = i / samples
    if (isOnIsland({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t })) return true
  }
  return false
}

export function isInsideArena(point: Point): boolean {
  return point.x >= 0 && point.x <= ARENA.width && point.y >= 0 && point.y <= ARENA.height
}

export function constrainToWater(body: Point, radius: number): void {
  body.x = clamp(body.x, radius, ARENA.width - radius)
  body.y = clamp(body.y, radius, ARENA.height - radius)

  for (const island of ISLANDS) {
    const { dx, dy, distance, corner } = islandOffset(island, body)
    const minDistance = corner + radius
    if (distance >= minDistance) continue

    if (distance === 0) {
      pushOutFromCenter(body, island, minDistance)
    } else {
      const push = (minDistance - distance) / distance
      body.x += dx * push
      body.y += dy * push
    }
  }
}

function pushOutFromCenter(body: Point, island: Island, minDistance: number): void {
  const half = island.size * (SOLID_HALF_RATIO - CORNER_RATIO) + minDistance
  const dx = body.x - island.x
  const dy = body.y - island.y
  if (Math.abs(dx) > Math.abs(dy)) body.x = island.x + Math.sign(dx) * half
  else body.y = island.y + (Math.sign(dy) || 1) * half
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// Distances are in pixels, angles in radians and speeds per second.

export type EnemyKind = 'chaser' | 'shooter'

export interface ShipConfig {
  maxHealth: number
  speed: number
  turnSpeed: number
  radius: number
}

export interface WeaponConfig {
  damage: number
  cooldownSeconds: number
  projectileSpeed: number
  /** Distance travelled before the projectile expires; its lifetime is range / speed. */
  projectileRange: number
}

export interface BroadsideConfig extends WeaponConfig {
  projectileCount: number
  projectileSpacing: number
}

export interface MatchOptions {
  sessionSeconds: number
  spawnSeconds: number
}

export interface GameConfig extends MatchOptions {
  /** Enemy kinds spawned in order, repeating; sets the spawn distribution. */
  spawnSequence: EnemyKind[]
  spawnMinPlayerDistance: number
  player: ShipConfig & { frontCannon: WeaponConfig; broadside: BroadsideConfig }
  chaser: ShipConfig & { contactDamage: number }
  shooter: ShipConfig & { attackRange: number; cannon: WeaponConfig }
}

export const OPTION_LIMITS = {
  sessionSeconds: { min: 60, max: 180, step: 10 },
  spawnSeconds: { min: 1, max: 10, step: 1 },
} as const satisfies Record<keyof MatchOptions, { min: number; max: number; step: number }>

export const DEFAULT_OPTIONS: MatchOptions = { sessionSeconds: 120, spawnSeconds: 3 }

const BALANCE: Omit<GameConfig, keyof MatchOptions> = {
  spawnSequence: ['chaser', 'shooter'],
  spawnMinPlayerDistance: 380,
  player: {
    maxHealth: 100,
    speed: 170,
    turnSpeed: 2.6,
    radius: 36,
    frontCannon: { damage: 20, cooldownSeconds: 0.5, projectileSpeed: 480, projectileRange: 520 },
    broadside: {
      damage: 15,
      cooldownSeconds: 1.2,
      projectileSpeed: 480,
      projectileRange: 380,
      projectileCount: 3,
      projectileSpacing: 22,
    },
  },
  chaser: { maxHealth: 40, speed: 120, turnSpeed: 2.2, radius: 34, contactDamage: 25 },
  shooter: {
    maxHealth: 60,
    speed: 80,
    turnSpeed: 1.6,
    radius: 34,
    attackRange: 340,
    cannon: { damage: 10, cooldownSeconds: 1.8, projectileSpeed: 300, projectileRange: 420 },
  },
}

export function createGameConfig(options: MatchOptions): GameConfig {
  return { ...BALANCE, ...options }
}

export function isValidOption(name: keyof MatchOptions, value: number): boolean {
  const { min, max } = OPTION_LIMITS[name]
  return Number.isInteger(value) && value >= min && value <= max
}

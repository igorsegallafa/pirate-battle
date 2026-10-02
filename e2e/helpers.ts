import { test as base, expect, type Page } from '@playwright/test'
import type { MatchOptions } from '../src/game/config'
import type { Match, Ship } from '../src/game/simulation'
import type { ScenarioName } from '../src/mocks/scenarios'
import '../src/game/testApi'

export { expect }

const FRAME_MS = 1000 / 60

/** Every test also fails on an uncaught exception or unhandled rejection in the page. */
export const test = base.extend({
  page: async ({ page }, runTest) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await runTest(page)
    expect(errors).toEqual([])
  },
})

interface OpenOptions {
  scenario?: ScenarioName
  options?: MatchOptions
}

/** Opens the menu with a seeded match generator and a simulation clock driven by `advance`. */
export async function openMenu(page: Page, { scenario = 'success', options }: OpenOptions = {}): Promise<void> {
  if (options) {
    await page.addInitScript((stored) => {
      localStorage.setItem('pirate-battle:options', stored)
    }, JSON.stringify(options))
  }
  await page.goto(`/?e2e&clock=manual&seed=1&scenario=${scenario}`)
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
}

export async function startMatch(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Play/ }).click()
  await page.waitForFunction(() => window.__pirateBattle !== undefined)
}

export function matchState(page: Page): Promise<Match> {
  return page.evaluate(() => window.__pirateBattle!.match)
}

/** Runs the simulation for this much game time and returns the resulting state. */
export function advance(page: Page, milliseconds: number): Promise<Match> {
  return page.evaluate((ms) => {
    window.__pirateBattle!.advance(ms)
    return window.__pirateBattle!.match
  }, milliseconds)
}

export async function holdKey(page: Page, key: string, milliseconds: number): Promise<Match> {
  await page.keyboard.down(key)
  const match = await advance(page, milliseconds)
  await page.keyboard.up(key)
  return match
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function nearestEnemy(match: Match): Ship | undefined {
  return [...match.enemies].sort((a, b) => distance(a, match.player) - distance(b, match.player))[0]
}

/** Signed angle the player still has to turn to face the target. */
function bearingTo(player: Ship, target: Ship): number {
  const angle = Math.atan2(target.y - player.y, target.x - player.x) - player.heading
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

const AIM_TOLERANCE = 0.03

/** Turns the player with the keyboard until its bow points at the target. */
export async function aimAt(page: Page, targetId: number): Promise<Match> {
  let match = await matchState(page)
  for (;;) {
    const target = match.enemies.find((enemy) => enemy.id === targetId)
    const bearing = target ? bearingTo(match.player, target) : 0
    if (Math.abs(bearing) < AIM_TOLERANCE) return match

    const turnMs = (Math.abs(bearing) / match.config.player.turnSpeed) * 1000
    match = await holdKey(page, bearing > 0 ? 'KeyD' : 'KeyA', Math.max(FRAME_MS, turnMs))
  }
}

/** Plays with the keyboard, aiming and firing at the nearest enemy, until the condition holds. */
export async function fightUntil(page: Page, isDone: (match: Match) => boolean): Promise<Match> {
  await page.keyboard.down('Space')
  let match = await matchState(page)
  while (!isDone(match) && !match.endReason) {
    const target = nearestEnemy(match)
    if (target) await aimAt(page, target.id)
    match = await advance(page, 200)
  }
  await page.keyboard.up('Space')
  return match
}

/** Advances in short bursts, so the caller still finds the arena mounted when the match ends. */
export async function advanceUntilEnd(page: Page): Promise<Match> {
  for (;;) {
    const match = await advance(page, 1000)
    if (match.endReason) return match
  }
}

/** Lets enemies sink the idle player; with the shortest spawn interval that takes a few game seconds. */
export async function loseMatch(page: Page): Promise<void> {
  await startMatch(page)
  await advanceUntilEnd(page)
  await expect(page.getByRole('heading', { name: 'Ship Destroyed' })).toBeVisible()
}

export const QUICK_DEFEAT: MatchOptions = { sessionSeconds: 60, spawnSeconds: 1 }

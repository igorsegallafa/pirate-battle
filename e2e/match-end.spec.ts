import { QUICK_DEFEAT, advance, advanceUntilEnd, expect, fightUntil, loseMatch, matchState, openMenu, startMatch, test } from './helpers'

test('ends when the time runs out and shows the result', async ({ page }) => {
  test.slow()
  await openMenu(page, { options: { sessionSeconds: 60, spawnSeconds: 10 } })
  await startMatch(page)

  const finished = await fightUntil(page, () => false)
  expect(finished.endReason).toBe('time_up')
  expect(finished.elapsedSeconds).toBe(60)
  expect(finished.score).toBeGreaterThan(0)

  await expect(page.getByRole('heading', { name: 'Battle Complete' })).toBeVisible()
  await expect(page.getByLabel(`${finished.score} points`)).toBeVisible()
  await expect(page.getByText('Points · 01:00 · Time up')).toBeVisible()
  await expect(page.getByText('Saved to the ranking and match history.')).toBeVisible()
})

test('ends when the player is destroyed and freezes the simulation', async ({ page }) => {
  await openMenu(page, { options: QUICK_DEFEAT })
  await startMatch(page)

  const ended = await advanceUntilEnd(page)
  expect(ended.endReason).toBe('defeated')
  expect(ended.player.health).toBeLessThanOrEqual(0)
  expect(ended.elapsedSeconds).toBeLessThan(60)

  await page.keyboard.down('KeyW')
  await page.keyboard.down('Space')
  const later = await advance(page, 5000)
  expect(later).toEqual({ ...ended, events: [] })

  await expect(page.getByRole('heading', { name: 'Ship Destroyed' })).toBeVisible()
  await expect(page.getByText(/Points · 00:\d\d · Defeated/)).toBeVisible()
})

test('play again starts a clean match', async ({ page }) => {
  await openMenu(page, { options: QUICK_DEFEAT })
  await loseMatch(page)

  await startMatch(page)
  const fresh = await matchState(page)
  expect(fresh).toMatchObject({ elapsedSeconds: 0, score: 0, endReason: null, enemies: [], projectiles: [] })
  expect(fresh.player.health).toBe(fresh.config.player.maxHealth)
  await expect(page.getByRole('timer')).toHaveText('01:00')
  await expect(page.locator('.arena canvas')).toHaveCount(1)
})

test('keeps the last result after a refresh', async ({ page }) => {
  await openMenu(page, { options: QUICK_DEFEAT })
  await loseMatch(page)
  const details = await page.locator('.result-details').textContent()
  await expect(page.getByText('Saved to the ranking and match history.')).toBeVisible()

  await page.reload()
  const lastBattle = page.getByRole('region', { name: 'Last battle' })
  await expect(lastBattle.locator('.result-details')).toHaveText(details!)
  await expect(lastBattle.getByText('Saved to the ranking and match history.')).toBeVisible()
})

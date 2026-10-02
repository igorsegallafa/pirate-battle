import { advance, expect, matchState, openMenu, startMatch, test } from './helpers'

test('validates options and rejects out-of-range values', async ({ page }) => {
  await openMenu(page)
  await page.getByRole('button', { name: 'Options' }).click()

  const sessionTime = page.getByLabel('Game session time (seconds)')
  await sessionTime.fill('500')
  await expect(page.getByRole('alert')).toHaveText('Enter a whole number from 60 to 180.')
  await expect(sessionTime).toHaveAttribute('aria-invalid', 'true')

  await page.getByRole('button', { name: 'Save' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Options' }).click()
  await expect(page.getByLabel('Game session time (seconds)')).toHaveValue('120')
})

test('steps options within their limits and persists them across a refresh', async ({ page }) => {
  await openMenu(page)
  await page.getByRole('button', { name: 'Options' }).click()

  await page.getByRole('button', { name: 'Decrease Game session time' }).click()
  await expect(page.getByLabel('Game session time (seconds)')).toHaveValue('110')

  const spawnTime = page.getByLabel('Enemy spawn time (seconds)')
  await spawnTime.fill('10')
  await page.getByRole('button', { name: 'Increase Enemy spawn time' }).click()
  await expect(spawnTime).toHaveValue('10')

  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Options saved.')).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Options' }).click()
  await expect(page.getByLabel('Game session time (seconds)')).toHaveValue('110')
  await expect(page.getByLabel('Enemy spawn time (seconds)')).toHaveValue('10')
})

test('a running match keeps the options it started with', async ({ page }) => {
  await openMenu(page)
  await startMatch(page)

  await page.keyboard.press('KeyP')
  await page.getByRole('button', { name: 'Options' }).click()
  await page.getByLabel('Game session time (seconds)').fill('60')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('button', { name: 'Resume' }).click()

  await advance(page, 1000)
  expect((await matchState(page)).config.sessionSeconds).toBe(120)
  await expect(page.getByRole('timer')).toHaveText('01:59')
})

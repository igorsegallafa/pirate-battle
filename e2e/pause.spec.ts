import { advance, expect, holdKey, matchState, openMenu, startMatch, test } from './helpers'

test.beforeEach(async ({ page }) => {
  await openMenu(page)
  await startMatch(page)
  await holdKey(page, 'KeyW', 500)
})

test('manual pause suspends the clock, cooldowns and input until resumed', async ({ page }) => {
  await holdKey(page, 'Space', 17)
  const before = await matchState(page)

  await page.keyboard.press('KeyP')
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Battle paused' })).toBeAttached()

  await page.keyboard.down('KeyW')
  await advance(page, 5000)
  await page.keyboard.up('KeyW')
  expect(await matchState(page)).toEqual(before)

  await page.getByRole('button', { name: 'Resume' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await advance(page, 100)

  const after = await matchState(page)
  expect(after.elapsedSeconds).toBeCloseTo(before.elapsedSeconds + 0.1, 6)
  expect(after.player.y).toBe(before.player.y)
  expect(after.player.cooldowns.front).toBeCloseTo(before.player.cooldowns.front - 0.1, 6)
})

test('pauses when the window loses focus and waits for the player to resume', async ({ page }) => {
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible()

  const paused = await matchState(page)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await advance(page, 3000)
  expect((await matchState(page)).elapsedSeconds).toBe(paused.elapsedSeconds)
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await advance(page, 1000)
  expect((await matchState(page)).elapsedSeconds).toBeCloseTo(paused.elapsedSeconds + 1, 6)
})

test('pauses when the tab is hidden', async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible()

  const paused = await matchState(page)
  await advance(page, 3000)
  expect((await matchState(page)).elapsedSeconds).toBe(paused.elapsedSeconds)
})

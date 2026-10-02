import { QUICK_DEFEAT, expect, loseMatch, openMenu, startMatch, test } from './helpers'

test('main menu', async ({ page }) => {
  await openMenu(page)
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot('menu.png')
})

test('arena at the start of a match', async ({ page }) => {
  await openMenu(page)
  await startMatch(page)
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot('arena.png')
})

test('result screen', async ({ page }) => {
  await openMenu(page, { options: QUICK_DEFEAT })
  await loseMatch(page)
  await expect(page.getByText('Saved to the ranking and match history.')).toBeVisible()
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot('result.png')
})

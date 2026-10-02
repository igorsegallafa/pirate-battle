import { expect, openMenu, test } from './helpers'

test('loads the battle assets and shows the arena', async ({ page }) => {
  await openMenu(page)
  await page.getByRole('button', { name: 'Play', exact: true }).click()

  await expect(page.locator('.arena canvas')).toBeVisible()
  await expect(page.getByRole('timer')).toHaveText('02:00')
  await expect(page.getByText('Loading battle assets…')).toBeHidden()
})

test('reports an asset loading failure and recovers on retry', async ({ page, context }) => {
  await openMenu(page)

  await context.setOffline(true)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Could not load the battle assets.')
  await expect(page.locator('.arena canvas')).toHaveCount(0)

  await context.setOffline(false)
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator('.arena canvas')).toBeVisible()
  await expect(page.getByRole('timer')).toHaveText('02:00')
})

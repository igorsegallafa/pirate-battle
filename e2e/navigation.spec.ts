import { PLAYER_START } from '../src/game/arena'
import { advance, expect, holdKey, matchState, openMenu, startMatch, test } from './helpers'

test('an abandoned match is not recorded', async ({ page }) => {
  await openMenu(page, { scenario: 'empty' })
  await startMatch(page)
  await holdKey(page, 'KeyW', 1000)

  await page.keyboard.press('KeyP')
  await page.getByRole('button', { name: 'Main Menu' }).click()

  await expect(page.getByRole('region', { name: 'Last battle' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Match History' }).click()
  await expect(page.getByText('You have no recorded battles yet.')).toBeVisible()
  await page.getByRole('tab', { name: 'Ranking' }).click()
  await expect(page.getByText('No battles recorded with these options yet.')).toBeVisible()
})

test('survives repeated navigation between screens', async ({ page }) => {
  await openMenu(page)

  for (let round = 0; round < 3; round++) {
    await startMatch(page)
    await holdKey(page, 'Space', 300)
    await expect(page.locator('canvas')).toHaveCount(1)
    await page.keyboard.press('KeyP')
    await page.getByRole('button', { name: 'Main Menu' }).click()
    await expect(page.locator('canvas')).toHaveCount(0)
    expect(await page.evaluate(() => window.__pirateBattle)).toBeUndefined()

    await page.getByRole('button', { name: 'Options' }).click()
    await page.getByRole('button', { name: 'Main Menu' }).click()
    await page.getByRole('button', { name: 'Ranking' }).click()
    await page.getByRole('tab', { name: 'Match History' }).click()
    await page.getByRole('button', { name: 'Main Menu' }).click()
  }

  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
})

test('game keys are only captured during gameplay', async ({ page }) => {
  await openMenu(page)
  await page.getByRole('button', { name: 'Options' }).click()

  const sessionTime = page.getByLabel('Game session time (seconds)')
  await sessionTime.focus()
  await page.keyboard.press('ArrowUp')
  await expect(sessionTime).toHaveValue('121')
})

test('on-screen controls move, turn and fire', async ({ page }) => {
  await openMenu(page)
  await startMatch(page)

  const hold = async (name: string, milliseconds: number) => {
    const box = (await page.getByRole('button', { name }).boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await advance(page, milliseconds)
    await page.mouse.up()
  }

  await hold('Sail forward (W)', 1000)
  let match = await matchState(page)
  expect(match.player.y).toBeLessThan(PLAYER_START.y - 100)

  await hold('Turn right (D)', 500)
  match = await matchState(page)
  expect(match.player.heading).toBeGreaterThan(PLAYER_START.heading)

  await hold('Fire front cannon (Space)', 100)
  await hold('Fire left broadside (Q)', 100)
  match = await matchState(page)
  expect(match.projectiles).toHaveLength(4)

  const stopped = match.player.y
  await advance(page, 500)
  expect((await matchState(page)).player.y).toBe(stopped)
})

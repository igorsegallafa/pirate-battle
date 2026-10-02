import type { Page } from '@playwright/test'
import type { ScenarioName } from '../src/mocks/scenarios'
import { QUICK_DEFEAT, expect, loseMatch, openMenu, test } from './helpers'

const NOT_SAVED = 'Battle record not saved yet.'
const SAVED = 'Saved to the ranking and match history.'
const SLOW = { timeout: 20_000 }

async function selectScenario(page: Page, scenario: ScenarioName): Promise<void> {
  await page.getByText('Mock API').click()
  await page.getByLabel('Network scenario').selectOption(scenario)
}

function rows(page: Page) {
  return page.getByRole('row').filter({ has: page.getByRole('cell') })
}

test('ranking lists captains by score, with a tie-break, across pages', async ({ page }) => {
  await openMenu(page)
  await page.getByRole('button', { name: 'Ranking' }).click()

  await expect(rows(page)).toHaveCount(5)
  await expect(rows(page).first()).toContainText('01Captain Flint 38')
  await expect(rows(page).nth(2)).toContainText('03Sea Wolf 27')
  await expect(rows(page).nth(3)).toContainText('04Storm Rider 27')
  await expect(page.getByText('Page 1 of 3')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled()

  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByText('Page 2 of 3')).toBeVisible()
  await expect(rows(page).first()).toContainText('06')

  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByText('Page 3 of 3')).toBeVisible()
  await expect(rows(page)).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled()
})

test('match history paginates the player battles', async ({ page }) => {
  await openMenu(page, { scenario: 'many-pages' })
  await page.getByRole('button', { name: 'Match History' }).click()

  await expect(rows(page)).toHaveCount(5)
  await expect(page.getByText('Page 1 of 5')).toBeVisible()
  await expect(page.getByRole('columnheader').nth(2)).toHaveText('Duration')

  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByText('Page 2 of 5')).toBeVisible()
})

test('shows loading and empty states', async ({ page }) => {
  await openMenu(page, { scenario: 'slow' })
  await page.getByRole('button', { name: 'Ranking' }).click()
  await expect(page.getByText('Loading…')).toBeVisible()
  await expect(rows(page)).toHaveCount(5)

  await page.getByRole('tab', { name: 'Match History' }).click()
  await expect(page.getByText('Loading…')).toBeVisible()
  await expect(page.getByText('You have no recorded battles yet.')).toBeVisible()
})

test('a failing ranking shows an error, leaves the history usable and recovers', async ({ page }) => {
  await openMenu(page, { scenario: 'ranking-error' })
  await page.getByRole('button', { name: 'Ranking' }).click()
  await expect(page.getByRole('alert')).toContainText('Could not load the records.', SLOW)

  await page.getByRole('tab', { name: 'Match History' }).click()
  await expect(page.getByText('You have no recorded battles yet.')).toBeVisible()

  await page.getByRole('button', { name: 'Main Menu' }).click()
  await selectScenario(page, 'success')
  await page.getByRole('button', { name: 'Ranking' }).click()
  await expect(rows(page)).toHaveCount(5)
})

test('API failures do not block the game', async ({ page }) => {
  await openMenu(page, { scenario: 'offline', options: QUICK_DEFEAT })
  await loseMatch(page)
  await expect(page.getByText(NOT_SAVED)).toBeVisible(SLOW)
  await expect(page.getByRole('button', { name: 'Play Again' })).toBeEnabled()
})

test('a finished match appears once in the ranking and in the history', async ({ page }) => {
  await openMenu(page, { options: QUICK_DEFEAT })
  await loseMatch(page)
  await expect(page.getByText(SAVED)).toBeVisible()

  await page.getByRole('button', { name: 'Main Menu' }).click()
  await page.getByRole('button', { name: 'Ranking' }).click()
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('01Captain Jack You')

  await page.getByRole('tab', { name: 'Match History' }).click()
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('Defeated')
})

test('a record pending after an outage is sent after a refresh, while new matches stay playable', async ({ page }) => {
  await openMenu(page, { scenario: 'submit-unavailable', options: QUICK_DEFEAT })
  await loseMatch(page)
  await expect(page.getByText(NOT_SAVED)).toBeVisible(SLOW)

  await loseMatch(page)
  await expect(page.getByText(NOT_SAVED)).toBeVisible(SLOW)

  await page.goto('/?e2e&clock=manual&seed=1&scenario=success')
  await expect(page.getByRole('region', { name: 'Last battle' }).getByText(SAVED)).toBeVisible()

  await page.getByRole('button', { name: 'Match History' }).click()
  await expect(rows(page)).toHaveCount(2)
})

test('retrying after a timeout that already stored the match does not duplicate it', async ({ page }) => {
  await openMenu(page, { scenario: 'submit-timeout', options: QUICK_DEFEAT })
  await loseMatch(page)
  await expect(page.getByText(NOT_SAVED)).toBeVisible(SLOW)

  await page.getByRole('button', { name: 'Main Menu' }).click()
  await selectScenario(page, 'success')
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByText(SAVED)).toBeVisible()

  await page.getByRole('button', { name: 'Match History' }).click()
  await expect(rows(page)).toHaveCount(1)
  await page.getByRole('tab', { name: 'Ranking' }).click()
  await expect(rows(page)).toHaveCount(1)
})

test('a late response does not replace newer data', async ({ page }) => {
  await openMenu(page, { scenario: 'out-of-order' })
  await page.getByRole('button', { name: 'Ranking' }).click()
  await expect(page.getByText('Page 1 of 13')).toBeVisible()

  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByText('Page 2 of 13')).toBeVisible()

  // Page 3 is slow; going back to page 2 before it arrives must leave page 2 on screen.
  await page.getByRole('button', { name: 'Next page' }).click()
  await page.getByRole('button', { name: 'Previous page' }).click()
  await page.waitForTimeout(2000)
  await expect(page.getByText('Page 2 of 13')).toBeVisible()
  await expect(rows(page).first()).toContainText('06')
})

import { test, expect } from '../fixtures'
import { DashboardPage } from '../pages/DashboardPage'
import { TripPage } from '../pages/TripPage'

function tripIdFromUrl(url: string): number {
  const match = url.match(/\/trips\/(\d+)/)
  if (!match) throw new Error(`Cannot parse trip ID from URL: ${url}`)
  return parseInt(match[1], 10)
}

// ---------------------------------------------------------------------------
// GEN-01 prerequisite: full trip setup verifying Generate Plan button is enabled
// Scenario:
//   1. Fill user profile preferences (travel style defaults)
//   2. Create a new trip
//   3. Fill trip title, destination, preferences and a multi-sentence note
//   4. Wait for auto-save (triggered by note blur)
//   5. Assert trip is DRAFT and Generate Plan button is enabled
// ---------------------------------------------------------------------------
test.describe('GEN-01 setup: Generate Plan button enabled after filling trip data', () => {
  test('generate button is visible and enabled after saving trip with destination, preferences and note', async ({
    authenticatedPage: page,
    tripApi
  }) => {
    const dashboard = new DashboardPage(page)
    const tripPage = new TripPage(page)

    // ── Arrange: ensure profile row exists, then set travel style defaults ─
    await tripApi.upsertProfile()

    await dashboard.goto()
    await page.waitForLoadState('networkidle')

    await dashboard.profilePanel.selectSpeed('balance')
    await dashboard.profilePanel.selectTripType('base_with_trips')
    await dashboard.profilePanel.selectBudget('moderate')
    await dashboard.profilePanel.toggleWhat('culture_museums')
    await dashboard.profilePanel.toggleWhat('city_break')
    await dashboard.profilePanel.save()

    // ── Act: create trip ──────────────────────────────────────────────────
    await dashboard.anyCreateTripBtn.click()
    await expect(page).toHaveURL(/\/trips\/\d+/)
    const tripId = tripIdFromUrl(page.url())

    try {
      // Fill trip title
      await tripPage.fillTitle('Weekend in Kraków')

      // Fill required destination
      await tripPage.fillDestination('Kraków, Poland')

      // Fill trip-level preferences (override profile defaults)
      await tripPage.fillNumDays(3)
      await tripPage.fillNumPeople(2)
      await tripPage.selectSpeed('slow_chill')
      await tripPage.selectTripType('base')
      await tripPage.selectBudget('budget')
      await tripPage.toggleWhat('culture_museums')

      // Fill note and blur – triggers immediate save of all pending fields
      await tripPage.fillNote(
        'Looking for a relaxing cultural weekend in the old town. ' +
          'Interested in historical sites, local restaurants and the main museums. ' +
          'Prefer walking and public transport – no car rental needed.'
      )

      // Wait for the save cycle triggered by note blur
      await tripPage.waitForSaved()

      // ── Assert ────────────────────────────────────────────────────────
      // Trip should be in DRAFT state after saving content
      await expect(tripPage.statusBadge).toHaveText('DRAFT')

      // Generate Plan button must be visible and enabled
      await expect(tripPage.generatePlanBtn).toBeVisible()
      await expect(tripPage.generatePlanBtn).toBeEnabled()
    } finally {
      await tripApi.deleteTrip(tripId)
    }
  })
})

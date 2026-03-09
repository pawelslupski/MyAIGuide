import { test, expect } from '../fixtures'
import { DashboardPage } from '../pages/DashboardPage'
import { TripPage } from '../pages/TripPage'

// ---------------------------------------------------------------------------
// Helper: extract trip ID from URL /trips/:id
// ---------------------------------------------------------------------------
function tripIdFromUrl(url: string): number {
  const match = url.match(/\/trips\/(\d+)/)
  if (!match) throw new Error(`Cannot parse trip ID from URL: ${url}`)
  return parseInt(match[1], 10)
}

// ---------------------------------------------------------------------------
// TRIP-01: Tworzenie wycieczki
// ---------------------------------------------------------------------------
test.describe('TRIP-01: Create trip', () => {
  test('clicking the create button creates a trip and redirects to its detail page', async ({
    authenticatedPage: page,
    tripApi
  }) => {
    const dashboard = new DashboardPage(page)

    // After fixture, page is at '/'. Wait for dashboard to be interactive.
    await dashboard.anyCreateTripBtn.waitFor({ state: 'visible', timeout: 10000 })
    await dashboard.anyCreateTripBtn.click()

    // Should navigate to /trips/:id
    await expect(page).toHaveURL(/\/trips\/\d+/, { timeout: 10000 })

    // Cleanup
    const tripId = tripIdFromUrl(page.url())
    await tripApi.deleteTrip(tripId)
  })

  test('newly created trip appears on the dashboard with status "New"', async ({
    authenticatedPage: page,
    tripApi
  }) => {
    const dashboard = new DashboardPage(page)

    await dashboard.anyCreateTripBtn.waitFor({ state: 'visible', timeout: 10000 })
    await dashboard.anyCreateTripBtn.click()

    await expect(page).toHaveURL(/\/trips\/\d+/, { timeout: 10000 })
    const tripId = tripIdFromUrl(page.url())

    // Return to dashboard and verify card is visible
    await page.goto('/')
    const card = page.locator(`[data-testid="trip-card"][data-trip-id="${tripId}"]`)
    await expect(card).toBeVisible({ timeout: 10000 })
    await expect(card.getByTestId('trip-card-status')).toHaveText('New')

    // Cleanup
    await tripApi.deleteTrip(tripId)
  })
})

// ---------------------------------------------------------------------------
// TRIP-02: Edycja tytułu
// ---------------------------------------------------------------------------
test.describe('TRIP-02: Edit trip title', () => {
  test('changed title is saved and persisted after page reload', async ({
    authenticatedPage: page,
    tripApi
  }) => {
    const { id: tripId } = await tripApi.createTrip('Original Title')
    const tripPage = new TripPage(page)

    try {
      await tripPage.goto(tripId)
      await expect(tripPage.titleInput).toBeVisible()

      // Update title and blur to trigger debounced auto-save
      await tripPage.titleInput.fill('Updated Title E2E')
      await tripPage.titleInput.blur()

      // Wait for debounce (800 ms) then save indicator to appear and disappear
      await tripPage.waitForSaved()

      // Reload and verify persistence
      await page.reload()
      await expect(tripPage.titleInput).toHaveValue('Updated Title E2E')
    } finally {
      await tripApi.deleteTrip(tripId)
    }
  })
})

// ---------------------------------------------------------------------------
// TRIP-03: Edycja notatki → status zmienia się na DRAFT
// ---------------------------------------------------------------------------
test.describe('TRIP-03: Edit note changes status to DRAFT', () => {
  test('adding a note saves it and changes trip status to DRAFT', async ({
    authenticatedPage: page,
    tripApi
  }) => {
    const { id: tripId } = await tripApi.createTrip('Note Test Trip')
    const tripPage = new TripPage(page)

    try {
      await tripPage.goto(tripId)
      await expect(tripPage.statusBadge).toHaveText('CREATED')

      // Note blur triggers an immediate save (no debounce)
      await tripPage.noteTextarea.fill('This is my E2E test note.')
      await tripPage.noteTextarea.blur()

      await tripPage.waitForSaved()

      await expect(tripPage.statusBadge).toHaveText('DRAFT')

      // Verify persistence
      await page.reload()
      await expect(tripPage.noteTextarea).toHaveValue('This is my E2E test note.')
      await expect(tripPage.statusBadge).toHaveText('DRAFT')
    } finally {
      await tripApi.deleteTrip(tripId)
    }
  })
})

// ---------------------------------------------------------------------------
// TRIP-04: Edycja preferencji → status DRAFT
// ---------------------------------------------------------------------------
test.describe('TRIP-04: Edit preferences changes status to DRAFT', () => {
  test('selecting a speed preference saves it and sets status to DRAFT', async ({
    authenticatedPage: page,
    tripApi
  }) => {
    const { id: tripId } = await tripApi.createTrip('Prefs Test Trip')
    const tripPage = new TripPage(page)

    try {
      await tripPage.goto(tripId)
      await expect(tripPage.statusBadge).toHaveText('CREATED')

      // Speed preference triggers debounced auto-save (800 ms)
      await tripPage.speed('balance').click()

      await tripPage.waitForSaved()

      await expect(tripPage.statusBadge).toHaveText('DRAFT')

      // Verify persistence
      await page.reload()
      await expect(tripPage.speed('balance')).toBeChecked()
    } finally {
      await tripApi.deleteTrip(tripId)
    }
  })

  test('setting destination saves it and sets status to DRAFT', async ({
    authenticatedPage: page,
    tripApi
  }) => {
    const { id: tripId } = await tripApi.createTrip('Destination Test Trip')
    const tripPage = new TripPage(page)

    try {
      await tripPage.goto(tripId)

      await tripPage.destinationInput.fill('Rome, Italy')
      await tripPage.destinationInput.blur()

      await tripPage.waitForSaved()

      await expect(tripPage.statusBadge).toHaveText('DRAFT')

      await page.reload()
      await expect(tripPage.destinationInput).toHaveValue('Rome, Italy')
    } finally {
      await tripApi.deleteTrip(tripId)
    }
  })
})

// ---------------------------------------------------------------------------
// TRIP-05: Notatka > 10 000 znaków — walidacja blokuje zapis
// ---------------------------------------------------------------------------
test.describe('TRIP-05: Note over 10 000 characters', () => {
  test('pasting a note longer than 10 000 chars shows a validation error', async ({
    authenticatedPage: page,
    tripApi
  }) => {
    const { id: tripId } = await tripApi.createTrip('Validation Test Trip')
    const tripPage = new TripPage(page)

    try {
      await tripPage.goto(tripId)

      const longNote = 'a'.repeat(10001)
      await tripPage.noteTextarea.fill(longNote)

      // Validation message appears client-side immediately (no save needed)
      await expect(tripPage.noteValidationMessage).toBeVisible()
      await expect(tripPage.noteValidationMessage).toContainText('Maximum')
    } finally {
      await tripApi.deleteTrip(tripId)
    }
  })
})

// ---------------------------------------------------------------------------
// TRIP-06: Usunięcie wycieczki
// ---------------------------------------------------------------------------
test.describe('TRIP-06: Delete trip', () => {
  test('deleting a trip via the dashboard removes it from the list', async ({
    authenticatedPage: page,
    tripApi
  }) => {
    const { id: tripId } = await tripApi.createTrip('Trip To Delete')
    const dashboard = new DashboardPage(page)

    // Navigate to dashboard and wait for the card to appear
    await page.goto('/')
    const card = page.locator(`[data-testid="trip-card"][data-trip-id="${tripId}"]`)
    await expect(card).toBeVisible({ timeout: 10000 })

    // Click the delete button on the specific card
    await dashboard.deleteBtnById(tripId).click()

    // Confirm deletion in the dialog
    await expect(dashboard.deleteDialogConfirmBtn).toBeVisible()
    await dashboard.deleteDialogConfirmBtn.click()

    // Card should disappear from the list
    await expect(card).not.toBeVisible()
  })
})

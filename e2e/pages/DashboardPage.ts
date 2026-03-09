import { type Locator, type Page } from '@playwright/test'
import { ProfilePage } from './ProfilePage'

export class DashboardPage {
  readonly newTripBtn: Locator
  readonly createFirstTripBtn: Locator
  readonly profilePanel: ProfilePage

  constructor(private readonly page: Page) {
    this.newTripBtn = page.getByTestId('new-trip-btn')
    this.createFirstTripBtn = page.getByTestId('create-first-trip-btn')
    this.profilePanel = new ProfilePage(page)
  }

  async goto() {
    await this.page.goto('/')
  }

  /** Returns whichever "create trip" button is currently visible */
  get anyCreateTripBtn(): Locator {
    return this.page.getByTestId('new-trip-btn').or(this.page.getByTestId('create-first-trip-btn'))
  }

  /** Trip card with a specific data-trip-id attribute */
  tripCardById(tripId: number): Locator {
    return this.page
      .getByTestId('trip-card')
      .filter({ has: this.page.locator(`[data-trip-id="${tripId}"]`) })
  }

  /** Delete button inside the card for a given trip ID */
  deleteBtnById(tripId: number): Locator {
    return this.page
      .locator(`[data-testid="trip-card"][data-trip-id="${tripId}"]`)
      .getByTestId('trip-card-delete-btn')
  }

  get deleteDialogConfirmBtn(): Locator {
    return this.page.getByTestId('delete-dialog-confirm')
  }

  get deleteDialogCancelBtn(): Locator {
    return this.page.getByTestId('delete-dialog-cancel')
  }
}

import { type Locator, type Page, expect } from '@playwright/test'

type FlagKey = 'has_kids' | 'has_pets' | 'has_mobility_issues' | 'has_dietary_preferences'
type WhatValue = 'nature' | 'beach_relax' | 'culture_museums' | 'city_break' | 'foodie'
type SpeedValue = 'slow_chill' | 'balance' | 'intensive'
type TypeValue = 'base' | 'base_with_trips' | 'roadtrip'
type BudgetValue = 'budget' | 'moderate' | 'luxury'

/**
 * Page Object for the UserProfilePanel component embedded in DashboardView.
 * Navigate to DashboardPage first, then use this class to interact with the panel.
 */
export class ProfilePage {
  readonly saveBtn: Locator
  readonly resetBtn: Locator
  readonly dietaryTextarea: Locator

  constructor(private readonly page: Page) {
    this.saveBtn = page.getByTestId('profile-save-btn')
    this.resetBtn = page.getByTestId('profile-reset-btn')
    this.dietaryTextarea = page.getByTestId('profile-dietary-textarea')
  }

  // ── Locators ──────────────────────────────────────────────────────────────

  /** Traveler flag pill button (kids / pets / mobility / dietary) */
  flag(key: FlagKey): Locator {
    return this.page.getByTestId(`profile-flag-${key}`)
  }

  /** Interest option button in "What interests you?" (multi-select) */
  what(value: WhatValue): Locator {
    return this.page.getByTestId(`profile-what-${value}`)
  }

  /** Travel speed option button */
  speed(value: SpeedValue): Locator {
    return this.page.getByTestId(`profile-speed-${value}`)
  }

  /** Trip type option button */
  tripType(value: TypeValue): Locator {
    return this.page.getByTestId(`profile-type-${value}`)
  }

  /** Budget option button */
  budget(value: BudgetValue): Locator {
    return this.page.getByTestId(`profile-budget-${value}`)
  }

  // ── Action helpers ────────────────────────────────────────────────────────

  async toggleFlag(key: FlagKey) {
    await this.flag(key).click()
  }

  async toggleWhat(value: WhatValue) {
    await this.what(value).click()
  }

  async selectSpeed(value: SpeedValue) {
    await this.speed(value).click()
  }

  async selectTripType(value: TypeValue) {
    await this.tripType(value).click()
  }

  async selectBudget(value: BudgetValue) {
    await this.budget(value).click()
  }

  async fillDietaryDescription(text: string) {
    await this.dietaryTextarea.fill(text)
  }

  /** Saves the profile and waits until the Save button is disabled again (no pending changes). */
  async save() {
    await this.saveBtn.click()
    await expect(this.saveBtn).toBeDisabled({ timeout: 5000 })
  }

  async reset() {
    await this.resetBtn.click()
  }
}

import { type Locator, type Page, expect } from '@playwright/test'

type SpeedValue = 'slow_chill' | 'balance' | 'intensive'
type TypeValue = 'base' | 'base_with_trips' | 'roadtrip'
type BudgetValue = 'budget' | 'moderate' | 'luxury'
type WhatValue = 'nature' | 'beach_relax' | 'culture_museums' | 'city_break' | 'foodie'

export class TripPage {
  // ── Header ────────────────────────────────────────────────────────────────
  readonly titleInput: Locator
  readonly statusBadge: Locator
  readonly savingIndicator: Locator

  // ── Editor ────────────────────────────────────────────────────────────────
  readonly destinationInput: Locator
  readonly numDaysInput: Locator
  readonly numPeopleInput: Locator
  readonly noteTextarea: Locator
  readonly noteValidationMessage: Locator

  // ── Plan Panel ────────────────────────────────────────────────────────────
  readonly generatePlanBtn: Locator
  readonly savePlanBtn: Locator
  readonly discardPlanBtn: Locator
  readonly regeneratePlanBtn: Locator

  constructor(private readonly page: Page) {
    // Header
    this.titleInput = page.getByTestId('trip-title-input')
    this.statusBadge = page.getByTestId('trip-status-badge')
    this.savingIndicator = page.getByTestId('trip-saving-indicator')

    // Editor
    this.destinationInput = page.getByTestId('trip-destination-input')
    this.numDaysInput = page.getByTestId('trip-num-days-input')
    this.numPeopleInput = page.getByTestId('trip-num-people-input')
    this.noteTextarea = page.getByTestId('trip-note-textarea')
    this.noteValidationMessage = page.getByTestId('note-validation-message')

    // Plan Panel
    this.generatePlanBtn = page.getByTestId('generate-plan-btn')
    this.savePlanBtn = page.getByTestId('save-plan-btn')
    this.discardPlanBtn = page.getByTestId('discard-plan-btn')
    this.regeneratePlanBtn = page.getByTestId('regenerate-plan-btn')
  }

  async goto(tripId: number) {
    await this.page.goto(`/trips/${tripId}`)
  }

  // ── Preference locators ───────────────────────────────────────────────────

  speed(value: SpeedValue): Locator {
    return this.page.getByTestId(`trip-speed-radio-${value}`)
  }

  tripType(value: TypeValue): Locator {
    return this.page.getByTestId(`trip-type-radio-${value}`)
  }

  budget(value: BudgetValue): Locator {
    return this.page.getByTestId(`trip-budget-radio-${value}`)
  }

  what(value: WhatValue): Locator {
    return this.page.getByTestId(`trip-what-checkbox-${value}`)
  }

  // ── Action helpers ────────────────────────────────────────────────────────

  async fillTitle(title: string) {
    await this.titleInput.fill(title)
    await this.titleInput.blur()
  }

  async fillDestination(destination: string) {
    await this.destinationInput.fill(destination)
    await this.destinationInput.blur()
  }

  async fillNote(note: string) {
    await this.noteTextarea.fill(note)
    await this.noteTextarea.blur()
  }

  async fillNumDays(days: number) {
    await this.numDaysInput.fill(String(days))
    await this.numDaysInput.blur()
  }

  async fillNumPeople(people: number) {
    await this.numPeopleInput.fill(String(people))
    await this.numPeopleInput.blur()
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

  async toggleWhat(value: WhatValue) {
    await this.what(value).click()
  }

  /**
   * Wait for the auto-save to complete.
   *
   * Debounced fields (title, destination, preferences) fire after 800 ms.
   * Note blur fires immediately. A 2 500 ms timeout covers both cases.
   *
   * Strategy:
   *  1. Wait for the "Saving…" indicator to appear (save started).
   *  2. Wait for it to disappear (save completed).
   */
  async waitForSaved() {
    // Step 1 — wait for save to start (handles 800 ms debounce + network latency buffer)
    await expect(this.savingIndicator).toBeVisible({ timeout: 2500 })
    // Step 2 — wait for save to complete
    await expect(this.savingIndicator).not.toBeVisible({ timeout: 5000 })
  }

  /** Waits until the Generate Plan button is visible and not disabled */
  async waitForGenerateBtnEnabled(timeout = 5000) {
    await expect(this.generatePlanBtn).toBeVisible({ timeout })
    await expect(this.generatePlanBtn).toBeEnabled({ timeout })
  }
}

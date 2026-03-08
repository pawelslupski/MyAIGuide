import { type Locator, type Page } from '@playwright/test'

export class LoginPage {
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly errorAlert: Locator
  readonly fieldErrors: Locator

  constructor(private readonly page: Page) {
    this.emailInput = page.locator('#email')
    this.passwordInput = page.locator('#password')
    this.submitButton = page.getByRole('button', { name: 'Log in' })
    this.errorAlert = page.getByRole('alert')
    this.fieldErrors = page.locator('p.text-destructive')
  }

  async goto() {
    await this.page.goto('/login')
  }

  async fillAndSubmit(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }
}

import { test, expect } from '../fixtures'
import { LoginPage } from '../pages/LoginPage'

test.describe('Route guards', () => {
  test('AUTH-08: unauthenticated user is redirected from / to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
    const url = new URL(page.url())
    expect(url.searchParams.get('redirect')).toBe('/')
  })

  test('AUTH-09: authenticated user is redirected from /login to /', async ({
    authenticatedPage: page
  }) => {
    await page.goto('/login')
    await expect(page).toHaveURL('/')
  })
})

test.describe('Login form', () => {
  test('AUTH-01: successful login redirects to dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.fillAndSubmit(process.env.E2E_USERNAME!, process.env.E2E_PASSWORD!)
    await expect(page).toHaveURL('/')
  })

  test('AUTH-02: wrong password shows error alert', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.fillAndSubmit(process.env.E2E_USERNAME!, 'wrong-password-xyz')
    await expect(loginPage.errorAlert).toBeVisible()
    await expect(loginPage.errorAlert).toContainText('Invalid email or password')
  })

  test('AUTH-03: empty form submission shows field validation errors', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.submitButton.click()
    await expect(loginPage.fieldErrors.first()).toBeVisible()
  })

  test('AUTH-04: short password shows translated validation error', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.emailInput.fill('test@example.com')
    await loginPage.passwordInput.fill('abc')
    await loginPage.submitButton.click()
    await expect(loginPage.fieldErrors.first()).toBeVisible()
    await expect(loginPage.fieldErrors.first()).toContainText('at least 6 characters')
  })
})

test.describe('Session management', () => {
  test('AUTH-06: logout clears session and redirects to /login', async ({
    authenticatedPage: page
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /log out/i }).click()
    await expect(page).toHaveURL('/login')
  })

  test('AUTH-10: session persists after page refresh', async ({ authenticatedPage: page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/')
    await page.reload()
    await expect(page).toHaveURL('/')
  })
})

import { test as base, type Page } from '@playwright/test'

type Fixtures = {
  authenticatedPage: Page
}

export const test = base.extend<Fixtures>({
  authenticatedPage: async ({ page, request }, use) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL!
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY!

    const response = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      data: { email: process.env.E2E_USERNAME!, password: process.env.E2E_PASSWORD! }
    })

    const text = await response.text()

    if (!text) {
      throw new Error(
        `Supabase auth returned empty body (HTTP ${response.status()}). ` +
          `Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.test.`
      )
    }
    const session = JSON.parse(text)
    if (session.error) {
      throw new Error(
        `Supabase auth failed: ${session.error_description ?? session.error}. ` +
          `Check E2E_USERNAME / E2E_PASSWORD in .env.test and that the test user exists.`
      )
    }
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0]

    await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
      key: `sb-${projectRef}-auth-token`,
      value: session
    })

    await use(page)
  }
})

export { expect } from '@playwright/test'

import { test as base, type Page, type APIRequestContext } from '@playwright/test'

type Fixtures = {
  authenticatedPage: Page
  tripApi: TripApiHelper
}

// ---------------------------------------------------------------------------
// TripApiHelper — direct Supabase REST API for test data setup / teardown
// ---------------------------------------------------------------------------
export class TripApiHelper {
  private readonly supabaseUrl: string
  private readonly anonKey: string
  private readonly accessToken: string

  constructor(
    private readonly request: APIRequestContext,
    session: { access_token: string },
    env: { supabaseUrl: string; anonKey: string }
  ) {
    this.supabaseUrl = env.supabaseUrl
    this.anonKey = env.anonKey
    this.accessToken = session.access_token
  }

  /** Decode the JWT payload to extract `sub` (user UUID). */
  private getUserId(): string {
    const payload = this.accessToken.split('.')[1]
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)
    const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
    return decoded.sub as string
  }

  async createTrip(title: string): Promise<{ id: number }> {
    const userId = this.getUserId()

    const res = await this.request.post(`${this.supabaseUrl}/rest/v1/trips`, {
      headers: {
        apikey: this.anonKey,
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      data: { title, user_id: userId }
    })

    const json = await res.json()

    if (!res.ok()) {
      throw new Error(`Failed to create trip via API (${res.status()}): ${JSON.stringify(json)}`)
    }

    const rows = Array.isArray(json) ? json : []
    if (!rows[0]) {
      throw new Error(
        `createTrip: empty response — RLS may have blocked insert. Body: ${JSON.stringify(json)}`
      )
    }

    return rows[0] as { id: number }
  }

  /**
   * Upserts a minimal profile row for the test user.
   * Needed when the DB trigger that auto-creates profiles on sign-up
   * is absent in the E2E environment.
   */
  async upsertProfile(overrides: Record<string, unknown> = {}): Promise<void> {
    const userId = this.getUserId()
    const res = await this.request.post(
      `${this.supabaseUrl}/rest/v1/profiles?on_conflict=user_id`,
      {
        headers: {
          apikey: this.anonKey,
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        data: { user_id: userId, ...overrides }
      }
    )
    if (!res.ok()) {
      const body = await res.text()
      throw new Error(`upsertProfile failed (${res.status()}): ${body}`)
    }
  }

  async deleteTrip(tripId: number): Promise<void> {
    await this.request.delete(`${this.supabaseUrl}/rest/v1/trips?id=eq.${tripId}`, {
      headers: {
        apikey: this.anonKey,
        Authorization: `Bearer ${this.accessToken}`
      }
    })
  }

  async deleteAllTrips(): Promise<void> {
    const userId = this.getUserId()
    await this.request.delete(`${this.supabaseUrl}/rest/v1/trips?user_id=eq.${userId}`, {
      headers: {
        apikey: this.anonKey,
        Authorization: `Bearer ${this.accessToken}`
      }
    })
  }
}

// ---------------------------------------------------------------------------
// getSession — obtain a Supabase session via the REST auth API
// ---------------------------------------------------------------------------
async function getSession(request: APIRequestContext) {
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

  return { session, supabaseUrl, anonKey }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
export const test = base.extend<Fixtures>({
  /**
   * authenticatedPage — signs in via the UI login form, then intercepts all
   * GET /auth/v1/user requests so they return the session user from localStorage
   * instead of making a real network call.
   *
   * Why the intercept is necessary: supabaseClient.auth.getUser() always makes
   * an HTTP request. Under parallel test execution this causes sporadic failures
   * (lock contention / network race in the local Supabase instance). Serving the
   * response directly from the already-valid localStorage session is equivalent
   * and eliminates the flakiness.
   *
   * The interceptor is installed BEFORE goto('/login') so it is guaranteed to be
   * active for every getUser() call — including the ones that fire during the
   * initial dashboard mount.
   */
  authenticatedPage: async ({ page }, use) => {
    // Install the interceptor before any navigation.
    // Before login localStorage has no session → route.continue() (real request).
    // After login localStorage has the session → mocked response.
    await page.route('**/auth/v1/user', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }
      try {
        const userData = await page.evaluate(() => {
          const key = Object.keys(localStorage).find((k) => k.endsWith('-auth-token'))
          if (!key) return null
          const raw = localStorage.getItem(key)
          if (!raw) return null
          return JSON.parse(raw)?.user ?? null
        })
        if (userData) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(userData)
          })
        } else {
          await route.continue()
        }
      } catch {
        // Evaluation may fail during page transitions — fall back to real request
        await route.continue()
      }
    })

    // UI login — properly initialises the Supabase client's internal _session
    await page.goto('/login')
    await page.locator('#email').fill(process.env.E2E_USERNAME!)
    await page.locator('#password').fill(process.env.E2E_PASSWORD!)
    await page.getByRole('button', { name: 'Log in' }).click()
    await page.waitForURL('/')

    await use(page)
  },

  /**
   * tripApi — direct Supabase REST access for programmatic test-data management.
   */
  tripApi: async ({ request }, use) => {
    const { session, supabaseUrl, anonKey } = await getSession(request)
    await use(new TripApiHelper(request, session, { supabaseUrl, anonKey }))
  }
})

export { expect } from '@playwright/test'

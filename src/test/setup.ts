import { afterEach, vi } from 'vitest'
import { config } from '@vue/test-utils'

// ─── Global mocks ────────────────────────────────────────────────────────────

// Mock Supabase client so tests never hit the real API
vi.mock('@/db/supabase.client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi
        .fn()
        .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn()
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null })
    })
  }
}))

// ─── Vue Test Utils global config ────────────────────────────────────────────

config.global.stubs = {}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.clearAllMocks()
})

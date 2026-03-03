import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabaseClient } from '@/db/supabase.client'
import { createTrip } from './trip.service'
import { ApiError } from '@/lib/errors/api.error'

// Override global setup mock — service imports supabaseClient, not supabase
vi.mock('@/db/supabase.client', () => ({
  supabaseClient: { from: vi.fn() }
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-123'

const makeDbRow = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  user_id: USER_ID,
  title: 'New Trip',
  destination: null,
  num_days: null,
  num_people: null,
  what: [] as string[],
  speed: null,
  type: null,
  budget: null,
  note_body: null,
  plan_json: null,
  plan_language: null,
  created_at: '2024-01-23T10:00:00Z',
  updated_at: '2024-01-23T10:00:00Z',
  ...overrides
})

function stubInsert(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result)
  const select = vi.fn().mockReturnValue({ single })
  const insert = vi.fn().mockReturnValue({ select })
  vi.mocked(supabaseClient.from).mockReturnValue({ insert } as any)
  return { single, select, insert }
}

// ─── createTrip ───────────────────────────────────────────────────────────────

describe('createTrip (service)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('CTSVC-01: returns TripDTO with status CREATED for a minimal insert (no preferences)', async () => {
    stubInsert({ data: makeDbRow(), error: null })

    const result = await createTrip({ title: 'New Trip' }, USER_ID)

    expect(result.id).toBe(1)
    expect(result.title).toBe('New Trip')
    expect(result.status).toBe('CREATED')
    expect(result.plan_json).toBeNull()
    expect(result.plan_language).toBeNull()
    expect(result.what).toEqual([])
    expect(result.speed).toBeNull()
    expect(result.type).toBeNull()
    expect(result.budget).toBeNull()
  })

  it('CTSVC-02: returns TripDTO with status DRAFT when preference fields are set', async () => {
    stubInsert({
      data: makeDbRow({
        speed: 'intensive',
        type: 'base',
        budget: 'luxury',
        what: ['culture_museums', 'foodie']
      }),
      error: null
    })

    const result = await createTrip(
      {
        title: 'Paris',
        speed: 'intensive',
        type: 'base',
        budget: 'luxury',
        what: ['culture_museums', 'foodie']
      },
      USER_ID
    )

    expect(result.status).toBe('DRAFT')
    expect(result.speed).toBe('intensive')
    expect(result.type).toBe('base')
    expect(result.budget).toBe('luxury')
    expect(result.what).toEqual(['culture_museums', 'foodie'])
  })

  it('CTSVC-03: inserts all provided fields into the database', async () => {
    const { insert } = stubInsert({
      data: makeDbRow({ destination: 'Rome', num_days: 5 }),
      error: null
    })

    await createTrip(
      { title: 'Rome', destination: 'Rome', num_days: 5, note_body: 'Visit the Colosseum' },
      USER_ID
    )

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Rome',
        user_id: USER_ID,
        destination: 'Rome',
        num_days: 5,
        note_body: 'Visit the Colosseum'
      })
    )
  })

  it('CTSVC-04: throws INTERNAL_ERROR when Supabase returns an error object', async () => {
    stubInsert({ data: null, error: { message: 'DB constraint violation' } })

    await expect(createTrip({ title: 'Trip' }, USER_ID)).rejects.toSatisfy(
      (e: unknown) => e instanceof ApiError && e.code === 'INTERNAL_ERROR'
    )
  })

  it('CTSVC-05: throws INTERNAL_ERROR when Supabase returns null data with no error', async () => {
    stubInsert({ data: null, error: null })

    await expect(createTrip({ title: 'Trip' }, USER_ID)).rejects.toSatisfy(
      (e: unknown) => e instanceof ApiError && e.code === 'INTERNAL_ERROR'
    )
  })
})

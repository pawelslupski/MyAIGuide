import { supabaseClient } from '@/db/supabase.client'
import type {
  TripDTO,
  TripStatus,
  PlanJson,
  CreateTripCommand,
  TripsListDTO,
  TripListItemDTO,
  GetTripsQuery
} from '@/types'
import {
  createNotFoundError,
  createForbiddenError,
  createValidationError,
  createInternalError
} from '@/lib/errors/api.error'
import { validateSavePlanCommand } from '@/lib/validation/plan.schemas'
import { ZodError } from 'zod'

/**
 * Trip Service
 * Handles trip data retrieval and status computation
 */

/**
 * Create a new trip
 *
 * @param command - Trip creation data
 * @returns Promise<{ id: number }> - ID of the newly created trip
 * @throws ApiError on database error
 */
export async function createTrip(
  command: CreateTripCommand,
  userId: string
): Promise<{ id: number }> {
  const { data, error } = await supabaseClient
    .from('trips')
    .insert({ title: command.title, user_id: userId })
    .select('id')
    .single()

  if (error || !data) {
    throw createInternalError(`Failed to create trip: ${error?.message || 'Unknown error'}`)
  }

  return data
}

/**
 * Derive trip status based on note_body and plan_json presence
 *
 * Status logic:
 * - CREATED: note_body IS NULL AND plan_json IS NULL
 * - DRAFT: note_body IS NOT NULL AND plan_json IS NULL
 * - CONFIRMED: plan_json IS NOT NULL
 *
 * @param noteBody - Trip note content (can be null)
 * @param planJson - Saved plan data (can be null)
 * @returns TripStatus enum value
 */
export function deriveTripStatus(noteBody: string | null, planJson: unknown): TripStatus {
  // CONFIRMED: plan exists (regardless of note)
  if (planJson !== null) {
    return 'CONFIRMED'
  }

  // DRAFT: note exists but no plan
  if (noteBody !== null && noteBody.length > 0) {
    return 'DRAFT'
  }

  // CREATED: no note and no plan
  return 'CREATED'
}

/**
 * Get trip by ID with ownership validation
 *
 * Fetches trip from database and validates:
 * 1. Trip exists (throws 404 if not found)
 * 2. User owns the trip (throws 403 if ownership mismatch)
 * 3. Derives trip status from note_body and plan_json
 *
 * Security:
 * - Uses Supabase RLS for database-level filtering
 * - Performs explicit ownership check for defense in depth
 * - Returns typed TripDTO with PlanJson instead of raw JSONB
 *
 * @param tripId - Trip identifier (positive integer)
 * @param userId - Authenticated user ID (UUID)
 * @returns Promise<TripDTO> - Typed trip data with computed status
 * @throws ApiError - 404 if trip not found, 403 if unauthorized
 */
export async function getTripById(tripId: number, userId: string): Promise<TripDTO> {
  const { data: trip, error } = await supabaseClient
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single()

  if (error || !trip) {
    throw createNotFoundError()
  }

  if (trip.user_id !== userId) {
    throw createForbiddenError()
  }

  const status = deriveTripStatus(trip.note_body, trip.plan_json)

  return {
    ...trip,
    plan_json: trip.plan_json as PlanJson | null,
    status
  }
}

/**
 * Fetch paginated trips for a user with optional status filter.
 *
 * - Selects only columns needed for TripListItemDTO (+ note_body and plan_json for status derivation)
 * - Translates `status` filter to DB-level note_body / plan_json conditions
 * - Strips note_body and plan_json from returned DTOs
 * - Returns TripsListDTO with computed status on every item
 *
 * @param userId - Authenticated user ID (UUID)
 * @param query  - Validated query params: page, limit, optional status
 */
export async function getTrips(userId: string, query: GetTripsQuery): Promise<TripsListDTO> {
  const { page, limit, status } = query
  const from = (page - 1) * limit
  const to = from + limit - 1

  // Build base query — fetch note_body and plan_json for status derivation (stripped before return)
  let q = supabaseClient
    .from('trips')
    .select(
      'id, user_id, title, destination, num_days, num_people, note_body, plan_json, created_at, updated_at',
      { count: 'exact' }
    )
    .eq('user_id', userId) // defense-in-depth on top of RLS
    .order('updated_at', { ascending: false })
    .range(from, to)

  // Translate status filter to DB column conditions
  if (status === 'CONFIRMED') {
    q = q.not('plan_json', 'is', null)
  } else if (status === 'DRAFT') {
    q = q.is('plan_json', null).not('note_body', 'is', null).neq('note_body', '')
  } else if (status === 'CREATED') {
    q = q.is('plan_json', null).or('note_body.is.null,note_body.eq.')
  }

  const { data, error: fetchError, count } = await q

  if (fetchError) {
    throw createInternalError(`Failed to fetch trips: ${fetchError.message}`)
  }

  const rows = data ?? []
  const trips: TripListItemDTO[] = rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    destination: row.destination,
    num_days: row.num_days,
    num_people: row.num_people,
    created_at: row.created_at,
    updated_at: row.updated_at,
    status: deriveTripStatus(row.note_body, row.plan_json)
  }))

  const total = count ?? 0
  return {
    trips,
    pagination: {
      current_page: page,
      total_pages: Math.max(1, Math.ceil(total / limit)),
      total_count: total,
      limit
    }
  }
}

/**
 * Update trip fields
 *
 * Updates specified fields for a trip owned by the user.
 * Uses .eq('user_id', userId) for RLS + ownership enforcement.
 *
 * @param tripId - Trip identifier (positive integer)
 * @param userId - Authenticated user ID (UUID)
 * @param updates - Partial trip fields to update
 * @returns Promise<TripDTO> - Updated trip with derived status
 * @throws ApiError - 404 if not found or not owned by user
 */
export interface TripUpdateFields {
  title?: string
  destination?: string | null
  note_body?: string | null
  what?: string[] | null
  speed?: string | null
  type?: string | null
  budget?: string | null
  num_days?: number | null
  num_people?: number | null
}

export async function updateTrip(
  tripId: number,
  userId: string,
  updates: TripUpdateFields
): Promise<TripDTO> {
  const { data: updatedTrip, error } = await supabaseClient
    .from('trips')
    .update(updates)
    .eq('id', tripId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error || !updatedTrip) {
    throw createInternalError(`Failed to update trip: ${error?.message || 'Unknown error'}`)
  }

  const status = deriveTripStatus(updatedTrip.note_body, updatedTrip.plan_json)

  return {
    ...updatedTrip,
    plan_json: updatedTrip.plan_json as PlanJson | null,
    status
  }
}

/**
 * Save plan to trip
 *
 * Updates plan_json and plan_language fields for a trip.
 * Validates:
 * 1. Input data structure (using Zod schema)
 * 2. Trip exists (throws 404 if not found)
 * 3. User owns the trip (throws 403 if ownership mismatch)
 *
 * Security:
 * - Uses Supabase RLS for database-level filtering
 * - Performs explicit ownership check for defense in depth
 * - Validates plan structure to prevent malicious JSON
 *
 * @param tripId - Trip identifier (positive integer)
 * @param userId - Authenticated user ID (UUID)
 * @param planJson - Plan data to save
 * @param planLanguage - Language code (e.g., "en", "pl")
 * @returns Promise<TripDTO> - Updated trip with status = CONFIRMED
 * @throws ApiError - 400 for validation errors, 404 if not found, 403 if unauthorized
 */
export async function savePlanToTrip(
  tripId: number,
  userId: string,
  planJson: PlanJson,
  planLanguage: string
): Promise<TripDTO> {
  // 1. Validate input data
  try {
    validateSavePlanCommand({ plan_json: planJson, plan_language: planLanguage })
  } catch (error) {
    if (error instanceof ZodError) {
      // Convert Zod errors to user-friendly format
      const details: Record<string, string> = {}
      error.issues.forEach((err: any) => {
        const path = err.path.join('.')
        details[path] = err.message
      })
      throw createValidationError('Invalid plan data', details)
    }
    throw error
  }

  // 2. Fetch trip to validate ownership
  const { data: trip, error: fetchError } = await supabaseClient
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single()

  if (fetchError || !trip) {
    throw createNotFoundError()
  }

  // 3. Defense in depth: explicit ownership check
  if (trip.user_id !== userId) {
    throw createForbiddenError()
  }

  // 4. Update plan_json and plan_language
  const { data: updatedTrip, error: updateError } = await supabaseClient
    .from('trips')
    .update({
      plan_json: planJson as any,
      plan_language: planLanguage
    })
    .eq('id', tripId)
    .select()
    .single()

  if (updateError || !updatedTrip) {
    throw createInternalError(`Failed to save plan: ${updateError?.message || 'Unknown error'}`)
  }

  // 5. Derive status (should be CONFIRMED since plan_json is now NOT NULL)
  const status = deriveTripStatus(updatedTrip.note_body, updatedTrip.plan_json)

  // 6. Return typed DTO
  return {
    ...updatedTrip,
    plan_json: updatedTrip.plan_json as PlanJson | null,
    status
  }
}

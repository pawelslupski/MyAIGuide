import { ZodError } from 'zod'
import { supabaseClient } from '@/db/supabase.client'
import type { ProfileDTO } from '@/types'
import { validateProfileDTO } from '@/lib/validation/profile.schemas'
import { createProfileNotFoundError, createInternalError } from '@/lib/errors/api.error'

type ProfileUpdates = Partial<
  Pick<
    ProfileDTO,
    | 'has_kids'
    | 'has_pets'
    | 'has_mobility_issues'
    | 'has_dietary_preferences'
    | 'dietary_preferences_description'
    | 'default_what'
    | 'default_speed'
    | 'default_type'
    | 'default_budget'
  >
>

/**
 * Fetch the authenticated user's profile by their userId.
 *
 * Security:
 * - Filters by user_id at the application level (defence in depth alongside RLS).
 * - RLS policy enforces auth.uid() = user_id at the PostgreSQL level.
 * - Uses the anon key + Supabase session — no service role key required.
 *
 * @param userId - Authenticated user UUID (from Supabase Auth session)
 * @returns Promise<ProfileDTO> - Typed, validated profile data
 * @throws ApiError 404 if profile row not found (edge case; trigger should always create it)
 * @throws ApiError 500 on DB error or response validation failure
 */
export async function getProfile(userId: string): Promise<ProfileDTO> {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    // PGRST116 = PostgREST "no rows returned" from .single()
    if (error.code === 'PGRST116') throw createProfileNotFoundError()
    throw createInternalError(error.message)
  }

  try {
    return validateProfileDTO(data)
  } catch (err) {
    if (err instanceof ZodError) {
      throw createInternalError('Profile data validation failed')
    }
    throw err
  }
}

/**
 * Update the authenticated user's profile fields.
 *
 * @param userId - Authenticated user UUID (from Supabase Auth session)
 * @param updates - Subset of profile fields to update
 * @returns Promise<ProfileDTO> - Typed, validated updated profile
 * @throws ApiError 500 on DB error or response validation failure
 */
export async function updateProfile(userId: string, updates: ProfileUpdates): Promise<ProfileDTO> {
  const { data, error } = await supabaseClient
    .from('profiles')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    throw createInternalError(`Failed to update profile: ${error.message}`)
  }

  try {
    return validateProfileDTO(data)
  } catch (err) {
    if (err instanceof ZodError) {
      throw createInternalError('Profile data validation failed')
    }
    throw err
  }
}

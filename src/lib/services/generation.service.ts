import { supabaseClient } from '@/db/supabase.client'
import type {
  QuotaCheckResult,
  RecordGenerationParams,
  AIServiceResponse,
  AIPlanParams,
  PlanJson,
  PlanGenerationHistoryDTO
} from '@/types'
import { validateAIResponse } from '@/lib/validation/plan.schemas'
import {
  createNotFoundError,
  createForbiddenError,
  createInternalError
} from '@/lib/errors/api.error'

/**
 * Plan Generation Service
 * Handles quota checking, language detection, AI service calls, and generation tracking
 */

const GENERATION_LIMIT = 10
const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Check if user has remaining quota for plan generation.
 *
 * Uses a fixed-batch model:
 * - The user gets GENERATION_LIMIT attempts per 24-hour period.
 * - The 24-hour cooldown starts at the moment the Nth (limit) attempt is made.
 * - After the cooldown expires all GENERATION_LIMIT slots are restored at once.
 */
export async function checkGenerationQuota(userId: string): Promise<QuotaCheckResult> {
  // Fetch all counted rows newest-first; we only need the first LIMIT rows
  const { data, error } = await supabaseClient
    .from('plan_generations')
    .select('created_at')
    .eq('user_id', userId)
    .in('status', ['success', 'api_error'])
    .order('created_at', { ascending: false })
    .limit(GENERATION_LIMIT)

  if (error) {
    throw new Error(`Failed to check generation quota: ${error.message}`)
  }

  const rows = data ?? []
  const now = Date.now()

  // If fewer than LIMIT rows exist there is no cooldown — count all of them
  if (rows.length < GENERATION_LIMIT) {
    return {
      allowed: true,
      used: rows.length,
      limit: GENERATION_LIMIT,
      resetAt: new Date(now + QUOTA_WINDOW_MS).toISOString()
    }
  }

  // The LIMIT-th row (last in DESC list) is the one that filled the quota
  const limitRow = rows[GENERATION_LIMIT - 1]!
  const cooldownEndsAt = new Date(limitRow.created_at).getTime() + QUOTA_WINDOW_MS

  if (now < cooldownEndsAt) {
    // Still in cooldown — fully blocked
    return {
      allowed: false,
      used: GENERATION_LIMIT,
      limit: GENERATION_LIMIT,
      resetAt: new Date(cooldownEndsAt).toISOString()
    }
  }

  // Cooldown has passed — count only rows created after the cooldown ended
  const batchStart = new Date(cooldownEndsAt).toISOString()
  const { data: batchData, error: batchError } = await supabaseClient
    .from('plan_generations')
    .select('created_at')
    .eq('user_id', userId)
    .in('status', ['success', 'api_error'])
    .gte('created_at', batchStart)
    .order('created_at', { ascending: false })
    .limit(GENERATION_LIMIT)

  if (batchError) {
    throw new Error(`Failed to check generation quota: ${batchError.message}`)
  }

  const batchRows = batchData ?? []
  const used = batchRows.length

  return {
    allowed: used < GENERATION_LIMIT,
    used,
    limit: GENERATION_LIMIT,
    resetAt: new Date(now + QUOTA_WINDOW_MS).toISOString()
  }
}

/**
 * Detect language from text
 * Simple implementation - can be enhanced with franc-min library
 * Limits input to first 1000 characters for performance
 */
export function detectLanguage(text: string): string {
  // Limit to first 1000 characters for performance
  const sample = text.slice(0, 1000).toLowerCase()

  // Simple heuristic: check for Polish characters
  const polishChars = /[ąćęłńóśźż]/
  if (polishChars.test(sample)) {
    return 'pl'
  }

  // Default to English
  return 'en'
}

/**
 * Build AI prompt from trip data
 * Combines note body, user profile flags, and trip preferences
 * Includes instructions for logical ordering and exhaustive descriptions
 */
export function buildAIPrompt(
  noteBody: string,
  userProfile: any,
  tripPreferences: any,
  destination?: string
): string {
  const profileFlags = []
  if (userProfile.hasKids) profileFlags.push('traveling with kids')
  if (userProfile.hasPets) profileFlags.push('traveling with pets')
  if (userProfile.hasMobilityIssues) profileFlags.push('has mobility issues')
  if (userProfile.hasDietaryPreferences) profileFlags.push('has dietary preferences')

  const whatCategories = tripPreferences.what?.length > 0 ? tripPreferences.what : null

  const prompt = `
Generate a travel plan based on the following information:

Destination: ${destination ?? 'not specified'}

Trip Notes:
${noteBody.trim() || 'No notes provided — use the preferences below as the primary source of guidance.'}

Traveler Profile:
${profileFlags.length > 0 ? profileFlags.join(', ') : 'No special requirements'}

Preferences:
- Duration: ${tripPreferences.num_days ?? 3} days
- Group size: ${tripPreferences.num_people ?? 1} people
- Speed: ${tripPreferences.speed || 'not specified'}
- Type: ${tripPreferences.type || 'not specified'}
- Budget: ${tripPreferences.budget || 'not specified'}
${
  whatCategories
    ? `
ACTIVITY CATEGORY CONSTRAINT — NON-NEGOTIABLE HARD REQUIREMENT:
The user has explicitly chosen these activity types: [${whatCategories.join(', ')}]
AT LEAST 90% of ALL activities in the plan MUST have a categoryTag set to one of these values.
Build the ENTIRE itinerary around these categories — they are the core purpose of this trip.
Only add activities from other categories when absolutely unavoidable (e.g., airport transfer).
Before finalising, count total activities and confirm ≥90% match. If not, replace activities.
`
    : '- Activities: not specified'
}
CRITICAL REQUIREMENTS:
1. Generate EXACTLY ${tripPreferences.num_days ?? 3} day entries — no more, no fewer
2. Order all activities within each day by geographic proximity to create efficient routes
3. Minimize travel time and distance between consecutive activities
4. Avoid zigzagging between distant locations - group nearby places together
5. Provide exhaustive, detailed descriptions for each activity (2-3 sentences minimum)
6. Include specific details about what to see, do, and why it's worth visiting
${whatCategories ? `7. HARD CATEGORY RULE: Count all activities. At least 90% MUST use categoryTag from [${whatCategories.join(', ')}]. Verify before responding.` : ''}
IMPORTANT: Return ONLY the exact JSON structure with these fields:
- Root: { "days": [...] }
- Day: { "day": number, "activities": [...] }
- Activity: { "timeOfDay": string, "locationName": string, "description": string, "categoryTag": string }

DO NOT include any other fields like: trip_id, destination, duration_days, name, duration_hours, cost_category, category (array), etc.
`.trim()

  return prompt
}

/**
 * Validate AI response structure
 * Throws error if validation fails
 */
export function validatePlanResponse(response: unknown): PlanJson {
  const validated = validateAIResponse(response)
  return validated.plan
}

/**
 * Record generation attempt in database
 * Logs success, api_error, or validation_error status
 */
export async function recordGenerationAttempt(params: RecordGenerationParams): Promise<void> {
  const { error } = await supabaseClient.from('plan_generations').insert({
    user_id: params.userId,
    trip_id: params.tripId,
    status: params.status,
    model_name: params.modelName || null,
    error_message: params.errorMessage || null
  })

  if (error) {
    // Log error but don't throw - recording is not critical
    console.error('Failed to record generation attempt:', error)
  }
}

/**
 * Call AI service via Supabase Edge Function (OpenRouter API)
 */
export async function callAIService(params: AIPlanParams): Promise<AIServiceResponse> {
  console.log('[callAIService] Calling OpenRouter API via Edge Function')

  const prompt = buildAIPrompt(
    params.noteBody,
    params.userProfile,
    params.tripPreferences,
    params.destination
  )

  const { data, error } = await supabaseClient.functions.invoke('generate-plan', {
    body: {
      prompt,
      language: params.language,
      tripId: params.tripId,
      numDays: params.tripPreferences.num_days ?? 7
    },
    signal: params.signal
  })

  if (error) {
    console.error('[callAIService] Edge Function error:', error)
    throw new Error(`AI service error: ${error.message}`)
  }

  console.log('[callAIService] Successfully received response from Edge Function')
  return { plan: data?.plan, model_used: data?.model_used }
}

/**
 * Retrieve generation attempt history for a trip in reverse-chronological order.
 *
 * Two-step approach:
 *  1. Ownership check — ensures the trip exists and belongs to the given user
 *     (clear 404 vs 403 distinction per api-plan.md §2.6).
 *  2. Fetch plan_generations — `user_id` excluded from selected columns per §2.6;
 *     `.eq('user_id', userId)` added as defense-in-depth alongside RLS.
 *
 * @param tripId - Trip identifier (positive integer)
 * @param userId - Authenticated user ID (UUID) — used for ownership validation
 * @param limit  - Max records to return (1–50, default 10)
 * @returns PlanGenerationHistoryDTO
 * @throws ApiError 404 if trip not found, 403 if not owned by user, 500 on DB error
 */
export async function getTripGenerations(
  tripId: number,
  userId: string,
  limit = 10
): Promise<PlanGenerationHistoryDTO> {
  // Step 1 — Ownership check
  const { data: trip, error: tripError } = await supabaseClient
    .from('trips')
    .select('id, user_id')
    .eq('id', tripId)
    .single()

  if (tripError || !trip) throw createNotFoundError()
  if (trip.user_id !== userId) throw createForbiddenError()

  // Step 2 — Fetch generation history (exclude user_id per api-plan.md §2.6)
  const { data, error } = await supabaseClient
    .from('plan_generations')
    .select('id, trip_id, status, model_name, error_message, created_at')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50))

  if (error) throw createInternalError(`Failed to fetch generations: ${error.message}`)

  return { generations: (data ?? []) as PlanGenerationHistoryDTO['generations'] }
}

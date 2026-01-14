import { supabaseClient } from '@/db/supabase.client'
import type {
  QuotaCheckResult,
  RecordGenerationParams,
  AIServiceResponse,
  MockPlanParams,
  PlanJson
} from '@/types'
import { validateAIResponse } from '@/lib/validation/plan.schemas'
import { generateMockPlan } from './mock-ai.service'

/**
 * Plan Generation Service
 * Handles quota checking, language detection, AI service calls, and generation tracking
 */

const GENERATION_LIMIT = 10
const QUOTA_WINDOW_HOURS = 24

/**
 * Check if user has remaining quota for plan generation
 * Returns quota status with used count, limit, and reset timestamp
 */
export async function checkGenerationQuota(userId: string): Promise<QuotaCheckResult> {
  // Query plan_generations table for user's recent generations
  const { data, error } = await supabaseClient
    .from('plan_generations')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - QUOTA_WINDOW_HOURS * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to check generation quota: ${error.message}`)
  }

  const used = data?.length || 0
  const allowed = used < GENERATION_LIMIT

  // Calculate reset_at: 24 hours from oldest generation, or now if no generations
  let resetAt: string
  if (data && data.length > 0 && data[0]) {
    const oldestGeneration = new Date(data[0].created_at)
    resetAt = new Date(
      oldestGeneration.getTime() + QUOTA_WINDOW_HOURS * 60 * 60 * 1000
    ).toISOString()
  } else {
    resetAt = new Date(Date.now() + QUOTA_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
  }

  return {
    allowed,
    used,
    limit: GENERATION_LIMIT,
    resetAt
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
 * Prepared for Phase 2 - currently not used by mock service
 */
export function buildAIPrompt(noteBody: string, userProfile: any, tripPreferences: any): string {
  const profileFlags = []
  if (userProfile.hasKids) profileFlags.push('traveling with kids')
  if (userProfile.hasPets) profileFlags.push('traveling with pets')
  if (userProfile.hasMobilityIssues) profileFlags.push('has mobility issues')
  if (userProfile.hasDietaryPreferences) profileFlags.push('has dietary preferences')

  const prompt = `
Generate a travel plan based on the following information:

Trip Notes:
${noteBody}

Traveler Profile:
${profileFlags.length > 0 ? profileFlags.join(', ') : 'No special requirements'}

Preferences:
- Activities: ${tripPreferences.what.join(', ') || 'not specified'}
- Speed: ${tripPreferences.speed || 'not specified'}
- Type: ${tripPreferences.type || 'not specified'}
- Budget: ${tripPreferences.budget || 'not specified'}

Please generate a detailed day-by-day travel plan in JSON format.
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
 * Call AI service (mock or real based on environment)
 * Phase 1: Uses mock AI service
 * Phase 2: Will call Supabase Edge Function
 */
export async function callAIService(params: MockPlanParams): Promise<AIServiceResponse> {
  // Phase 1: Use mock AI service
  const useMock = import.meta.env.VITE_USE_MOCK_AI !== 'false' // Default to true

  if (useMock) {
    return await generateMockPlan(params)
  }

  // Phase 2: Call Supabase Edge Function (to be implemented)
  throw new Error('Real AI service not yet implemented')
}

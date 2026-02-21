import { supabaseClient } from '@/db/supabase.client'
import type {
  QuotaCheckResult,
  RecordGenerationParams,
  AIServiceResponse,
  AIPlanParams,
  PlanJson
} from '@/types'
import { validateAIResponse } from '@/lib/validation/plan.schemas'

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
 * Includes instructions for logical ordering and exhaustive descriptions
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
${noteBody.trim() || 'No notes provided — use the preferences below as the primary source of guidance.'}

Traveler Profile:
${profileFlags.length > 0 ? profileFlags.join(', ') : 'No special requirements'}

Preferences:
- Duration: ${tripPreferences.num_days ? `${tripPreferences.num_days} days` : 'not specified'}
- Group size: ${tripPreferences.num_people ? `${tripPreferences.num_people} people` : 'not specified'}
- Activities: ${tripPreferences.what.join(', ') || 'not specified'}
- Speed: ${tripPreferences.speed || 'not specified'}
- Type: ${tripPreferences.type || 'not specified'}
- Budget: ${tripPreferences.budget || 'not specified'}

CRITICAL REQUIREMENTS:
1. Generate EXACTLY ${tripPreferences.num_days} day entries if duration is specified — no more, no fewer
2. Order all activities within each day by geographic proximity to create efficient routes
3. Minimize travel time and distance between consecutive activities
4. Avoid zigzagging between distant locations - group nearby places together
5. Provide exhaustive, detailed descriptions for each activity (2-3 sentences minimum)
6. Include specific details about what to see, do, and why it's worth visiting

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

  const prompt = buildAIPrompt(params.noteBody, params.userProfile, params.tripPreferences)

  const { data, error } = await supabaseClient.functions.invoke('generate-plan', {
    body: { prompt, language: params.language }
  })

  if (error) {
    console.error('[callAIService] Edge Function error:', error)
    throw new Error(`AI service error: ${error.message}`)
  }

  if (!data?.plan) {
    throw new Error('Invalid response from AI service: missing plan data')
  }

  console.log('[callAIService] Successfully generated plan')
  return { plan: data.plan, model_used: data.model_used }
}

// Supabase Edge Function: Generate Travel Plan
// Calls OpenRouter.ai API to generate structured travel plans
//
// Route: POST /functions/v1/generate-plan
// Headers: Authorization: Bearer <supabase_session_token>
// Body: { "prompt": string, "language": string, "tripId": number }
//
// Response: { "plan": PlanJson, "model_used": string }
//
// Enforces per-user quota (10 generations / 24 h) and records every
// attempt in plan_generations — no client-side bypass possible.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type {
  ValidatedInput,
  PlanJson,
  OpenRouterRequest,
  OpenRouterResponse,
  ParsedResponse
} from './openrouter.types.ts'
import { isFeatureEnabled } from '../../../src/lib/features/flags.ts'

// ============================================================================
// CONSTANTS AND CONFIGURATION
// ============================================================================

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'anthropic/claude-haiku-4-5'
// Supabase Edge Function infrastructure hard limit is ~150s.
// Haiku is fast enough to handle 14-day plans within this limit.
const REQUEST_TIMEOUT_MS = 145_000
const DEFAULT_TEMPERATURE = 0.7
const MIN_MAX_TOKENS = 4000
const MAX_MAX_TOKENS = 16000
// ~1100 tokens/day: 3 activities × ~350 tokens each (4-5 sentence descriptions + fields)
const TOKENS_PER_DAY = 1100
const BASE_TOKENS = 2000

// CORS headers for frontend communication
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

// ============================================================================
// MAIN REQUEST HANDLER
// ============================================================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Feature flag check — reject all requests when plan-generation is disabled
  if (!isFeatureEnabled('plan-generation')) {
    return createErrorResponse(503, 'SERVICE_UNAVAILABLE', 'Plan generation is disabled in this environment')
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return createErrorResponse(405, 'METHOD_NOT_ALLOWED', 'Only POST method is allowed')
  }

  try {
    // 1. Authenticate user — reject unauthenticated requests immediately
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'Authentication required')
    }

    // 2. Parse request body — must come before quota reservation so we have tripId
    let body: any
    try {
      body = await req.json()
    } catch (error) {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Invalid JSON in request body')
    }

    // 3. Validate tripId
    const tripId = body?.tripId
    if (!tripId || typeof tripId !== 'number' || !Number.isInteger(tripId) || tripId <= 0) {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Field "tripId" is required and must be a positive integer')
    }

    // 4. Validate prompt + language
    let validatedInput: ValidatedInput
    try {
      validatedInput = validateInput(body)
    } catch (error) {
      if (error instanceof Error) {
        return createErrorResponse(400, 'VALIDATION_ERROR', error.message)
      }
      throw error
    }

    const { prompt, language } = validatedInput

    // Extract numDays for dynamic token scaling (defaults to 7 if not provided)
    const numDays = typeof body?.numDays === 'number' && body.numDays >= 1
      ? Math.min(Math.floor(body.numDays), 30)
      : 7

    // 5. Atomically reserve a quota slot.
    //    try_reserve_generation_slot acquires a per-user advisory lock, replicates
    //    the fixed-batch quota logic (including non-stale 'pending' records), and
    //    inserts a 'pending' row if the user is within their limit.
    //    This eliminates the TOCTOU race that existed when check and insert were
    //    two separate, uncoordinated statements.
    const { data: reservationId, error: reservationError } = await supabase
      .rpc('try_reserve_generation_slot', { p_trip_id: tripId })

    if (reservationError) {
      if (reservationError.message === 'QUOTA_EXCEEDED' || reservationError.code === 'P0429') {
        return createErrorResponse(429, 'QUOTA_EXCEEDED', 'Generation quota exceeded. Try again in 24 hours.')
      }
      console.error('[ERROR] Quota reservation failed:', reservationError.message)
      return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to reserve generation quota slot')
    }

    const computedMaxTokens = Math.min(MAX_MAX_TOKENS, Math.max(MIN_MAX_TOKENS, numDays * TOKENS_PER_DAY + BASE_TOKENS))
    console.log(`[INFO] Generating plan - Language: ${language}, Model: ${DEFAULT_MODEL}, Days: ${numDays}, MaxTokens: ${computedMaxTokens}`)

    // 6. Build OpenRouter request
    const openRouterRequest = buildOpenRouterRequest(prompt, language, numDays, computedMaxTokens, DEFAULT_MODEL)

    // 7. Call OpenRouter API
    let openRouterResponse: OpenRouterResponse
    try {
      openRouterResponse = await callOpenRouterAPI(openRouterRequest)
    } catch (error) {
      // Finalize the reserved slot as api_error before returning
      await supabase.rpc('finalize_generation_slot', {
        p_reservation_id: reservationId,
        p_status: 'api_error',
        p_error_message: error instanceof Error ? error.message : 'Unknown error'
      })

      if (error instanceof Error) {
        if (error.message.startsWith('AUTHENTICATION_ERROR:')) {
          return createErrorResponse(401, 'AUTHENTICATION_ERROR', 'OpenRouter API authentication failed. Please check API key configuration.')
        }
        if (error.message.startsWith('INSUFFICIENT_CREDITS:')) {
          return createErrorResponse(402, 'INSUFFICIENT_CREDITS', 'AI service has insufficient credits. Please try again later.')
        }
        if (error.message.startsWith('RATE_LIMIT_ERROR:')) {
          const retryMatch = error.message.match(/Retry after (\d+)s/)
          const retryAfter = retryMatch ? parseInt(retryMatch[1]) : 60
          return createErrorResponse(429, 'RATE_LIMIT_ERROR', 'AI service rate limit exceeded. Please try again later.', { retry_after: retryAfter })
        }
        if (error.message.startsWith('TIMEOUT_ERROR:')) {
          return createErrorResponse(504, 'TIMEOUT_ERROR', 'Request timeout. For very long trips, try reducing the number of days or simplifying your notes.', { timeout_ms: REQUEST_TIMEOUT_MS })
        }
        if (error.message.startsWith('SERVICE_UNAVAILABLE:')) {
          return createErrorResponse(503, 'SERVICE_UNAVAILABLE', 'AI service is temporarily unavailable. Please try again later.')
        }
      }
      throw error
    }

    // 8. Parse response
    let parsedResponse: ParsedResponse
    try {
      parsedResponse = parseOpenRouterResponse(openRouterResponse)
    } catch (error) {
      // Finalize the reserved slot as api_error before returning
      await supabase.rpc('finalize_generation_slot', {
        p_reservation_id: reservationId,
        p_status: 'api_error',
        p_error_message: error instanceof Error ? error.message : 'Invalid response from AI'
      })

      if (error instanceof Error && error.message.startsWith('AI_API_ERROR:')) {
        const errorMessage = error.message.replace('AI_API_ERROR: ', '')
        return createErrorResponse(502, 'AI_API_ERROR', 'Failed to generate valid plan. Please try again.', { reason: errorMessage })
      }
      throw error
    }

    // 9. Finalize the reserved slot as success
    console.log(`[INFO] Plan generated successfully - Model: ${parsedResponse.model_used}`)
    const { error: finalizeError } = await supabase.rpc('finalize_generation_slot', {
      p_reservation_id: reservationId,
      p_status: 'success',
      p_model_name: parsedResponse.model_used
    })
    if (finalizeError) {
      console.error('[ERROR] Failed to finalize generation slot:', finalizeError.message)
    }

    // 10. Return success response
    return new Response(JSON.stringify(parsedResponse), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[ERROR] Unexpected error:', error)
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred')
  }
})

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build OpenRouter API request with structured output configuration
 * @param prompt - User's travel notes combined with preferences
 * @param language - Detected language for response generation
 */
const LOCALE_TO_LANGUAGE: Record<string, string> = {
  en: 'English',
  pl: 'Polish'
}

function buildOpenRouterRequest(prompt: string, language: string, numDays: number, maxTokens: number, model: string): OpenRouterRequest {
  const languageName = LOCALE_TO_LANGUAGE[language] ?? language

  const systemMessage = {
    role: 'system' as const,
    content: `You are an expert travel planner. Generate detailed, personalized travel plans based on user preferences and notes.
    When the user specifies an ACTIVITY CATEGORY CONSTRAINT, that constraint is a NON-NEGOTIABLE hard requirement: AT LEAST 90% of all activities in the plan MUST use one of the specified categoryTag values. Before finalising your response, count the total number of activities and verify that ≥90% use the required categories. If not, replace activities until the requirement is met.

    CRITICAL: You MUST return ONLY the exact JSON structure shown below. DO NOT add any extra fields.

    REQUIRED JSON STRUCTURE (respond in ${languageName} language):
    {
      "days": [
        {
          "day": 1,
          "activities": [
            {
              "timeOfDay": "morning",
              "locationName": "Name of the place",
              "description": "Rich 4-5 sentence description...",
              "categoryTag": "nature"
            }
          ]
        }
      ]
    }

    STRICT RULES:
    1. Root object MUST have ONLY "days" field - NO other fields (no trip_id, destination, duration_days, etc.)
    2. Each day object MUST have ONLY "day" and "activities" fields - NO other fields (no destination, etc.)
    3. Each activity MUST have ONLY these 4 fields: "timeOfDay", "locationName", "description", "categoryTag"
    4. DO NOT add: name, duration_hours, cost_category, category (array), or ANY other fields
    5. Each day MUST have AT LEAST 3 activities — never fewer
    6. Activities MUST be ordered by geographic proximity to minimize travel time
    7. Each description MUST be 4-5 detailed sentences: what makes the place special, what to see and do there, any unique highlights, and one practical visitor tip
    8. categoryTag MUST be one of: nature, culture_museums, beach_relax, city_break, foodie
    9. timeOfDay MUST be one of: morning, afternoon, evening
    10. LANGUAGE: ALL text values in "locationName" and "description" fields MUST be written in ${languageName}. This is mandatory — do not use any other language.

    FORBIDDEN: Do not add any fields beyond those specified above. The response will be rejected if extra fields are present.`
  }

  const userMessage = {
    role: 'user' as const,
    content: prompt
  }

  const responseFormat = {
    type: 'json_schema' as const,
    json_schema: {
      name: 'travel_plan',
      strict: true,
      schema: buildPlanJsonSchema()
    }
  }

  return {
    model,
    messages: [systemMessage, userMessage],
    response_format: responseFormat,
    temperature: DEFAULT_TEMPERATURE,
    max_tokens: maxTokens,
    top_p: 0.9
  }
}

/**
 * Build JSON schema for structured plan output
 * Matches PlanJson type definition; additionalProperties: false enforced at every level
 */
function buildPlanJsonSchema(): object {
  return {
    type: 'object',
    properties: {
      days: {
        type: 'array',
        description: 'Array of days in the travel plan',
        items: {
          type: 'object',
          properties: {
            day: {
              type: 'number',
              description: 'Day number (1, 2, 3, etc.)'
            },
            activities: {
              type: 'array',
              description: 'Activities for this day, ordered logically by location to minimize travel time',
              items: {
                type: 'object',
                properties: {
                  timeOfDay: {
                    type: 'string',
                    description: 'Time of day (e.g., "morning", "afternoon", "evening")'
                  },
                  locationName: {
                    type: 'string',
                    description: 'Name of the location or venue'
                  },
                  description: {
                    type: 'string',
                    description: 'Exhaustive, detailed description of the activity including what to see, do, and experience'
                  },
                  categoryTag: {
                    type: 'string',
                    enum: ['nature', 'culture_museums', 'beach_relax', 'city_break', 'foodie'],
                    description: 'Category tag for the activity'
                  }
                },
                required: ['timeOfDay', 'locationName', 'description', 'categoryTag'],
                additionalProperties: false
              },
              minItems: 1
            }
          },
          required: ['day', 'activities'],
          additionalProperties: false
        },
        minItems: 1
      }
    },
    required: ['days'],
    additionalProperties: false
  }
}

/**
 * Call OpenRouter API with timeout and error handling
 * @param requestBody - OpenRouter API request object
 * @returns OpenRouter API response
 * @throws Error with specific error type prefix
 */
async function callOpenRouterAPI(requestBody: OpenRouterRequest): Promise<OpenRouterResponse> {
  // Get API key from environment (injected via --env-file flag when serving locally)
  const apiKey = Deno.env.get('OPENROUTER_API_KEY')
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set')
  }

  // Create abort controller for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
    console.warn(`[WARN] Request timeout after ${REQUEST_TIMEOUT_MS}ms`)
  }, REQUEST_TIMEOUT_MS)

  try {
    console.log('[INFO] Calling OpenRouter API...')
    const startTime = Date.now()

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://myaiguide.app',
        'X-Title': 'MyAIGuide'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })

    clearTimeout(timeoutId)
    const duration = Date.now() - startTime
    console.log(`[INFO] OpenRouter API responded in ${duration}ms with status ${response.status}`)

    // Handle non-OK responses
    if (!response.ok) {
      const errorText = await response.text()

      // Handle specific status codes
      if (response.status === 401) {
        throw new Error('AUTHENTICATION_ERROR: Invalid API key')
      }
      if (response.status === 402) {
        throw new Error('INSUFFICIENT_CREDITS: OpenRouter account has insufficient credits')
      }
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '60'
        throw new Error(`RATE_LIMIT_ERROR: Retry after ${retryAfter}s`)
      }
      if (response.status >= 500) {
        throw new Error(`SERVICE_UNAVAILABLE: OpenRouter server error (${response.status})`)
      }

      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`)
    }

    // Parse and return JSON
    const data = await response.json()
    return data as OpenRouterResponse

  } catch (error) {
    clearTimeout(timeoutId)

    // Handle timeout
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`TIMEOUT_ERROR: Request exceeded ${REQUEST_TIMEOUT_MS / 1000} second timeout`)
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('SERVICE_UNAVAILABLE: Network error connecting to OpenRouter')
    }

    // Re-throw other errors
    throw error
  }
}

/**
 * Parse and validate OpenRouter API response
 * @param response - Raw OpenRouter API response
 * @returns Parsed plan and model information
 * @throws Error with AI_API_ERROR prefix for invalid responses
 */
function parseOpenRouterResponse(response: OpenRouterResponse): ParsedResponse {
  if (!response?.choices?.length) {
    throw new Error('AI_API_ERROR: Invalid response from OpenRouter - missing or empty choices array')
  }

  const content = response.choices[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error('AI_API_ERROR: Invalid response from OpenRouter - missing message content')
  }

  let planData: any
  try {
    planData = JSON.parse(content)
  } catch (_e) {
    console.error('[ERROR] Raw content:', content)
    if (content.length > 0 && !content.trim().endsWith('}')) {
      throw new Error('AI_API_ERROR: Response was truncated. The plan is too long. Try reducing the trip duration or simplifying your notes.')
    }
    throw new Error('AI_API_ERROR: Invalid JSON in response. Please try again.')
  }

  if (!Array.isArray(planData?.days) || planData.days.length === 0) {
    throw new Error('AI_API_ERROR: Response missing required "days" array')
  }

  for (let i = 0; i < planData.days.length; i++) {
    const day = planData.days[i]

    if (typeof day.day !== 'number') {
      throw new Error(`AI_API_ERROR: Day ${i + 1} missing "day" number`)
    }
    if (!Array.isArray(day.activities) || day.activities.length === 0) {
      throw new Error(`AI_API_ERROR: Day ${day.day} missing "activities" array`)
    }

    for (let j = 0; j < day.activities.length; j++) {
      const act = day.activities[j]

      if (!act.locationName || typeof act.locationName !== 'string') {
        throw new Error(`AI_API_ERROR: Day ${day.day}, activity ${j + 1} missing "locationName"`)
      }
      if (!act.description || typeof act.description !== 'string') {
        throw new Error(`AI_API_ERROR: Day ${day.day}, activity ${j + 1} missing "description"`)
      }
      if (!act.categoryTag || typeof act.categoryTag !== 'string') {
        throw new Error(`AI_API_ERROR: Day ${day.day}, activity ${j + 1} missing "categoryTag"`)
      }

      // Strict cleanup — keep only the four schema fields
      day.activities[j] = {
        timeOfDay: act.timeOfDay ?? 'morning',
        locationName: act.locationName,
        description: act.description,
        categoryTag: act.categoryTag
      }
    }

    // Strict cleanup — keep only day-level schema fields
    planData.days[i] = { day: day.day, activities: day.activities }
  }

  if (response.usage) {
    const { prompt_tokens, completion_tokens, total_tokens } = response.usage
    console.log(`[INFO] Token usage - Prompt: ${prompt_tokens}, Completion: ${completion_tokens}, Total: ${total_tokens}`)
  }

  return {
    plan: { days: planData.days } as PlanJson,
    model_used: response.model || 'unknown'
  }
}

/**
 * Validate and type-check incoming request data
 * @throws Error with specific validation message
 */
function validateInput(body: unknown): ValidatedInput {
  // Check body is object
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a JSON object')
  }

  const { prompt, language } = body as any

  // Validate prompt
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Field "prompt" is required and must be a string')
  }
  if (prompt.trim().length < 50) {
    throw new Error('Field "prompt" must be at least 50 characters')
  }
  if (prompt.length > 15000) {
    throw new Error('Field "prompt" must not exceed 15000 characters')
  }

  // Validate language
  if (!language || typeof language !== 'string') {
    throw new Error('Field "language" is required and must be a string')
  }
  if (!/^[a-z]{2,10}$/i.test(language)) {
    throw new Error('Field "language" must be a valid language code (e.g., "en", "pl")')
  }

  return { prompt: prompt.trim(), language: language.toLowerCase() }
}

/**
 * Create standardized error response with CORS headers
 */
function createErrorResponse(
  statusCode: number,
  code: string,
  message: string,
  details?: object
): Response {
  const errorBody = {
    error: {
      code,
      message,
      ...(details && { details })
    }
  }

  return new Response(JSON.stringify(errorBody), {
    status: statusCode,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  })
}


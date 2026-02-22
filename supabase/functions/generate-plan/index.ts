// Supabase Edge Function: Generate Travel Plan
// Calls OpenRouter.ai API to generate structured travel plans
//
// Route: POST /functions/v1/generate-travel-plan
// Body: { "prompt": string, "language": string }
//
// Response: { "plan": PlanJson, "model_used": string }
//
// This Edge Function keeps API keys secure on the server side
// and provides structured outputs using JSON schema

import type {
  ValidatedInput,
  PlanJson,
  OpenRouterRequest,
  OpenRouterResponse,
  ParsedResponse
} from './openrouter.types.ts'

// ============================================================================
// CONSTANTS AND CONFIGURATION
// ============================================================================

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-6'
const REQUEST_TIMEOUT_MS = 60000 // 60 seconds
const DEFAULT_TEMPERATURE = 0.7
const DEFAULT_MAX_TOKENS = 8000 // Increased for longer plans and non-English languages

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

  // Only allow POST
  if (req.method !== 'POST') {
    return createErrorResponse(405, 'METHOD_NOT_ALLOWED', 'Only POST method is allowed')
  }

  try {
    // 1. Parse request body
    let body: any
    try {
      body = await req.json()
    } catch (error) {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Invalid JSON in request body')
    }

    // 2. Validate input
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

    console.log(`[INFO] Generating plan - Language: ${language}, Model: ${DEFAULT_MODEL}`)

    // 3. Build OpenRouter request
    const openRouterRequest = buildOpenRouterRequest(prompt, language)

    // 4. Call OpenRouter API
    let openRouterResponse: OpenRouterResponse
    try {
      openRouterResponse = await callOpenRouterAPI(openRouterRequest)
    } catch (error) {
      if (error instanceof Error) {
        // Parse error type from message
        if (error.message.startsWith('AUTHENTICATION_ERROR:')) {
          return createErrorResponse(
            401,
            'AUTHENTICATION_ERROR',
            'OpenRouter API authentication failed. Please check API key configuration.'
          )
        }
        if (error.message.startsWith('RATE_LIMIT_ERROR:')) {
          const retryMatch = error.message.match(/Retry after (\d+)s/)
          const retryAfter = retryMatch ? parseInt(retryMatch[1]) : 60
          return createErrorResponse(
            429,
            'RATE_LIMIT_ERROR',
            'AI service rate limit exceeded. Please try again later.',
            { retry_after: retryAfter }
          )
        }
        if (error.message.startsWith('TIMEOUT_ERROR:')) {
          return createErrorResponse(
            504,
            'TIMEOUT_ERROR',
            'Request timeout. Please try again with a simpler prompt.',
            { timeout_ms: REQUEST_TIMEOUT_MS }
          )
        }
        if (error.message.startsWith('SERVICE_UNAVAILABLE:')) {
          return createErrorResponse(
            503,
            'SERVICE_UNAVAILABLE',
            'AI service is temporarily unavailable. Please try again later.'
          )
        }
      }
      throw error
    }

    // 5. Parse response
    let parsedResponse: ParsedResponse
    try {
      parsedResponse = parseOpenRouterResponse(openRouterResponse)
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('AI_API_ERROR:')) {
        const errorMessage = error.message.replace('AI_API_ERROR: ', '')
        return createErrorResponse(
          500,
          'AI_API_ERROR',
          'Failed to generate valid plan. Please try again.',
          { reason: errorMessage }
        )
      }
      throw error
    }

    // 6. Return success response
    console.log(`[INFO] Plan generated successfully - Model: ${parsedResponse.model_used}`)
    return new Response(JSON.stringify(parsedResponse), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })

  } catch (error) {
    // Catch-all for unexpected errors
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
function buildOpenRouterRequest(prompt: string, language: string): OpenRouterRequest {
  // System message - sets AI role and language
  const systemMessage = {
    role: 'system' as const,
    content: `You are an expert travel planner. Generate detailed, personalized travel plans based on user preferences and notes.
    When the user specifies an ACTIVITY CATEGORY CONSTRAINT, that constraint is a NON-NEGOTIABLE hard requirement: AT LEAST 90% of all activities in the plan MUST use one of the specified categoryTag values. Before finalising your response, count the total number of activities and verify that ≥90% use the required categories. If not, replace activities until the requirement is met.

    CRITICAL: You MUST return ONLY the exact JSON structure shown below. DO NOT add any extra fields.

    REQUIRED JSON STRUCTURE (respond in ${language} language):
    {
      "days": [
        {
          "day": 1,
          "activities": [
            {
              "timeOfDay": "morning",
              "locationName": "Name of the place",
              "description": "Exhaustive 2-3 sentence description...",
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
    5. Activities MUST be ordered by geographic proximity to minimize travel time
    6. Each description MUST be 2-3 detailed sentences including what makes it special, what to see/do, and practical tips
    7. categoryTag MUST be one of: nature, culture_museums, beach_relax, city_break, foodie
    8. timeOfDay MUST be one of: morning, afternoon, evening

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
    model: DEFAULT_MODEL,
    messages: [systemMessage, userMessage],
    response_format: responseFormat,
    temperature: DEFAULT_TEMPERATURE,
    max_tokens: DEFAULT_MAX_TOKENS,
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
      throw new Error('TIMEOUT_ERROR: Request exceeded 60 second timeout')
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


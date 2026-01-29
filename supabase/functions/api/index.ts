// Supabase Edge Function: API Router (MOCK MODE)
// Returns hardcoded mock data - no database, no AI calls
//
// Routes:
// - POST /api/generations - Generate AI plan (mock)
// - GET /api/trips/:id - Get trip by ID (mock)
//
// MOCK MODE: Always returns the same hardcoded data
//
// Usage:
// POST http://localhost:54321/functions/v1/api/generations
// Body: { "tripId": 1, "userId": "00000000-0000-0000-0000-000000000001" }
//
// GET http://localhost:54321/functions/v1/api/trips/1
//
// NOTE: For real database access, use Supabase client directly from frontend
// See: src/lib/services/trip.service.ts

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

// MOCK MODE - always enabled for this Edge Function
const MOCK_MODE = true

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname

    console.log(`[API] ${req.method} ${path}`)

    // Route: POST /api/generations
    if (path.endsWith('/generations') && req.method === 'POST') {
      return await handleGenerations(req)
    }

    // Route: GET /api/trips/:id
    if (path.match(/\/trips\/\d+$/) && req.method === 'GET') {
      return await handleGetTrip(req, path)
    }

    return new Response(
      JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[API] Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleGenerations(req: Request) {
  let body
  try {
    body = await req.json()
  } catch (error) {
    return createErrorResponse(400, 'VALIDATION_ERROR', 'Invalid JSON in request body')
  }

  const { tripId, userId } = body

  // Validation
  if (!tripId || typeof tripId !== 'number') {
    return createErrorResponse(400, 'VALIDATION_ERROR', 'tripId is required and must be a number')
  }

  if (!userId || typeof userId !== 'string') {
    return createErrorResponse(400, 'VALIDATION_ERROR', 'userId is required and must be a string')
  }

  console.log(`[API] Generating plan for tripId=${tripId}, userId=${userId}`)

  // MOCK MODE: Return hardcoded mock data without database calls
  console.log('[API] MOCK MODE - returning hardcoded data')

  // Simulate API delay (1-3 seconds)
  await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000))

  const mockPlan = getMockTemplate('nature')
  const language = 'en'
  const modelUsed = 'mock-ai-v1'

  return new Response(
    JSON.stringify({
      plan: mockPlan,
      language,
      model_used: modelUsed,
      generated_at: new Date().toISOString()
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

function createErrorResponse(status: number, code: string, message: string, details?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      error: {
        code,
        message,
        ...(details && { details })
      }
    }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

function getMockTemplate(preference: string) {
  const templates: Record<string, any> = {
    nature: {
      days: [
        {
          day: 1,
          activities: [
            {
              timeOfDay: 'morning',
              locationName: 'Mountain Trail',
              description: 'Scenic hiking trail with panoramic views',
              categoryTag: 'nature'
            },
            {
              timeOfDay: 'afternoon',
              locationName: 'Forest Reserve',
              description: 'Explore ancient forest paths and wildlife',
              categoryTag: 'nature'
            }
          ]
        }
      ]
    },
    city_break: {
      days: [
        {
          day: 1,
          activities: [
            {
              timeOfDay: 'morning',
              locationName: 'Historic District',
              description: 'Walk through charming old town streets',
              categoryTag: 'culture'
            },
            {
              timeOfDay: 'afternoon',
              locationName: 'Art Museum',
              description: 'Explore contemporary and classical art collections',
              categoryTag: 'culture'
            }
          ]
        }
      ]
    },
    culture_museums: {
      days: [
        {
          day: 1,
          activities: [
            {
              timeOfDay: 'morning',
              locationName: 'Cultural Center',
              description: 'Visit exhibitions and cultural events',
              categoryTag: 'culture'
            },
            {
              timeOfDay: 'afternoon',
              locationName: 'Traditional Market',
              description: 'Experience local crafts and traditions',
              categoryTag: 'culture'
            }
          ]
        }
      ]
    },
    beach_relax: {
      days: [
        {
          day: 1,
          activities: [
            {
              timeOfDay: 'morning',
              locationName: 'Seaside Promenade',
              description: 'Relaxing walk along the beach',
              categoryTag: 'beach'
            },
            {
              timeOfDay: 'afternoon',
              locationName: 'Beach Activities',
              description: 'Swimming and water sports',
              categoryTag: 'beach'
            }
          ]
        }
      ]
    },
    foodie: {
      days: [
        {
          day: 1,
          activities: [
            {
              timeOfDay: 'morning',
              locationName: 'Local Food Market',
              description: 'Explore fresh produce and local specialties',
              categoryTag: 'food'
            },
            {
              timeOfDay: 'afternoon',
              locationName: 'Cooking Class',
              description: 'Learn to prepare traditional dishes',
              categoryTag: 'food'
            }
          ]
        }
      ]
    }
  }

  return templates[preference] || templates.city_break
}

/**
 * Validate trip ID from path parameter
 * @param tripIdStr - Trip ID string from URL path
 * @returns Validated trip ID as number
 * @throws Error if trip ID is invalid
 */
function validateTripId(tripIdStr: string): number {
  const tripId = parseInt(tripIdStr, 10)

  if (isNaN(tripId) || tripId <= 0) {
    throw new Error(`INVALID_TRIP_ID:${tripIdStr}`)
  }

  return tripId
}

/**
 * Derive trip status based on note_body and plan_json presence
 * @param noteBody - Trip note content (can be null)
 * @param planJson - Saved plan data (can be null)
 * @returns Trip status: CREATED, DRAFT, or CONFIRMED
 */
function deriveTripStatus(noteBody: string | null, planJson: unknown): string {
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
 * Handle GET /api/trips/:id (MOCK MODE ONLY)
 * Returns hardcoded trip data for development
 *
 * NOTE: For real database access, use frontend Supabase client
 * See: src/lib/services/trip.service.ts -> getTripById()
 */
async function handleGetTrip(req: Request, path: string) {
  try {
    // 1. Extract and validate tripId from path
    const tripIdStr = path.split('/').pop() || ''
    const tripId = validateTripId(tripIdStr)

    // MOCK MODE: Return hardcoded trip data
    console.log(`[API] MOCK MODE - returning hardcoded trip data for tripId=${tripId}`)

    const mockTrip = {
      id: tripId,
      user_id: '00000000-0000-0000-0000-000000000001',
      title: 'Summer in Croatia',
      note_body:
        'Planning a 10-day trip to Croatia in July. Want to visit Dubrovnik, Split, and Hvar. Interested in historical sites, beaches, and local cuisine. Traveling with family (2 adults, 2 kids aged 8 and 10). Budget is moderate. Looking for a mix of relaxation and cultural experiences. Would love to explore the old town walls in Dubrovnik, visit Diocletian\'s Palace in Split, and enjoy the beaches in Hvar. Also interested in trying local seafood and wine. Planning to rent a car for flexibility. Looking for family-friendly accommodations near the beach. Want to balance sightseeing with downtime for the kids. Interested in boat trips to nearby islands. Need recommendations for restaurants that accommodate children. Also curious about any local festivals or events happening in July. Want to avoid overly touristy spots if possible. Prefer authentic experiences. Budget allows for some splurges but generally moderate spending. Trip duration is 10 days total.',
      what: ['culture_museums', 'beach_relax', 'foodie'],
      speed: 'balance',
      type: 'roadtrip',
      budget: 'moderate',
      plan_json: null,
      plan_language: null,
      status: 'DRAFT',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    return new Response(JSON.stringify(mockTrip), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    // Handle validation errors
    if (error instanceof Error && error.message.startsWith('INVALID_TRIP_ID:')) {
      const provided = error.message.split(':')[1]
      return createErrorResponse(400, 'INVALID_TRIP_ID', 'Trip ID must be a valid positive integer', {
        provided
      })
    }

    // Handle unexpected errors
    console.error('[GET /api/trips/:id] Unexpected error:', error)
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred')
  }
}


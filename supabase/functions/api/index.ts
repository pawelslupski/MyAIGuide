// Supabase Edge Function: API Router (MOCK MODE)
// Returns hardcoded mock data - no database, no AI calls
//
// Routes:
// - POST /api/generations - Generate AI plan (mock)
//
// Usage:
// POST http://localhost:54321/functions/v1/api/generations
// Body: { "tripId": 1, "userId": "00000000-0000-0000-0000-000000000001" }

import { isFeatureEnabled } from '../../../src/lib/features/flags.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Feature flag check — reject all requests when auth is disabled
  if (!isFeatureEnabled('auth')) {
    return new Response(
      JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Auth feature is disabled in this environment' } }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname

    console.log(`[API] ${req.method} ${path}`)

    // Route: POST /api/generations
    if (path.endsWith('/generations') && req.method === 'POST') {
      return await handleGenerations(req)
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

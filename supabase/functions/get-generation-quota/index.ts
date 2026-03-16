// Supabase Edge Function: Get Generation Quota
// Returns the authenticated user's plan generation usage for the rolling 24-hour window.
//
// Route: POST /functions/v1/get-generation-quota
// Headers: Authorization: Bearer <supabase_session_token>
//
// Response: GenerationQuotaDTO { used, limit, remaining, reset_at }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum plan generations allowed per 24-hour batch. */
const QUOTA_LIMIT = 10

/** Cooldown length in milliseconds (24 hours). Starts when the Nth attempt is made. */
const WINDOW_MS = 24 * 60 * 60 * 1000

/** Only these statuses count toward the quota (validation_error is excluded). */
const COUNTED_STATUSES = ['success', 'api_error']

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

  // Only allow POST (supabaseClient.functions.invoke always sends POST)
  if (req.method !== 'POST') {
    return createErrorResponse(405, 'METHOD_NOT_ALLOWED', 'Only POST method is allowed')
  }

  try {
    // 1. Build Supabase client — forward the caller's Authorization header so
    //    auth.getUser() validates the JWT and RLS applies the correct user_id filter.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )

    // 2. Verify session — no DB interaction without a valid JWT
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'Authentication required')
    }

    // 3. Fetch the most recent QUOTA_LIMIT counted rows (newest first).
    //    Fixed-batch model: the 24 h cooldown starts when the Nth attempt is made
    //    and ALL slots are restored at once after it expires.
    const { data, error: dbError } = await supabase
      .from('plan_generations')
      .select('created_at')
      .eq('user_id', user.id)
      .in('status', COUNTED_STATUSES)
      .order('created_at', { ascending: false })
      .limit(QUOTA_LIMIT)

    if (dbError) {
      console.error('[get-generation-quota] DB query failed:', dbError.message)
      return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to fetch quota')
    }

    // 4. Compute quota fields using fixed-batch logic
    const rows = data ?? []
    const now = Date.now()
    let used: number
    let resetAt: string

    if (rows.length < QUOTA_LIMIT) {
      // Fewer than LIMIT rows exist — no cooldown active
      used = rows.length
      resetAt = new Date(now + WINDOW_MS).toISOString()
    } else {
      // The last row in DESC order is the one that filled the quota
      const limitRow = rows[QUOTA_LIMIT - 1]!
      const cooldownEndsAt = new Date(limitRow.created_at).getTime() + WINDOW_MS

      if (now < cooldownEndsAt) {
        // Still in cooldown
        used = QUOTA_LIMIT
        resetAt = new Date(cooldownEndsAt).toISOString()
      } else {
        // Cooldown expired — count only rows created after cooldown end
        const batchStart = new Date(cooldownEndsAt).toISOString()
        const { data: batchData, error: batchError } = await supabase
          .from('plan_generations')
          .select('created_at')
          .eq('user_id', user.id)
          .in('status', COUNTED_STATUSES)
          .gte('created_at', batchStart)
          .order('created_at', { ascending: false })
          .limit(QUOTA_LIMIT)

        if (batchError) {
          console.error('[get-generation-quota] Batch query failed:', batchError.message)
          return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to fetch quota')
        }

        used = (batchData ?? []).length
        resetAt = new Date(now + WINDOW_MS).toISOString()
      }
    }

    const remaining = Math.max(0, QUOTA_LIMIT - used)

    // 5. Return GenerationQuotaDTO
    const quotaDto = { used, limit: QUOTA_LIMIT, remaining, reset_at: resetAt }
    console.log(`[get-generation-quota] userId=${user.id} used=${used}/${QUOTA_LIMIT}`)

    return new Response(JSON.stringify(quotaDto), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('[get-generation-quota] Unexpected error:', err)
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred')
  }
})

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build a standardised error response with CORS headers.
 * Matches the ErrorResponse shape used across the project.
 */
function createErrorResponse(statusCode: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status: statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}


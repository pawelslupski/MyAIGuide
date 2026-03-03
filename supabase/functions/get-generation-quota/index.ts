// Supabase Edge Function: Get Generation Quota
// Returns the authenticated user's plan generation usage for the rolling 24-hour window.
//
// Route: GET /functions/v1/get-generation-quota
// Headers: Authorization: Bearer <supabase_session_token>
//
// Response: GenerationQuotaDTO { used, limit, remaining, reset_at }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum plan generations allowed in a 24-hour rolling window. */
const QUOTA_LIMIT = 10

/** Rolling window length in milliseconds (24 hours). */
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

  // Only allow GET
  if (req.method !== 'GET') {
    return createErrorResponse(405, 'METHOD_NOT_ALLOWED', 'Only GET method is allowed')
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

    // 3. Query plan_generations for the rolling 24-hour window
    //    Only 'success' and 'api_error' rows count toward the quota.
    //    RLS policy (auth.uid() = user_id) also enforces ownership at DB level.
    const cutoff = new Date(Date.now() - WINDOW_MS).toISOString()

    const { data, error: dbError } = await supabase
      .from('plan_generations')
      .select('created_at')
      .eq('user_id', user.id)
      .in('status', COUNTED_STATUSES)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: true })

    if (dbError) {
      console.error('[get-generation-quota] DB query failed:', dbError.message)
      return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to fetch quota')
    }

    // 4. Compute quota fields
    const rows = data ?? []
    const used = rows.length
    const remaining = Math.max(0, QUOTA_LIMIT - used)

    // reset_at = oldest counted generation + 24 h; if none exist → now + 24 h
    const resetAt =
      rows.length > 0
        ? new Date(new Date(rows[0].created_at).getTime() + WINDOW_MS).toISOString()
        : new Date(Date.now() + WINDOW_MS).toISOString()

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


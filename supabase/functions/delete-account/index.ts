import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

/**
 * Edge Function: DELETE /api/users/me (invoked as 'delete-account')
 *
 * Permanently deletes the authenticated user's account and all associated data
 * via database cascade (profiles, trips, plan_generations).
 *
 * Uses supabaseAdmin with service role key — never exposed to the browser.
 *
 * Expected body: { "confirmation": "DELETE MY ACCOUNT" }
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow DELETE requests
  if (req.method !== 'DELETE') {
    return createErrorResponse(405, 'METHOD_NOT_ALLOWED', 'Method not allowed')
  }

  try {
    // Step 1: Verify caller session via JWT in Authorization header
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'Authentication required')
    }

    // Step 2: Validate confirmation string
    let body: { confirmation?: unknown }
    try {
      body = await req.json()
    } catch {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Invalid JSON in request body')
    }

    if (body.confirmation !== 'DELETE MY ACCOUNT') {
      return createErrorResponse(
        400,
        'VALIDATION_ERROR',
        'Invalid confirmation string. Must be exactly: DELETE MY ACCOUNT'
      )
    }

    // Step 3: Delete user via admin API (service role key — server-side only)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)

    if (deleteError) {
      console.error('[delete-account] Admin deleteUser failed:', deleteError)
      return createErrorResponse(500, 'INTERNAL_ERROR', 'Account deletion failed')
    }

    // Cascade handles: profiles → deleted, trips → deleted, plan_generations → deleted
    console.log(`[delete-account] Account deleted for user ${user.id}`)

    return new Response(JSON.stringify({ message: 'Account successfully deleted' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('[delete-account] Unexpected error:', err)
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred')
  }
})

function createErrorResponse(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
): Response {
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


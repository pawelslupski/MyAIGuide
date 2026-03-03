# API Endpoint Implementation Plan: GET /api/users/me/generation-quota

## 1. Endpoint Overview

Returns the current user's plan generation usage for the rolling 24-hour window. Includes how many generations have been used, the maximum allowed, remaining slots, and the timestamp when the next slot will free up.

**Implementation approach:** Implemented as a **Supabase Edge Function** (`get-generation-quota`) — per `api-plan.md §6.2`, this endpoint is classified as requiring an Edge Function due to the rolling 24-hour window count query with complex status filtering. The Edge Function verifies the session server-side, executes the quota query on `plan_generations`, and returns the result. Core quota logic moves from `src/lib/services/generation.service.ts` to the Edge Function; the client-side `checkGenerationQuota` helper is retained for internal use by `generate-plan`. Store orchestration (auth, state) lives in `src/stores/plan.store.ts`.

**Status:** `checkGenerationQuota` in `generation.service.ts` is **already implemented**. The store action, DTO mapping, and dedicated quota state are the main gaps.

---

## 2. Request Details

- **HTTP Method:** GET
- **URL Structure:** `/api/users/me/generation-quota`
- **Path Parameters:** none
- **Query Parameters:** none
- **Request Body:** none
- **Headers:**
  - `Authorization: Bearer <supabase_session_token>` — required

---

## 3. Used Types

All types in `src/types.ts`.

### Response DTO — `GenerationQuotaDTO` (already exists)

```typescript
export interface GenerationQuotaDTO {
  used: number
  limit: number
  remaining: number
  reset_at: string
}
```

### Internal Result — `QuotaCheckResult` (already exists)

```typescript
export interface QuotaCheckResult {
  allowed: boolean
  used: number
  limit: number
  resetAt: string // camelCase — mapped to reset_at in the DTO response
}
```

### Error Response — `ErrorResponse` (already exists)

```typescript
export interface ErrorResponse {
  error: { code: string; message: string; details?: Record<string, unknown> }
}
```

---

## 4. Response Details

### Success — `200 OK`

```json
{
  "used": 7,
  "limit": 10,
  "remaining": 3,
  "reset_at": "2024-01-24T10:00:00Z"
}
```

> `reset_at` = oldest counted generation timestamp + 24h. If no generations exist, `reset_at` = now + 24h.
> Only `success` and `api_error` statuses count toward quota. `validation_error` records are excluded.

### Error Responses

| HTTP Code | Error Code       | Condition                 |
| --------- | ---------------- | ------------------------- |
| `401`     | `UNAUTHORIZED`   | No valid Supabase session |
| `500`     | `INTERNAL_ERROR` | DB query failure          |

---

## 5. Data Flow

```
TripView / GenerationPanel (Vue component)
  │
  ▼
planStore.fetchGenerationQuota()          [src/stores/plan.store.ts]
  │
  ├─► supabaseClient.auth.getUser()
  │     └─ null → set quotaError + return (401)
  │
  ▼
supabaseClient.functions.invoke('get-generation-quota')
  │  [supabase/functions/get-generation-quota/index.ts — Edge Function]
  │
  ├─► Verify JWT from Authorization header via supabase.auth.getUser()
  │     └─ invalid → return 401
  │
  ├─► supabase.from('plan_generations')
  │     .select('created_at')
  │     .eq('user_id', userId)
  │     .in('status', ['success', 'api_error'])
  │     .gte('created_at', now - 24h)
  │     .order('created_at', { ascending: true })
  │
  │   → count rows → compute used, remaining, reset_at
  │   └─ DB error → return 500
  │
  └─► return 200 GenerationQuotaDTO
        │
        ▼
  planStore: map response to store state
    generationQuota.value = {
      used: result.used,
      limit: result.limit,
      remaining: result.remaining,
      reset_at: result.reset_at
    }
```

---

## 6. Security Considerations

### Authentication

- `auth.getUser()` called first — no DB interaction without a valid session.

### Authorization

- Query filters by `user_id` at the application level; RLS SELECT policy on `plan_generations` also enforces `auth.uid() = user_id` at DB level.
- No resource ID in the URL — users can only ever see their own quota.

### Data Exposure

- Only aggregate counts and timestamps are returned — no generation content or plan data is exposed.

---

## 7. Error Handling

| Scenario                   | Root Cause                       | Factory                     | HTTP |
| -------------------------- | -------------------------------- | --------------------------- | ---- |
| No session / invalid token | `auth.getUser()` returns null    | `createUnauthorizedError()` | 401  |
| DB query failure           | Supabase returns error on select | `createInternalError()`     | 500  |

---

## 8. Performance Considerations

- **Index:** `(user_id, created_at DESC)` on `plan_generations` covers the query pattern efficiently (filter + date range + sort).
- **Rolling window:** `gte('created_at', now - 24h)` keeps the result set small even for heavy users.
- **Read-only:** No writes involved — safe to call frequently (e.g., after each generation, or on page load).
- **Pinia cache:** Store holds `generationQuota.value`; components should use the cached value and only re-fetch on stale signals (post-generation, page focus).

---

## 9. Implementation Steps

### Step 1 — Create `supabase/functions/get-generation-quota/index.ts` (Edge Function)

**File:** `supabase/functions/get-generation-quota/index.ts`

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

const QUOTA_LIMIT = 10
const WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const cutoff = new Date(Date.now() - WINDOW_MS).toISOString()
    const { data, error } = await supabase
      .from('plan_generations')
      .select('created_at')
      .eq('user_id', user.id)
      .in('status', ['success', 'api_error'])
      .gte('created_at', cutoff)
      .order('created_at', { ascending: true })

    if (error) {
      return new Response(
        JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch quota' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const rows = data ?? []
    const used = rows.length
    const remaining = Math.max(0, QUOTA_LIMIT - used)
    const resetAt = rows.length > 0
      ? new Date(new Date(rows[0].created_at).getTime() + WINDOW_MS).toISOString()
      : new Date(Date.now() + WINDOW_MS).toISOString()

    return new Response(
      JSON.stringify({ used, limit: QUOTA_LIMIT, remaining, reset_at: resetAt }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[get-generation-quota] Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

### Step 2 — Add `generationQuota` state to `plan.store.ts`

**File:** `src/stores/plan.store.ts`

```typescript
import type { GenerationQuotaDTO } from '@/types'

// Add to store state:
const generationQuota = ref<GenerationQuotaDTO | null>(null)
const quotaError = ref<ErrorResponse | null>(null)
const isLoadingQuota = ref(false)
```

### Step 3 — Add `fetchGenerationQuota` action to `plan.store.ts`

**File:** `src/stores/plan.store.ts`

Call the new Edge Function instead of querying Supabase directly:

```typescript
async function fetchGenerationQuota(): Promise<void> {
  isLoadingQuota.value = true
  quotaError.value = null

  try {
    const {
      data: { user }
    } = await supabaseClient.auth.getUser()
    if (!user) throw createUnauthorizedError()

    const { data, error } = await supabaseClient.functions.invoke('get-generation-quota')
    if (error) throw createInternalError(error.message)

    generationQuota.value = data as GenerationQuotaDTO
  } catch (err: unknown) {
    const apiErr = toApiError(err)
    quotaError.value = apiErr.toResponse()
    throw apiErr
  } finally {
    isLoadingQuota.value = false
  }
}
```

### Step 4 — Expose quota state in store return

**File:** `src/stores/plan.store.ts`

Add to the store's returned object:

```typescript
return {
  // ... existing exports ...
  generationQuota: readonly(generationQuota),
  quotaError: readonly(quotaError),
  isLoadingQuota: readonly(isLoadingQuota),
  fetchGenerationQuota
}
```

### Step 5 — Refresh quota after each generation attempt

**File:** `src/stores/plan.store.ts`

In the `generatePlan` action, after a successful or failed (api_error) AI call, refresh the quota:

```typescript
// After recordGenerationAttempt():
await fetchGenerationQuota()
```

### Step 6 — Retain `checkGenerationQuota` in `generation.service.ts` for internal use

**File:** `src/lib/services/generation.service.ts`

The existing `checkGenerationQuota` function is still used internally by the `generate-plan` Edge Function for server-side quota enforcement before invoking OpenRouter. It does not need to be removed, but it is no longer the implementation for the `GET /api/users/me/generation-quota` endpoint.

### Step 7 — Manual verification checklist

- [ ] Authenticated user with 0 generations returns `{ used: 0, limit: 10, remaining: 10 }`
- [ ] After 3 successful generations, `used: 3, remaining: 7`
- [ ] `validation_error` generations do **not** count toward `used`
- [ ] `reset_at` is the oldest counted generation timestamp + 24h
- [ ] At 10 generations, `remaining: 0` and subsequent `generate-plan` calls return `429`
- [ ] Unauthenticated request to Edge Function returns `401`
- [ ] Quota counter updates in the UI after each generation attempt
- [ ] Service role key is NOT needed for this Edge Function (anon key with RLS is sufficient)

# API Endpoint Implementation Plan: GET /api/users/me/generation-quota

## 1. Endpoint Overview

Returns the current user's plan generation usage for the rolling 24-hour window. Includes how many generations have been used, the maximum allowed, remaining slots, and the timestamp when the next slot will free up.

**Implementation approach:** Standard Supabase JS Client query on `plan_generations` — no Edge Function required (the query is read-only; no server-side API key needed). Core quota logic already lives in `src/lib/services/generation.service.ts` (`checkGenerationQuota`); orchestration (auth, state) lives in `src/stores/plan.store.ts`.

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
generation.service.ts :: checkGenerationQuota(userId)
  │
  ├─► supabase.from('plan_generations')
  │     .select('created_at')
  │     .eq('user_id', userId)
  │     .in('status', ['success', 'api_error'])
  │     .gte('created_at', now - 24h)
  │     .order('created_at', { ascending: true })
  │
  │   → count rows → compute used, remaining, reset_at
  │   └─ DB error → throw Error (caught as INTERNAL_ERROR in store)
  │
  └─► return QuotaCheckResult { allowed, used, limit, resetAt }
        │
        ▼
  planStore: map to GenerationQuotaDTO
    generationQuota.value = {
      used: result.used,
      limit: result.limit,
      remaining: result.limit - result.used,
      reset_at: result.resetAt
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

### Step 1 — Add `generationQuota` state to `plan.store.ts`

**File:** `src/stores/plan.store.ts`

```typescript
import type { GenerationQuotaDTO } from '@/types'
import { checkGenerationQuota } from '@/lib/services/generation.service'

// Add to store state:
const generationQuota = ref<GenerationQuotaDTO | null>(null)
const quotaError = ref<ErrorResponse | null>(null)
const isLoadingQuota = ref(false)
```

### Step 2 — Add `fetchGenerationQuota` action to `plan.store.ts`

**File:** `src/stores/plan.store.ts`

```typescript
async function fetchGenerationQuota(): Promise<void> {
  isLoadingQuota.value = true
  quotaError.value = null

  try {
    const {
      data: { user }
    } = await supabaseClient.auth.getUser()
    if (!user) throw createUnauthorizedError()

    const result = await checkGenerationQuota(user.id)

    generationQuota.value = {
      used: result.used,
      limit: result.limit,
      remaining: result.limit - result.used,
      reset_at: result.resetAt
    }
  } catch (err: unknown) {
    const apiErr = toApiError(err)
    quotaError.value = apiErr.toResponse()
    throw apiErr
  } finally {
    isLoadingQuota.value = false
  }
}
```

### Step 3 — Expose quota state in store return

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

### Step 4 — Refresh quota after each generation attempt

**File:** `src/stores/plan.store.ts`

In the `generatePlan` action, after a successful or failed (api_error) AI call, refresh the quota:

```typescript
// After recordGenerationAttempt():
await fetchGenerationQuota()
```

This keeps the displayed counter in sync without requiring a separate user action.

### Step 5 — Verify `checkGenerationQuota` in `generation.service.ts` (ALREADY IMPLEMENTED)

**File:** `src/lib/services/generation.service.ts`

Confirm:

1. Filters by `status IN ('success', 'api_error')` — `validation_error` excluded
2. Uses rolling 24h window: `.gte('created_at', now - 24h)`
3. Orders by `created_at ASC` to correctly compute `resetAt` from the oldest entry
4. Returns `{ allowed, used, limit, resetAt }`

### Step 6 — Manual verification checklist

- [ ] Authenticated user with 0 generations returns `{ used: 0, limit: 10, remaining: 10 }`
- [ ] After 3 successful generations, `used: 3, remaining: 7`
- [ ] `validation_error` generations do **not** count toward `used`
- [ ] `reset_at` is the oldest counted generation timestamp + 24h
- [ ] At 10 generations, `remaining: 0` and subsequent `generate-plan` calls return `429`
- [ ] Unauthenticated request returns `401`
- [ ] Quota counter updates in the UI after each generation attempt

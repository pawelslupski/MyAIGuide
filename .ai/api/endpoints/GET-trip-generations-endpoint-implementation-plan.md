# API Endpoint Implementation Plan: GET /api/trips/{tripId}/generations

## 1. Endpoint Overview

Retrieves the generation attempt history for a specific trip in reverse-chronological order (most recent first). Used for diagnostics — allows users to see past AI generation attempts, their outcomes, and any error messages.

**Implementation approach:** Standard Supabase JS Client (PostgREST + RLS) — no Edge Function required. Service function lives in `src/lib/services/generation.service.ts`; orchestration (auth, state) lives in `src/stores/plan.store.ts`.

**Status:** No service function exists for this endpoint. This plan covers full implementation.

---

## 2. Request Details

- **HTTP Method:** GET
- **URL Structure:** `/api/trips/{tripId}/generations`
- **Path Parameters:**
  - `tripId` (required): positive integer
- **Query Parameters:**

| Parameter | Type    | Default | Constraints |
| --------- | ------- | ------- | ----------- |
| `limit`   | integer | `10`    | 1–50        |

- **Request Body:** none
- **Headers:**
  - `Authorization: Bearer <supabase_session_token>` — required

---

## 3. Used Types

All types in `src/types.ts`.

### Item DTO — `PlanGenerationHistoryItemDTO` (already exists)

```typescript
/** Directly maps to the plan_generations table Row. */
export type PlanGenerationHistoryItemDTO = Tables<'plan_generations'>
// Fields: id, trip_id, user_id, status, model_name, error_message, created_at
```

### Response DTO — `PlanGenerationHistoryDTO` (already exists)

```typescript
export interface PlanGenerationHistoryDTO {
  generations: PlanGenerationHistoryItemDTO[]
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
  "generations": [
    {
      "id": 789,
      "trip_id": 456,
      "user_id": "uuid-string",
      "status": "success",
      "model_name": "anthropic/claude-3.5-sonnet",
      "error_message": null,
      "created_at": "2024-01-23T12:00:00Z"
    },
    {
      "id": 788,
      "trip_id": 456,
      "user_id": "uuid-string",
      "status": "api_error",
      "model_name": "openai/gpt-4",
      "error_message": "API timeout after 60 seconds",
      "created_at": "2024-01-22T15:30:00Z"
    }
  ]
}
```

> Empty result (`generations: []`) is returned when no attempts exist — not a 404.

### Error Responses

| HTTP Code | Error Code       | Condition                    |
| --------- | ---------------- | ---------------------------- |
| `401`     | `UNAUTHORIZED`   | No valid Supabase session    |
| `403`     | `FORBIDDEN`      | Trip belongs to another user |
| `404`     | `NOT_FOUND`      | Trip does not exist          |
| `500`     | `INTERNAL_ERROR` | DB query failure             |

---

## 5. Data Flow

```
TripView (Vue component — diagnostics panel)
  │
  ▼
planStore.fetchTripGenerations(tripId, limit?)     [src/stores/plan.store.ts]
  │
  ├─► supabaseClient.auth.getUser()
  │     └─ null → throw createUnauthorizedError() (401)
  │
  ├─► Validate tripId is a positive integer
  │
  ▼
generation.service.ts :: getTripGenerations(tripId, userId, limit)
  │
  ├─► Ownership check: verify trip exists and belongs to userId
  │     supabase.from('trips').select('id, user_id').eq('id', tripId).single()
  │     └─ PGRST116 / null → throw createNotFoundError() (404)
  │     └─ trip.user_id !== userId → throw createForbiddenError() (403)
  │
  ├─► supabase.from('plan_generations')
  │     .select('*')
  │     .eq('trip_id', tripId)
  │     .eq('user_id', userId)   ← defense-in-depth (RLS also filters)
  │     .order('created_at', { ascending: false })
  │     .limit(limit)
  │
  │   └─ DB error → throw createInternalError() (500)
  │
  └─► return PlanGenerationHistoryDTO { generations: [...] }
        │
        ▼
  planStore.tripGenerations.value = result.generations
```

---

## 6. Security Considerations

### Authentication

- `auth.getUser()` called before any DB interaction.

### Authorization — Defense in Depth

| Layer          | Mechanism                                                        |
| -------------- | ---------------------------------------------------------------- |
| Application    | Explicit trip ownership check before querying `plan_generations` |
| Service        | `.eq('user_id', userId)` filter on `plan_generations` query      |
| Database (RLS) | RLS SELECT policy on both `trips` and `plan_generations` tables  |

Two-step approach ensures a clear `403` (trip exists but belongs to another user) vs `404` (trip does not exist) distinction.

### Data Exposure

- `user_id` is included in each row but is the authenticated user's own ID — acceptable.
- `error_message` may contain internal error details; this is scoped to the trip owner only.

---

## 7. Error Handling

| Scenario                        | Root Cause                            | Factory                      | HTTP |
| ------------------------------- | ------------------------------------- | ---------------------------- | ---- |
| No session / invalid token      | `auth.getUser()` returns null         | `createUnauthorizedError()`  | 401  |
| Non-integer or ≤ 0 `tripId`     | Manual guard                          | `createInvalidTripIdError()` | 400  |
| Trip does not exist             | `.single()` returns PGRST116          | `createNotFoundError()`      | 404  |
| Trip belongs to another user    | `trip.user_id !== userId`             | `createForbiddenError()`     | 403  |
| DB query failure on generations | Supabase returns error on `.select()` | `createInternalError()`      | 500  |
| No generations found            | Empty array returned — not an error   | —                            | 200  |

---

## 8. Performance Considerations

- **Index:** `(user_id, created_at DESC)` on `plan_generations` covers the `WHERE user_id = ? ORDER BY created_at DESC` pattern efficiently.
- **Limit:** Default 10, max 50 — keeps response payload small; this is a diagnostics endpoint, not a primary data flow.
- **Two round-trips:** Ownership fetch on `trips` + query on `plan_generations`. Acceptable for a low-frequency diagnostics call.

---

## 9. Implementation Steps

### Step 1 — Add `getTripGenerations` to `generation.service.ts`

**File:** `src/lib/services/generation.service.ts`

```typescript
import type { PlanGenerationHistoryDTO } from '@/types'
import {
  createNotFoundError,
  createForbiddenError,
  createInternalError
} from '@/lib/errors/api.error'

/**
 * Retrieve generation attempt history for a trip.
 *
 * @param tripId - Trip identifier (positive integer)
 * @param userId - Authenticated user ID (UUID) — used for ownership validation
 * @param limit  - Max records to return (1–50, default 10)
 * @returns PlanGenerationHistoryDTO
 * @throws ApiError 404 if trip not found, 403 if not owned by user, 500 on DB error
 */
export async function getTripGenerations(
  tripId: number,
  userId: string,
  limit = 10
): Promise<PlanGenerationHistoryDTO> {
  // Ownership check
  const { data: trip, error: tripError } = await supabaseClient
    .from('trips')
    .select('id, user_id')
    .eq('id', tripId)
    .single()

  if (tripError || !trip) throw createNotFoundError()
  if (trip.user_id !== userId) throw createForbiddenError()

  // Fetch generation history
  const { data, error } = await supabaseClient
    .from('plan_generations')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50))

  if (error) throw createInternalError(`Failed to fetch generations: ${error.message}`)

  return { generations: data ?? [] }
}
```

### Step 2 — Add `tripGenerations` state and `fetchTripGenerations` action to `plan.store.ts`

**File:** `src/stores/plan.store.ts`

```typescript
import type { PlanGenerationHistoryItemDTO } from '@/types'
import { getTripGenerations } from '@/lib/services/generation.service'

// Add to store state:
const tripGenerations = ref<PlanGenerationHistoryItemDTO[]>([])
const generationsError = ref<ErrorResponse | null>(null)
const isLoadingGenerations = ref(false)

async function fetchTripGenerations(tripId: number, limit = 10): Promise<void> {
  isLoadingGenerations.value = true
  generationsError.value = null

  try {
    const {
      data: { user }
    } = await supabaseClient.auth.getUser()
    if (!user) throw createUnauthorizedError()

    const result = await getTripGenerations(tripId, user.id, limit)
    tripGenerations.value = result.generations
  } catch (err: unknown) {
    const apiErr = toApiError(err)
    generationsError.value = apiErr.toResponse()
    throw apiErr
  } finally {
    isLoadingGenerations.value = false
  }
}
```

### Step 3 — Expose state in store return

**File:** `src/stores/plan.store.ts`

```typescript
return {
  // ... existing exports ...
  tripGenerations: readonly(tripGenerations),
  generationsError: readonly(generationsError),
  isLoadingGenerations: readonly(isLoadingGenerations),
  fetchTripGenerations
}
```

### Step 4 — Manual verification checklist

- [ ] Authenticated trip owner gets a list of generation records (`200`)
- [ ] Empty list is returned as `{ generations: [] }` when no attempts exist — not `404`
- [ ] Records are sorted `created_at DESC` (most recent first)
- [ ] `limit` param is respected (default 10, max 50)
- [ ] Non-existent `tripId` returns `404`
- [ ] Another user's `tripId` returns `403`
- [ ] Unauthenticated request returns `401`
- [ ] Each record includes `id`, `trip_id`, `user_id`, `status`, `model_name`, `error_message`, `created_at`
- [ ] `status` values are `success`, `api_error`, or `validation_error`

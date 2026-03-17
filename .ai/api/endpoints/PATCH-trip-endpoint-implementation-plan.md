# API Endpoint Implementation Plan: PATCH /api/trips/{tripId}

## 1. Endpoint Overview

Updates one or more fields of an existing trip. All fields are optional (partial update). Does **not** modify `plan_json` or `plan_language` — those are managed by `PUT /api/trips/{tripId}/plan`. Returns the full updated `TripDTO` with recomputed `status`.

**Implementation approach:** Standard Supabase JS Client (PostgREST + RLS) — no Edge Function required. DB write logic lives in `src/lib/services/trip.service.ts` (`updateTrip`); orchestration (auth, validation, state) lives in `src/stores/trip.store.ts`.

**Status:** `updateTrip` in `trip.service.ts` is **already implemented**. A Zod command schema and the store action wiring are the main gaps.

---

## 2. Request Details

- **HTTP Method:** PATCH
- **URL Structure:** `/api/trips/{tripId}`
- **Path Parameters:**
  - `tripId` (required): positive integer
- **Query Parameters:** none
- **Request Body (all fields optional):**

```json
{
  "title": "Updated Trip Title",
  "destination": "Tuscany, Italy",
  "num_days": 5,
  "num_people": 3,
  "what": ["nature", "beach_relax"],
  "speed": "slow_chill",
  "type": "roadtrip",
  "budget": "budget",
  "note_body": "Updated notes about the trip..."
}
```

**Validation rules:** Same as `POST /api/trips` — `title` max 255, `destination` max 50, `num_days` ≥ 1, `num_people` ≥ 1, enum constraints, `note_body` max 10,000 chars or null.

---

## 3. Used Types

All types in `src/types.ts`.

### Command Model — `UpdateTripCommand` (already exists)

```typescript
export interface UpdateTripCommand {
  title?: string
  destination?: string | null
  note_body?: string | null
  what?: WhatPreference[]
  speed?: SpeedPreference | null
  type?: TypePreference | null
  budget?: BudgetPreference | null
  num_days?: number | null
  num_people?: number | null
}
```

### Response DTO — `TripDTO` (already exists)

Full updated trip object with recomputed `status`.

---

## 4. Response Details

### Success — `200 OK`

Returns the full updated `TripDTO` (same shape as `GET /api/trips/{tripId}`).

### Error Responses

| HTTP Code | Error Code         | Condition                                           |
| --------- | ------------------ | --------------------------------------------------- |
| `400`     | `VALIDATION_ERROR` | Constraint violation (title too long, invalid enum) |
| `401`     | `UNAUTHORIZED`     | No valid Supabase session                           |
| `403`     | `FORBIDDEN`        | Trip belongs to another user                        |
| `404`     | `NOT_FOUND`        | Trip does not exist                                 |
| `500`     | `INTERNAL_ERROR`   | DB update failure                                   |

---

## 5. Data Flow

```
TripView (Vue component)
  │
  ▼
tripStore.updateTrip(tripId, command: UpdateTripCommand)   [src/stores/trip.store.ts]
  │
  ├─► supabaseClient.auth.getUser()
  │     └─ null → throw createUnauthorizedError() (401)
  │
  ├─► validateTripId(tripId)    → throw createInvalidTripIdError() if not a positive integer
  │
  ├─► validateUpdateTripCommand(command)   [trip.schemas.ts]
  │     └─ ZodError → throw createValidationError(msg, details) (400)
  │
  ▼
trip.service.ts :: updateTrip(tripId, userId, updates)
  │
  ├─► supabase.from('trips')
  │     .select('id, user_id')
  │     .eq('id', tripId)
  │     .single()
  │     └─ PGRST116 / null → throw createNotFoundError() (404)
  │
  ├─► Explicit ownership check: trip.user_id !== userId
  │     └─ mismatch → throw createForbiddenError() (403)
  │
  ├─► supabase.from('trips')
  │     .update(updates)
  │     .eq('id', tripId)
  │     .eq('user_id', userId)   ← defense-in-depth on top of RLS
  │     .select('*').single()
  │     └─ error → throw createInternalError() (500)
  │
  ├─► deriveTripStatus(updated.note_body, updated.plan_json)
  │
  └─► return TripDTO
        │
        ▼
  tripStore.currentTrip.value = updatedTrip
```

---

## 6. Security Considerations

### Authentication

- `auth.getUser()` called before any DB interaction.

### Authorization — Defense in Depth

| Layer          | Mechanism                                                                  |
| -------------- | -------------------------------------------------------------------------- |
| Application    | `auth.getUser()` guard; `.eq('user_id', userId)` explicit filter in UPDATE |
| Database (RLS) | `USING (auth.uid() = user_id)` UPDATE policy at PostgreSQL level           |

A two-step approach is used: first fetch the trip (returning `404` if not found), then check ownership (returning `403` if not the owner), then execute the update. This correctly distinguishes `404` from `403` per `api-plan.md §2.4`.

### Input Validation

- `tripId` validated as a positive integer before any DB operation.
- All command fields validated by Zod before reaching the service layer.

---

## 7. Error Handling

| Scenario                        | Root Cause                            | Factory                      | HTTP |
| ------------------------------- | ------------------------------------- | ---------------------------- | ---- |
| No session / invalid token      | `auth.getUser()` returns null         | `createUnauthorizedError()`  | 401  |
| Non-integer or ≤ 0 `tripId`     | Manual guard or Zod coerce            | `createInvalidTripIdError()` | 400  |
| `title` empty or > 255 chars    | Zod validation fails                  | `createValidationError()`    | 400  |
| `note_body` > 10,000 chars      | Zod `max(10000)` fails                | `createValidationError()`    | 400  |
| Invalid enum preference value   | Zod enum check fails                  | `createValidationError()`    | 400  |
| Trip not found / owned by other | `.single()` returns PGRST116 or null  | `createNotFoundError()`      | 404  |
| DB update failure               | Supabase returns error on `.update()` | `createInternalError()`      | 500  |

---

## 8. Performance Considerations

- **Single update + select:** One round-trip using `.update().select().single()` — no separate ownership fetch needed because `user_id` filter on the UPDATE makes 403 and 404 collapse (acceptable for MVP).
- **Index:** `idx_trips_user_updated (user_id, updated_at DESC)` covers the update's `WHERE user_id = ? AND id = ?` clause efficiently.
- **`updated_at` trigger:** Fires automatically on every UPDATE — no application-level timestamp management.

---

## 9. Implementation Steps

### Step 1 — Add `UpdateTripCommandSchema` to `trip.schemas.ts`

**File:** `src/lib/validation/trip.schemas.ts`

```typescript
export const UpdateTripCommandSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  destination: z.string().max(50).nullable().optional(),
  num_days: z.number().int().min(1).max(30).nullable().optional(),
  num_people: z.number().int().min(1).max(20).nullable().optional(),
  what: z.array(WhatPreferenceSchema).optional(),
  speed: z.enum(['slow_chill', 'balance', 'intensive']).nullable().optional(),
  type: z.enum(['base', 'base_with_trips', 'roadtrip']).nullable().optional(),
  budget: z.enum(['budget', 'moderate', 'luxury']).nullable().optional(),
  note_body: z.string().max(10000).nullable().optional()
})

export function validateUpdateTripCommand(data: unknown) {
  return UpdateTripCommandSchema.parse(data)
}
```

### Step 2 — Update `updateTrip` in `trip.service.ts` to use two-step fetch+check pattern (GAP)

**File:** `src/lib/services/trip.service.ts`

Per `api-plan.md §2.4`, a `403` must be returned when the trip exists but belongs to another user. Use the same two-step pattern as `deleteTrip` and `getTripById`:

```typescript
export async function updateTrip(
  tripId: number,
  userId: string,
  updates: UpdateTripCommand
): Promise<TripDTO> {
  // Step 1: Fetch to verify existence and ownership
  const { data: existing, error: fetchError } = await supabaseClient
    .from('trips')
    .select('id, user_id')
    .eq('id', tripId)
    .single()

  if (fetchError || !existing) throw createNotFoundError()
  if (existing.user_id !== userId) throw createForbiddenError()

  // Step 2: Execute update (RLS also enforces ownership at DB level)
  const { data, error: updateError } = await supabaseClient
    .from('trips')
    .update(updates)
    .eq('id', tripId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (updateError || !data) {
    throw createInternalError(`Failed to update trip: ${updateError?.message ?? 'Unknown error'}`)
  }

  return {
    ...data,
    what: data.what as WhatPreference[],
    plan_json: data.plan_json as PlanJson | null,
    speed: data.speed as SpeedPreference | null,
    type: data.type as TypePreference | null,
    budget: data.budget as BudgetPreference | null,
    status: deriveTripStatus(data.note_body, data.plan_json)
  }
}
```

### Step 3 — Add `updateTrip` action to `trip.store.ts`

**File:** `src/stores/trip.store.ts`

```typescript
async function updateTrip(tripId: number, command: UpdateTripCommand): Promise<void> {
  isLoading.value = true
  error.value = null

  try {
    const {
      data: { user }
    } = await supabaseClient.auth.getUser()
    if (!user) throw createUnauthorizedError()

    const validated = validateUpdateTripCommand(command)
    const updated = await updateTripService(tripId, user.id, validated)
    currentTrip.value = updated
  } catch (err: unknown) {
    const apiErr = toApiError(err)
    error.value = apiErr.toResponse()
    throw apiErr
  } finally {
    isLoading.value = false
  }
}
```

### Step 4 — Manual verification checklist

- [ ] PATCH with a single field (e.g., `title`) updates only that field (`200`)
- [ ] PATCH with all fields updates all fields (`200`)
- [ ] Empty PATCH body (no fields) is accepted and returns current trip unchanged (`200`)
- [ ] `title: ""` returns `400`
- [ ] `note_body` > 10,000 chars returns `400`
- [ ] Invalid enum (e.g., `speed: "turbo"`) returns `400`
- [ ] Non-existent `tripId` returns `404`
- [ ] Another user's `tripId` returns `403` (explicit fetch+ownership check implemented)
- [ ] Unauthenticated request returns `401`
- [ ] `plan_json` and `plan_language` are NOT affected by this endpoint
- [ ] `status` is recomputed correctly after note_body update (CREATED → DRAFT)
- [ ] `updated_at` is bumped by the DB trigger on every successful PATCH

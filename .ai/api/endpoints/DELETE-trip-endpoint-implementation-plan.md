# API Endpoint Implementation Plan: DELETE /api/trips/{tripId}

## 1. Endpoint Overview

Permanently deletes a trip and all its associated data (`plan_generations` rows) via database cascade. Returns `204 No Content` on success. Enforces ownership — users can only delete their own trips.

**Implementation approach:** Standard Supabase JS Client (PostgREST + RLS) — no Edge Function required. DB delete logic lives in `src/lib/services/trip.service.ts`; orchestration (auth, state cleanup) lives in `src/stores/trip.store.ts`.

**Status:** `deleteTrip` is **not yet implemented** in `trip.service.ts`. This plan covers full implementation.

---

## 2. Request Details

- **HTTP Method:** DELETE
- **URL Structure:** `/api/trips/{tripId}`
- **Path Parameters:**
  - `tripId` (required): positive integer
- **Query Parameters:** none
- **Request Body:** none
- **Headers:**
  - `Authorization: Bearer <supabase_session_token>` — required

---

## 3. Used Types

All types in `src/types.ts`. No new types needed for this endpoint.

### Path Param Validation

`tripId` must be a positive integer — validated before any DB interaction using the existing `tripIdSchema` from `src/lib/validation/trip.schemas.ts` (or `createInvalidTripIdError` from `api.error.ts`).

### Error Response — `ErrorResponse` (already exists)

```typescript
export interface ErrorResponse {
  error: { code: string; message: string; details?: Record<string, unknown> }
}
```

---

## 4. Response Details

### Success — `204 No Content`

Empty body. Client should remove the trip from local state.

### Error Responses

| HTTP Code | Error Code         | Condition                          |
| --------- | ------------------ | ---------------------------------- |
| `400`     | `INVALID_TRIP_ID`  | `tripId` is not a positive integer |
| `401`     | `UNAUTHORIZED`     | No valid Supabase session          |
| `403`     | `FORBIDDEN`        | Trip belongs to another user       |
| `404`     | `NOT_FOUND`        | Trip does not exist                |
| `500`     | `INTERNAL_ERROR`   | DB delete failure                  |

---

## 5. Data Flow

```
TripView / Dashboard (Vue component)
  │
  ▼
tripStore.deleteTrip(tripId)          [src/stores/trip.store.ts]
  │
  ├─► supabaseClient.auth.getUser()
  │     └─ null → throw createUnauthorizedError() (401)
  │
  ├─► Validate tripId is a positive integer
  │     └─ invalid → throw createInvalidTripIdError() (400)
  │
  ▼
trip.service.ts :: deleteTrip(tripId, userId)
  │
  ├─► supabase.from('trips')
  │     .select('id, user_id')
  │     .eq('id', tripId)
  │     .single()
  │     └─ PGRST116 / null → throw createNotFoundError() (404)
  │
  ├─► Ownership check: trip.user_id !== userId
  │     └─ mismatch → throw createForbiddenError() (403)
  │
  ├─► supabase.from('trips')
  │     .delete()
  │     .eq('id', tripId)
  │     .eq('user_id', userId)   ← defense-in-depth
  │     └─ error → throw createInternalError() (500)
  │
  │   CASCADE: DB FK ON DELETE CASCADE removes associated plan_generations rows
  │
  └─► return void
        │
        ▼
  tripStore: remove deleted trip from trips.value
             navigate back to dashboard if on /trips/:id
```

---

## 6. Security Considerations

### Authentication

- `auth.getUser()` called before any DB interaction — no delete without a valid session.

### Authorization — Defense in Depth

| Layer          | Mechanism                                                                 |
| -------------- | ------------------------------------------------------------------------- |
| Application    | Explicit `trip.user_id !== userId` check before delete                    |
| Service        | `.eq('user_id', userId)` filter on the DELETE statement                   |
| Database (RLS) | `USING (auth.uid() = user_id)` DELETE policy enforced at PostgreSQL level |

Two-step approach (fetch + delete) gives a clear `403` vs `404` distinction. The DELETE statement's `user_id` filter provides an additional safety net.

### Cascade Deletion

- `plan_generations.trip_id` has `ON DELETE CASCADE` — all generation history is removed atomically with the trip. No orphaned rows possible.

---

## 7. Error Handling

| Scenario                     | Root Cause                            | Factory                      | HTTP |
| ---------------------------- | ------------------------------------- | ---------------------------- | ---- |
| No session / invalid token   | `auth.getUser()` returns null         | `createUnauthorizedError()`  | 401  |
| Non-integer or ≤ 0 `tripId`  | Manual guard / Zod coerce             | `createInvalidTripIdError()` | 400  |
| Trip does not exist          | `.single()` returns PGRST116          | `createNotFoundError()`      | 404  |
| Trip belongs to another user | `trip.user_id !== userId`             | `createForbiddenError()`     | 403  |
| DB delete failure            | Supabase returns error on `.delete()` | `createInternalError()`      | 500  |

---

## 8. Performance Considerations

- **Two DB round-trips:** fetch for ownership check + delete. This gives precise 403/404 differentiation — acceptable trade-off for MVP security clarity.
- **Cascade:** `plan_generations` rows are removed by the DB engine in the same transaction — no application-level cleanup required.
- **Index:** Primary key lookup on `trips.id` is O(1).

---

## 9. Implementation Steps

### Step 1 — Add `deleteTrip` to `trip.service.ts`

**File:** `src/lib/services/trip.service.ts`

```typescript
/**
 * Delete a trip by ID with ownership validation.
 *
 * @param tripId - Trip identifier (positive integer)
 * @param userId - Authenticated user ID (UUID)
 * @throws ApiError 404 if trip not found
 * @throws ApiError 403 if trip belongs to another user
 * @throws ApiError 500 on DB delete failure
 */
export async function deleteTrip(tripId: number, userId: string): Promise<void> {
  // Step 1: Fetch to verify existence and ownership
  const { data: trip, error: fetchError } = await supabaseClient
    .from('trips')
    .select('id, user_id')
    .eq('id', tripId)
    .single()

  if (fetchError || !trip) {
    throw createNotFoundError()
  }

  if (trip.user_id !== userId) {
    throw createForbiddenError()
  }

  // Step 2: Delete (RLS also enforces ownership at DB level)
  const { error: deleteError } = await supabaseClient
    .from('trips')
    .delete()
    .eq('id', tripId)
    .eq('user_id', userId)

  if (deleteError) {
    throw createInternalError(`Failed to delete trip: ${deleteError.message}`)
  }
}
```

### Step 2 — Add `deleteTrip` action to `trip.store.ts`

**File:** `src/stores/trip.store.ts`

```typescript
import { deleteTrip as deleteTripService } from '@/lib/services/trip.service'

async function deleteTrip(tripId: number): Promise<void> {
  try {
    const {
      data: { user }
    } = await supabaseClient.auth.getUser()
    if (!user) throw createUnauthorizedError()

    await deleteTripService(tripId, user.id)

    // Remove from local list state
    trips.value = trips.value.filter((t) => t.id !== tripId)

    // Clear current trip if we just deleted it
    if (currentTrip.value?.id === tripId) {
      currentTrip.value = null
    }
  } catch (err: unknown) {
    const apiErr = toApiError(err)
    tripsError.value = apiErr.toResponse()
    throw apiErr
  }
}
```

### Step 3 — Verify RLS DELETE policy is active

Confirm the policy exists in applied migrations:

```sql
CREATE POLICY "Users can delete own trips"
  ON trips FOR DELETE
  USING (auth.uid() = user_id);
```

### Step 4 — Manual verification checklist

- [ ] Authenticated owner can delete their trip (`204`, no body)
- [ ] Deleted trip is removed from the trip list in the UI
- [ ] Associated `plan_generations` rows are also deleted (cascade works)
- [ ] Non-existent `tripId` returns `404`
- [ ] Another user's `tripId` returns `403`
- [ ] Unauthenticated request returns `401`
- [ ] Deleting an already-deleted trip returns `404` (idempotent on the client)
- [ ] Navigation redirects to dashboard after deleting the currently-viewed trip

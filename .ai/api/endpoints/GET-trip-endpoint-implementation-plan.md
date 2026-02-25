# API Endpoint Implementation Plan: GET /api/trips/{tripId}

## 1. Endpoint Overview

Retrieves detailed information about a specific trip including note, per-trip preferences, and saved plan (if any). Enforces ownership — users can only access their own trips. Computes `status` server-side from `note_body` and `plan_json` presence.

**Implementation approach:** Standard Supabase JS Client call (PostgREST + RLS) — no Edge Function required. Core DB logic lives in `src/lib/services/trip.service.ts`; orchestration (auth, state) lives in `src/stores/trip.store.ts`.

**Status of implementation steps:** The service layer (`getTripById`, `deriveTripStatus`) is **already implemented** in `src/lib/services/trip.service.ts`.

---

## 2. Request Details

- **HTTP Method:** GET
- **URL Structure:** `/api/trips/{tripId}` (maps to a Supabase PostgREST query on `trips`)
- **Path Parameters:**
  - `tripId` (required): positive integer
- **Query Parameters:** none
- **Request Body:** none
- **Headers:**
  - `Authorization: Bearer <supabase_session_token>` — required; Supabase JS Client attaches it automatically

---

## 3. Used Types

All types are defined in `src/types.ts`.

### Response DTO — `TripDTO`

```typescript
export interface TripDTO extends Omit<
  Tables<'trips'>,
  'plan_json' | 'what' | 'speed' | 'type' | 'budget'
> {
  what: WhatPreference[] // narrowed from string[]
  speed: SpeedPreference | null // narrowed from string
  type: TypePreference | null // narrowed from string
  budget: BudgetPreference | null // narrowed from string
  plan_json: PlanJson | null // typed instead of raw JSONB
  status: TripStatus // computed — never stored in DB
}
```

### Supporting Types

```typescript
export type TripStatus = 'CREATED' | 'DRAFT' | 'CONFIRMED'

export interface PlanJson {
  days: Day[]
}
export interface Day {
  day: number
  activities: Activity[]
}
export interface Activity {
  timeOfDay: TimeOfDay
  locationName: string
  description: string
  categoryTag: WhatPreference
}

export type WhatPreference = 'nature' | 'culture_museums' | 'beach_relax' | 'city_break' | 'foodie'
export type SpeedPreference = 'slow_chill' | 'balance' | 'intensive'
export type TypePreference = 'base' | 'base_with_trips' | 'roadtrip'
export type BudgetPreference = 'budget' | 'moderate' | 'luxury'
```

### Error Response — `ErrorResponse`

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
  "id": 456,
  "user_id": "uuid-string",
  "title": "Summer in Croatia",
  "destination": "Croatia",
  "num_days": 10,
  "num_people": 4,
  "what": ["culture_museums", "beach_relax", "foodie"],
  "speed": "balance",
  "type": "roadtrip",
  "budget": "moderate",
  "note_body": "Planning a 10-day trip...",
  "plan_language": "en",
  "plan_json": {
    "days": [
      {
        "day": 1,
        "activities": [
          {
            "timeOfDay": "morning",
            "locationName": "Dubrovnik Old Town",
            "description": "Explore the historic walled city",
            "categoryTag": "culture_museums"
          }
        ]
      }
    ]
  },
  "status": "CONFIRMED",
  "created_at": "2024-01-10T09:00:00Z",
  "updated_at": "2024-01-22T16:30:00Z"
}
```

> If no plan has been saved, `plan_json` and `plan_language` will be `null` and `status` will be `CREATED` or `DRAFT`.

### Error Responses

| Status | Code              | Condition                          |
| ------ | ----------------- | ---------------------------------- |
| `400`  | `INVALID_TRIP_ID` | `tripId` is not a positive integer |
| `401`  | `UNAUTHORIZED`    | No valid Supabase session          |
| `403`  | `FORBIDDEN`       | Trip belongs to another user       |
| `404`  | `NOT_FOUND`       | Trip does not exist                |
| `500`  | `INTERNAL_ERROR`  | Unexpected DB or server error      |

---

## 5. Data Flow

```
Component (e.g., TripDetailView)
  │
  ▼
tripStore.fetchTrip(tripId)             [src/stores/trip.store.ts]
  │
  ├─► supabaseClient.auth.getUser()    → validates session, extracts user.id
  │     └─ throw createUnauthorizedError() if no session (401)
  │
  ├─► validateTripId(tripIdStr)        → ensure positive integer
  │     └─ throw createInvalidTripIdError() if invalid (400)
  │
  ▼
getTripById(tripId, userId)             [src/lib/services/trip.service.ts]
  │
  ├─► supabase.from('trips')
  │     .select('*')
  │     .eq('id', tripId)
  │     .single()
  │     RLS enforces auth.uid() = user_id at DB level
  │     └─ throw createNotFoundError() if no row (404)
  │
  ├─► Explicit ownership check: trip.user_id === userId
  │     └─ throw createForbiddenError() if mismatch (403)
  │
  ├─► deriveTripStatus(trip.note_body, trip.plan_json)
  │     └─ returns 'CREATED' | 'DRAFT' | 'CONFIRMED'
  │
  └─► return TripDTO (typed plan_json, computed status)
        │
        ▼
  tripStore.currentTrip = result     → reactive Pinia state updated
```

### Status Derivation

| Status      | Condition                                            |
| ----------- | ---------------------------------------------------- |
| `CREATED`   | `note_body` is null or empty AND `plan_json` is null |
| `DRAFT`     | `note_body` has content AND `plan_json` is null      |
| `CONFIRMED` | `plan_json` is NOT null                              |

---

## 6. Security Considerations

### Authentication

- `supabaseClient.auth.getUser()` must be called first to confirm session validity before trusting `user.id`
- Supabase JS Client automatically attaches the active JWT to every request (no manual token handling needed)
- If no valid session: throw `createUnauthorizedError()` immediately (guard clause, no DB query)

### Authorization — Defense in Depth

| Layer          | Mechanism                                                                              |
| -------------- | -------------------------------------------------------------------------------------- |
| Application    | `auth.getUser()` guard + query filtered by `tripId`                                    |
| Service        | Explicit `trip.user_id === userId` check after fetch                                   |
| Database (RLS) | `USING (auth.uid() = user_id)` — blocks cross-user reads even on misconfigured queries |

### Input Validation

- `tripId` validated as positive integer before any DB query
- Parameterized queries via Supabase client prevent SQL injection

### Threat Mitigation

| Threat                          | Mitigation                                               |
| ------------------------------- | -------------------------------------------------------- |
| SQL Injection                   | Supabase client uses parameterized queries automatically |
| Horizontal Privilege Escalation | RLS policy + explicit ownership check (defense in depth) |
| Session Hijacking               | Short-lived JWTs with auto-refresh (Supabase Auth)       |
| ID Enumeration                  | RLS filters non-owned trips; 404 returned (not 403)      |

---

## 7. Error Handling

**Strategy:** Guard clauses with early returns; happy path last. All errors use factory functions from `src/lib/errors/api.error.ts`.

| Scenario                     | Root Cause                      | Factory                      | HTTP |
| ---------------------------- | ------------------------------- | ---------------------------- | ---- |
| Non-numeric tripId in URL    | `parseInt` returns NaN or ≤ 0   | `createInvalidTripIdError()` | 400  |
| No session / invalid token   | `auth.getUser()` returns null   | `createUnauthorizedError()`  | 401  |
| Trip belongs to another user | `trip.user_id !== userId`       | `createForbiddenError()`     | 403  |
| Trip row not found           | Supabase `.single()` error/null | `createNotFoundError()`      | 404  |
| DB connection failure        | Supabase error (non-PGRST116)   | `createInternalError(msg)`   | 500  |

No `plan_generations` logging for this endpoint.

---

## 8. Performance Considerations

- **Index:** Primary key `trips(id)` — O(1) lookup; RLS filter uses `idx_trips_user_updated(user_id, updated_at DESC)`
- **Single row:** `.single()` adds `LIMIT 1`, minimises data transfer
- **No joins:** Single table query; `plan_json` stored as JSONB, read as-is
- **Caching:** Store `currentTrip` in Pinia. Components should check `tripStore.currentTrip?.id === tripId` before re-fetching
- **Response size:** Small trip ~500 bytes; trip with plan ~5-20 KB (typical). No optimisation needed in MVP

---

## 9. Implementation Steps

> **Note:** Steps 1 and 2 describe code that already exists. Verify the implementations match the spec, then proceed to steps 3–5.

### Step 1 — Verify `trip.service.ts` (ALREADY IMPLEMENTED)

**File:** `src/lib/services/trip.service.ts`

Confirm the following functions exist and match the spec:

```typescript
// Already implemented — verify:
export async function getTripById(tripId: number, userId: string): Promise<TripDTO>
export function deriveTripStatus(noteBody: string | null, planJson: unknown): TripStatus
```

Key checks:

- `getTripById` throws `createNotFoundError()` when Supabase returns error or null
- `getTripById` checks `trip.user_id !== userId` and throws `createForbiddenError()`
- `deriveTripStatus` correctly handles `note_body = ''` (empty string → `CREATED`, not `DRAFT`)

### Step 2 — Verify `tripId` validation in the store

**File:** `src/stores/trip.store.ts`

Ensure `fetchTrip(tripId)` validates the tripId before querying:

```typescript
// Guard clause — add if missing:
function validateTripId(tripIdStr: string | number): number {
  const id = typeof tripIdStr === 'string' ? parseInt(tripIdStr, 10) : tripIdStr
  if (!Number.isInteger(id) || id <= 0) throw createInvalidTripIdError(String(tripIdStr))
  return id
}
```

### Step 3 — Verify RLS policy is active

Confirm the SELECT policy exists in the active migrations:

```sql
CREATE POLICY "Users can view own trips"
  ON trips FOR SELECT
  USING (auth.uid() = user_id);
```

### Step 4 — Guard against redundant fetches in components

In components consuming trip data:

```typescript
// Skip fetch if already loaded
if (!tripStore.currentTrip || tripStore.currentTrip.id !== tripId) {
  await tripStore.fetchTrip(tripId)
}
```

### Step 5 — Manual verification checklist

- [ ] Authenticated user retrieves their own trip (200)
- [ ] Unauthenticated request rejected (401)
- [ ] Invalid tripId (letters, negative, zero) rejected (400)
- [ ] Non-existent tripId returns 404
- [ ] Another user's tripId returns 403 or 404 (RLS may return 404)
- [ ] Trip with no note and no plan returns `status: CREATED`
- [ ] Trip with note but no plan returns `status: DRAFT`
- [ ] Trip with saved plan returns `status: CONFIRMED` and non-null `plan_json`
- [ ] `plan_json` is typed `PlanJson`, not raw `Json`

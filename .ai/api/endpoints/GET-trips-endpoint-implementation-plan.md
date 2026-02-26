# API Endpoint Implementation Plan: GET /api/trips

## 1. Endpoint Overview

Retrieves a paginated, reverse-chronologically sorted (`updated_at DESC`) list of the authenticated user's trips. Each item is a "thin" trip card — no `note_body` or `plan_json` — plus a server-side derived `status` field. An optional `status` query parameter allows filtering by trip lifecycle state.

**Implementation approach:** Standard Supabase JS Client (PostgREST + RLS) — no Edge Function required. DB query logic lives in `src/lib/services/trip.service.ts`; orchestration (auth, state, view mapping) lives in `src/stores/trip.store.ts`.

**Current state:** `fetchTrips` in `trip.store.ts` already covers authentication and pagination flow but is **incomplete** relative to this spec:

- Does not select `destination`, `num_days`, `num_people`
- Does not support the `status` filter parameter
- Maps to `DashboardTripViewModel` (UI model) instead of returning `TripListItemDTO[]` from the service layer
- Duplicates `deriveTripStatus` instead of importing it from `trip.service.ts`

---

## 2. Request Details

- **HTTP Method:** GET
- **URL Structure:** `/api/trips` (maps to a Supabase PostgREST query on `trips`)
- **Path Parameters:** none
- **Query Parameters:**

| Parameter | Type    | Default | Constraints                                   |
| --------- | ------- | ------- | --------------------------------------------- |
| `page`    | integer | `1`     | ≥ 1                                           |
| `limit`   | integer | `20`    | 1–100                                         |
| `status`  | string  | —       | `CREATED` \| `DRAFT` \| `CONFIRMED`, optional |

- **Request Body:** none
- **Headers:**
  - `Authorization: Bearer <supabase_session_token>` — required; Supabase JS Client attaches it automatically

---

## 3. Used Types

All types are defined in `src/types.ts`. No new types need to be created.

### Response DTO — `TripsListDTO`

```typescript
/** Response DTO for GET /api/trips */
export interface TripsListDTO {
  trips: TripListItemDTO[]
  pagination: PaginationDTO
}
```

### Item DTO — `TripListItemDTO`

```typescript
/**
 * Trip list item DTO returned in GET /api/trips response array.
 * Carries just the fields needed for the dashboard card plus computed status.
 */
export interface TripListItemDTO extends Pick<
  Tables<'trips'>,
  | 'id'
  | 'user_id'
  | 'title'
  | 'destination'
  | 'num_days'
  | 'num_people'
  | 'created_at'
  | 'updated_at'
> {
  status: TripStatus
}
```

### Pagination DTO — `PaginationDTO`

```typescript
export interface PaginationDTO {
  current_page: number
  total_pages: number
  total_count: number
  limit: number
}
```

### Query Params Type (new — for internal use)

```typescript
export interface GetTripsQuery {
  page: number // validated, defaults to 1
  limit: number // validated, defaults to 20
  status?: TripStatus
}
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
  "trips": [
    {
      "id": 456,
      "user_id": "uuid-string",
      "title": "Summer in Croatia",
      "destination": "Croatia",
      "num_days": 10,
      "num_people": 4,
      "status": "CONFIRMED",
      "created_at": "2024-01-10T09:00:00Z",
      "updated_at": "2024-01-22T16:30:00Z"
    },
    {
      "id": 455,
      "user_id": "uuid-string",
      "title": "Weekend in Paris",
      "destination": null,
      "num_days": null,
      "num_people": null,
      "status": "DRAFT",
      "created_at": "2024-01-08T12:00:00Z",
      "updated_at": "2024-01-18T10:15:00Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 3,
    "total_count": 45,
    "limit": 20
  }
}
```

### Error Responses

| Status | Code               | Condition                                                             |
| ------ | ------------------ | --------------------------------------------------------------------- |
| `400`  | `VALIDATION_ERROR` | Invalid query params (non-integer, out of range, invalid status enum) |
| `401`  | `UNAUTHORIZED`     | No valid Supabase session                                             |
| `500`  | `INTERNAL_ERROR`   | Unexpected DB or server error                                         |

---

## 5. Data Flow

```
Dashboard View (Vue component)
  │
  ▼
tripStore.fetchTrips(page?, limit?, status?)     [src/stores/trip.store.ts]
  │
  ├─► supabaseClient.auth.getUser()              → validates session, extracts user.id
  │     └─ set tripsError + return if no session (401)
  │
  ├─► validateGetTripsQuery({ page, limit, status })  → Zod schema validation
  │     └─ set tripsError + return if invalid (400)
  │
  ▼
getTrips(userId, { page, limit, status? })       [src/lib/services/trip.service.ts]
  │
  ├─► Build Supabase query base:
  │     supabase.from('trips')
  │       .select('id, user_id, title, destination, num_days, num_people,
  │                note_body, plan_json, created_at, updated_at', { count: 'exact' })
  │       .eq('user_id', userId)          [defense-in-depth on top of RLS]
  │       .order('updated_at', { ascending: false })
  │       .range(from, to)
  │
  ├─► Apply status filter (if provided):
  │     CONFIRMED → .not('plan_json', 'is', null)
  │     DRAFT     → .is('plan_json', null)
  │                  .not('note_body', 'is', null)
  │                  .neq('note_body', '')
  │     CREATED   → .is('plan_json', null)
  │                  .or('note_body.is.null,note_body.eq.')
  │
  ├─► Execute query → raw rows + count
  │     └─ throw createInternalError() on fetchError (500)
  │
  ├─► Map raw rows → TripListItemDTO[] via:
  │     deriveTripStatus(row.note_body, row.plan_json)
  │     (omit note_body + plan_json from output)
  │
  ├─► Compute PaginationDTO:
  │     { current_page, total_pages, total_count, limit }
  │
  └─► return TripsListDTO
        │
        ▼
  tripStore.trips = result.trips             → reactive state (DashboardTripViewModel[])
  tripStore.tripsPagination = result.pagination
```

### Status Derivation (server-side, per row)

| Status      | Condition                                                   |
| ----------- | ----------------------------------------------------------- |
| `CREATED`   | `note_body` is null or empty string AND `plan_json` is null |
| `DRAFT`     | `note_body` has non-empty content AND `plan_json` is null   |
| `CONFIRMED` | `plan_json` is NOT null                                     |

### Status-to-DB Filter Translation

| Status filter | Supabase query conditions                                                  |
| ------------- | -------------------------------------------------------------------------- |
| `CONFIRMED`   | `.not('plan_json', 'is', null)`                                            |
| `DRAFT`       | `.is('plan_json', null).not('note_body', 'is', null).neq('note_body', '')` |
| `CREATED`     | `.is('plan_json', null).or('note_body.is.null,note_body.eq.')`             |

---

## 6. Security Considerations

### Authentication

- `supabaseClient.auth.getUser()` must be called first to confirm session validity
- Supabase JS Client automatically attaches the active JWT to every request
- Guard clause: set error state and return immediately if no valid session (no DB query executed)

### Authorization — Defense in Depth

| Layer          | Mechanism                                                                          |
| -------------- | ---------------------------------------------------------------------------------- |
| Application    | `auth.getUser()` guard before any query                                            |
| Service        | `.eq('user_id', userId)` explicit filter in query                                  |
| Database (RLS) | `USING (auth.uid() = user_id)` SELECT policy — blocks cross-user reads at DB level |

### Input Validation

- `page` and `limit` validated as integers within allowed bounds before computing `range(from, to)`
- `status` validated as a member of the enum before being used in query builder
- Maximum `limit` of 100 prevents excessive memory/bandwidth usage

### Threat Mitigation

| Threat                          | Mitigation                                                      |
| ------------------------------- | --------------------------------------------------------------- |
| SQL Injection                   | Supabase client uses parameterized queries automatically        |
| Horizontal Privilege Escalation | RLS SELECT policy + explicit `.eq('user_id', userId)` filter    |
| Session Hijacking               | Short-lived JWTs with auto-refresh (Supabase Auth)              |
| Parameter Abuse / DoS           | `limit` capped at 100; `page` minimum 1 enforced via Zod        |
| Status Enum Injection           | Zod validates status before translating to DB filter conditions |

---

## 7. Error Handling

**Strategy:** Guard clauses with early returns in the store action; service function throws typed `ApiError` instances; store catches and populates `tripsError` reactive state.

| Scenario                          | Root Cause                            | Factory                     | HTTP |
| --------------------------------- | ------------------------------------- | --------------------------- | ---- |
| No session / invalid token        | `auth.getUser()` returns null user    | `createUnauthorizedError()` | 401  |
| `page` non-integer or < 1         | Zod coercion/min fails                | `createValidationError()`   | 400  |
| `limit` non-integer, < 1 or > 100 | Zod coercion/min/max fails            | `createValidationError()`   | 400  |
| `status` not a valid enum value   | Zod enum validation fails             | `createValidationError()`   | 400  |
| DB connection / query failure     | Supabase returns error on `.select()` | `createInternalError(msg)`  | 500  |

No `plan_generations` table entries for this endpoint.

---

## 8. Performance Considerations

- **Index:** `idx_trips_user_updated ON trips (user_id, updated_at DESC)` — covers the `.eq('user_id', ...).order('updated_at', { ascending: false })` pattern; O(log n) per page
- **Count overhead:** `{ count: 'exact' }` adds a `COUNT(*)` sub-query; this is acceptable for MVP (index-covered). Consider `{ count: 'estimated' }` if count performance degrades at scale
- **Select projection:** Only required columns selected — `note_body` and `plan_json` are fetched for status derivation but **stripped from the DTO before returning** (they can be large)
- **Caching:** Store populates `tripStore.trips` + `tripStore.tripsPagination`; components should check whether page/limit/status match cached state before re-fetching
- **Pagination:** Default 20 items per page; max 100 — response size bounded

---

## 9. Implementation Steps

### Step 1 — Add Zod query schema

**File:** `src/lib/validation/trip.schemas.ts` (create if not exists)

```typescript
import { z } from 'zod'

export const getTripsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['CREATED', 'DRAFT', 'CONFIRMED']).optional()
})

export type GetTripsQueryInput = z.input<typeof getTripsQuerySchema>
export type GetTripsQuery = z.output<typeof getTripsQuerySchema>
```

### Step 2 — Add `getTrips` to `trip.service.ts`

**File:** `src/lib/services/trip.service.ts`

Add the following function after `getTripById`:

```typescript
import type { TripsListDTO, TripListItemDTO, GetTripsQuery } from '@/types'

/**
 * Fetch paginated trips for a user with optional status filter.
 *
 * - Selects only columns needed for TripListItemDTO (+ note_body and plan_json for status derivation)
 * - Translates `status` filter to DB-level note_body / plan_json conditions
 * - Strips note_body and plan_json from returned DTOs
 * - Returns TripsListDTO with computed status on every item
 *
 * @param userId - Authenticated user ID (UUID)
 * @param query  - Validated query params: page, limit, optional status
 */
export async function getTrips(userId: string, query: GetTripsQuery): Promise<TripsListDTO> {
  const { page, limit, status } = query
  const from = (page - 1) * limit
  const to = from + limit - 1

  // Build base query — select only needed columns
  let q = supabaseClient
    .from('trips')
    .select(
      'id, user_id, title, destination, num_days, num_people, note_body, plan_json, created_at, updated_at',
      { count: 'exact' }
    )
    .eq('user_id', userId) // defense-in-depth (RLS already filters by user)
    .order('updated_at', { ascending: false })
    .range(from, to)

  // Translate status filter to DB column conditions
  if (status === 'CONFIRMED') {
    q = q.not('plan_json', 'is', null)
  } else if (status === 'DRAFT') {
    q = q.is('plan_json', null).not('note_body', 'is', null).neq('note_body', '')
  } else if (status === 'CREATED') {
    q = q.is('plan_json', null).or('note_body.is.null,note_body.eq.')
  }

  const { data, error: fetchError, count } = await q

  if (fetchError) {
    throw createInternalError(`Failed to fetch trips: ${fetchError.message}`)
  }

  const rows = data ?? []
  const trips: TripListItemDTO[] = rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    destination: row.destination,
    num_days: row.num_days,
    num_people: row.num_people,
    created_at: row.created_at,
    updated_at: row.updated_at,
    status: deriveTripStatus(row.note_body, row.plan_json)
  }))

  const total = count ?? 0
  return {
    trips,
    pagination: {
      current_page: page,
      total_pages: Math.max(1, Math.ceil(total / limit)),
      total_count: total,
      limit
    }
  }
}
```

### Step 3 — Refactor `fetchTrips` in `trip.store.ts`

**File:** `src/stores/trip.store.ts`

Update `fetchTrips` to:

1. Accept an optional `status` parameter
2. Validate query params using `getTripsQuerySchema`
3. Delegate to the new `getTrips` service function
4. Map `TripListItemDTO[]` to `DashboardTripViewModel[]` in the store (UI mapping stays in the store layer)
5. Remove the inline duplicate of `deriveTripStatus`

```typescript
import { getTripsQuerySchema } from '@/lib/validation/trip.schemas'
import { getTrips } from '@/lib/services/trip.service'
import { deriveTripStatus } from '@/lib/services/trip.service' // remove local duplicate

// Remove the local deriveTripStatus function — import from service instead

async function fetchTrips(page = 1, limit = 20, status?: TripStatus): Promise<void> {
  isLoadingTrips.value = true
  tripsError.value = null

  try {
    const {
      data: { user }
    } = await supabaseClient.auth.getUser()
    if (!user) {
      tripsError.value = createUnauthorizedError().toResponse()
      return
    }

    // Validate query params with Zod
    const queryResult = getTripsQuerySchema.safeParse({ page, limit, status })
    if (!queryResult.success) {
      const details = Object.fromEntries(
        queryResult.error.issues.map((i) => [i.path.join('.'), i.message])
      )
      tripsError.value = createValidationError('Invalid query parameters', details).toResponse()
      return
    }

    const result = await getTrips(user.id, queryResult.data)

    // Map TripListItemDTO → DashboardTripViewModel for UI consumption
    trips.value = result.trips.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      notePreview: '', // note_body not included in TripListItemDTO
      updatedAt: item.updated_at
    }))

    tripsPagination.value = result.pagination
  } catch (err: any) {
    tripsError.value = {
      error: {
        code: err.code || 'FETCH_ERROR',
        message: err.message || 'Failed to fetch trips'
      }
    }
  } finally {
    isLoadingTrips.value = false
  }
}
```

> **Note on `notePreview`:** The `DashboardTripViewModel.notePreview` field cannot be populated from `TripListItemDTO` (note_body is excluded from the list API). If `notePreview` is needed in the UI, either: (a) accept that it will be empty in the list view, (b) add `note_body` to the Supabase select but still exclude it from `TripListItemDTO`, keeping it internal for preview mapping only. Discuss with the team which approach aligns with UI requirements.

### Step 4 — Add `GetTripsQuery` to `src/types.ts`

**File:** `src/types.ts`

Add under the Pagination section:

```typescript
/** Query parameters for GET /api/trips (after Zod validation and defaults applied). */
export interface GetTripsQuery {
  page: number
  limit: number
  status?: TripStatus
}
```

### Step 5 — Verify RLS SELECT policy is active

Confirm the policy exists in the applied migrations:

```sql
CREATE POLICY "Users can view own trips"
  ON trips FOR SELECT
  USING (auth.uid() = user_id);
```

### Step 6 — Manual verification checklist

- [ ] Authenticated user fetches their trips — returns `200` with `trips` array and `pagination`
- [ ] Unauthenticated request returns `401` (no trips query executed)
- [ ] `page=0` or `page=-1` returns `400` with `VALIDATION_ERROR`
- [ ] `limit=0` or `limit=101` returns `400` with `VALIDATION_ERROR`
- [ ] `status=invalid` returns `400` with `VALIDATION_ERROR`
- [ ] `status=CONFIRMED` filters to only trips with `plan_json IS NOT NULL`
- [ ] `status=DRAFT` filters to trips with note but no plan
- [ ] `status=CREATED` filters to trips with no note and no plan
- [ ] No `status` param returns all trips (no filter applied)
- [ ] `updated_at DESC` sort order is preserved across pages
- [ ] `total_count` reflects filtered count when `status` is set
- [ ] Empty results return `trips: []` and `pagination.total_count: 0`, not a 404
- [ ] Each trip item includes `destination`, `num_days`, `num_people` (can be null)
- [ ] Each trip item does NOT expose `note_body` or `plan_json`
- [ ] User cannot see another user's trips (RLS enforcement)

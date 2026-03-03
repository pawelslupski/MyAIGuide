# API Endpoint Implementation Plan: POST /api/trips

## 1. Endpoint Overview

Creates a new trip for the authenticated user. Preference fields (`what`, `speed`, `type`, `budget`) are optional — when omitted they are copied from the user's current profile defaults. Only `title` is required. Returns the full created `TripDTO` with status `CREATED`.

**Implementation approach:** Standard Supabase JS Client (PostgREST + RLS) — no Edge Function required. DB logic lives in `src/lib/services/trip.service.ts` (`createTrip`); orchestration (auth, validation, profile-defaults resolution, state) lives in `src/stores/trip.store.ts`.

**Status:** **Implemented.** `createTrip` in `trip.service.ts` inserts all fields; profile-defaults resolution lives in the store action.

**UX approach (Option A — inline creation):** `DashboardView` always calls `tripStore.createTrip({ title: 'New Trip' })` and immediately navigates to `/trips/:id`. The user renames and fills in details in the trip detail view. There is no creation dialog or `/trips/new` route.

---

## 2. Request Details

- **HTTP Method:** POST
- **URL Structure:** `/api/trips`
- **Path Parameters:** none
- **Query Parameters:** none
- **Request Body:**

```json
{
  "title": "Weekend in Paris",
  "destination": null,
  "num_days": null,
  "num_people": null,
  "what": ["culture_museums", "foodie"],
  "speed": "intensive",
  "type": "base",
  "budget": "luxury",
  "note_body": null
}
```

**Validation rules:**

- `title`: required, non-empty, max 255 characters
- `destination`: optional (nullable), max 50 characters
- `num_days`: null or integer 1–30
- `num_people`: null or integer 1–20
- `what`: array, each value in `nature | culture_museums | beach_relax | city_break | foodie`
- `speed`: `slow_chill | balance | intensive` or null/omitted
- `type`: `base | base_with_trips | roadtrip` or null/omitted
- `budget`: `budget | moderate | luxury` or null/omitted
- `note_body`: null or string max 10,000 characters

---

## 3. Used Types

All types in `src/types.ts`.

### Command Model — `CreateTripCommand` (already exists)

```typescript
export interface CreateTripCommand {
  title: string
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

Full trip object with computed `status: "CREATED"` (note_body and plan_json will both be null initially).

---

## 4. Response Details

### Success — `201 Created`

```json
{
  "id": 457,
  "user_id": "uuid-string",
  "title": "Weekend in Paris",
  "destination": null,
  "num_days": null,
  "num_people": null,
  "what": ["culture_museums", "foodie"],
  "speed": "intensive",
  "type": "base",
  "budget": "luxury",
  "note_body": null,
  "plan_language": null,
  "plan_json": null,
  "status": "CREATED",
  "created_at": "2024-01-23T10:00:00Z",
  "updated_at": "2024-01-23T10:00:00Z"
}
```

### Error Responses

| HTTP Code | Error Code         | Condition                                        |
| --------- | ------------------ | ------------------------------------------------ |
| `400`     | `VALIDATION_ERROR` | Missing title, invalid enum, note too long, etc. |
| `401`     | `UNAUTHORIZED`     | No valid Supabase session                        |
| `500`     | `INTERNAL_ERROR`   | DB insert failure                                |

---

## 5. Data Flow

```
DashboardView (Vue component)
  │  always calls: tripStore.createTrip({ title: 'New Trip' })
  │  (user renames title and fills details in the trip detail view)
  ▼
tripStore.createTrip(command: CreateTripCommand)     [src/stores/trip.store.ts]
  │
  ├─► supabaseClient.auth.getUser()
  │     └─ null → throw createUnauthorizedError() (401)
  │
  ├─► validateCreateTripCommand(command)   [trip.schemas.ts]
  │     └─ ZodError → throw createValidationError(msg, details) (400)
  │
  ├─► Resolve preference defaults (if fields omitted):
  │     profile.service.ts :: getProfile(userId)
  │     Apply: what = command.what ?? profile.default_what
  │            speed = command.speed ?? profile.default_speed
  │            type = command.type ?? profile.default_type
  │            budget = command.budget ?? profile.default_budget
  │
  ▼
trip.service.ts :: createTrip(command, userId)
  │
  ├─► supabase.from('trips')
  │     .insert({ title, user_id, destination, num_days, num_people,
  │               what, speed, type, budget, note_body })
  │     .select('*').single()
  │     └─ error → throw createInternalError(msg) (500)
  │
  ├─► deriveTripStatus(row.note_body, row.plan_json) → 'CREATED'
  │
  └─► return TripDTO
        │
        ▼
  tripStore: prepend new DashboardTripViewModel to trips.value; route to /trips/:id
```

---

## 6. Security Considerations

### Authentication

- `auth.getUser()` called first; no DB interaction without a valid session.

### Authorization

- `user_id` is set from the authenticated session — not from the request body. Clients cannot create trips for other users.
- RLS `INSERT` policy enforces `auth.uid() = user_id` at the DB level.

### Input Validation

- `title` max 255 prevents oversized strings in the DB.
- `note_body` max 10,000 aligns with the plan-generation validation contract.
- Enum validation prevents arbitrary strings being stored in preference columns.

---

## 7. Error Handling

| Scenario                          | Root Cause                            | Factory                     | HTTP |
| --------------------------------- | ------------------------------------- | --------------------------- | ---- |
| No session / invalid token        | `auth.getUser()` returns null         | `createUnauthorizedError()` | 401  |
| Missing or empty `title`          | Zod `min(1)` fails                    | `createValidationError()`   | 400  |
| `title` > 255 characters          | Zod `max(255)` fails                  | `createValidationError()`   | 400  |
| `destination` > 50 characters     | Zod `max(50)` fails                   | `createValidationError()`   | 400  |
| `num_days` out of range           | Zod `int().min(1).max(30)` fails      | `createValidationError()`   | 400  |
| `num_people` out of range         | Zod `int().min(1).max(20)` fails      | `createValidationError()`   | 400  |
| Invalid enum value in preferences | Zod enum check fails                  | `createValidationError()`   | 400  |
| `note_body` > 10,000 characters   | Zod `max(10000)` fails                | `createValidationError()`   | 400  |
| DB insert failure                 | Supabase returns error on `.insert()` | `createInternalError()`     | 500  |

---

## 8. Performance Considerations

- **Single insert + select:** One round-trip to Supabase using `.insert().select().single()` — no extra fetch.
- **Profile fetch for defaults:** Only needed when one or more preference fields are omitted; the store should pass the already-loaded `profile.value` rather than refetching.
- **`updated_at` trigger:** Fires automatically on insert — no application-level timestamp management.

---

## 9. Implementation Steps

### Step 1 — Add `CreateTripCommandSchema` to `trip.schemas.ts`

**File:** `src/lib/validation/trip.schemas.ts`

```typescript
export const CreateTripCommandSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  destination: z.string().max(50).nullable().optional(),
  num_days: z.number().int().min(1).max(30).nullable().optional(),
  num_people: z.number().int().min(1).max(20).nullable().optional(),
  what: z.array(WhatPreferenceSchema).optional(),
  speed: z.enum(['slow_chill', 'balance', 'intensive']).nullable().optional(),
  type: z.enum(['base', 'base_with_trips', 'roadtrip']).nullable().optional(),
  budget: z.enum(['budget', 'moderate', 'luxury']).nullable().optional(),
  note_body: z.string().max(10000).nullable().optional()
})

export function validateCreateTripCommand(data: unknown) {
  return CreateTripCommandSchema.parse(data)
}
```

### Step 2 — Extend `createTrip` in `trip.service.ts` to insert all fields

**File:** `src/lib/services/trip.service.ts`

The current implementation only inserts `title` and `user_id`. Extend it:

```typescript
export async function createTrip(command: CreateTripCommand, userId: string): Promise<TripDTO> {
  const { data, error } = await supabaseClient
    .from('trips')
    .insert({
      title: command.title,
      user_id: userId,
      destination: command.destination ?? null,
      num_days: command.num_days ?? null,
      num_people: command.num_people ?? null,
      what: command.what ?? [],
      speed: command.speed ?? null,
      type: command.type ?? null,
      budget: command.budget ?? null,
      note_body: command.note_body ?? null
    })
    .select('*')
    .single()

  if (error || !data) {
    throw createInternalError(`Failed to create trip: ${error?.message ?? 'Unknown error'}`)
  }

  return {
    ...data,
    what: data.what as WhatPreference[],
    plan_json: data.plan_json as PlanJson | null,
    speed: data.speed as SpeedPreference | null,
    type: data.type as TypePreference | null,
    budget: data.budget as BudgetPreference | null,
    status: deriveTripStatus(data)
  }
}
```

### Step 3 — Add `createTrip` action to `trip.store.ts`

**File:** `src/stores/trip.store.ts`

```typescript
async function createTrip(command: CreateTripCommand): Promise<TripDTO> {
  try {
    const {
      data: { user }
    } = await supabaseClient.auth.getUser()
    if (!user) throw createUnauthorizedError()

    const validated = validateCreateTripCommand(command)

    // Apply profile defaults for omitted preference fields
    const profile = profileStore.profile
    const resolved: CreateTripCommand = {
      ...validated,
      what: validated.what ?? profile?.default_what ?? [],
      speed: validated.speed ?? profile?.default_speed ?? null,
      type: validated.type ?? profile?.default_type ?? null,
      budget: validated.budget ?? profile?.default_budget ?? null
    }

    const newTrip = await createTripService(resolved, user.id)
    trips.value = [newTrip, ...trips.value]
    return newTrip
  } catch (err: unknown) {
    const apiErr = toApiError(err)
    tripsError.value = apiErr.toResponse()
    throw apiErr
  }
}
```

### Step 4 — Manual verification checklist

- [x] `POST` with only `title: 'New Trip'` (dashboard default) creates a trip with profile defaults applied to preferences (`201`)
- [x] `POST` with all fields creates a trip using the provided values (`201`)
- [ ] Missing `title` returns `400` with `details.title`
- [ ] `title` > 255 chars returns `400`
- [ ] `note_body` > 10,000 chars returns `400`
- [ ] Invalid enum value in `speed`/`type`/`budget` returns `400`
- [ ] `num_days: 0` or `num_days: 31` returns `400`
- [ ] Unauthenticated request returns `401`
- [ ] Created trip appears at the top of the trip list (`updated_at DESC` sort)
- [ ] `plan_json` and `plan_language` are `null`; `status` is `CREATED`
- [ ] RLS prevents inserting a trip with another user's `user_id` in the body

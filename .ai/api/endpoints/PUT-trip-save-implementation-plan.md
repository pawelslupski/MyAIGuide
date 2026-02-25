# API Endpoint Implementation Plan: PUT /api/trips/{tripId}/plan

## 1. Endpoint Overview

Persists the in-memory plan candidate to the database. Updates `trips.plan_json` and `trips.plan_language`, overwriting any previously saved plan (1:1 relationship). After saving, trip status transitions to `CONFIRMED`.

**Implementation approach:** Supabase JS Client (PostgREST + RLS) — no Edge Function required. Core DB logic lives in `src/lib/services/trip.service.ts`; orchestration (auth, state, candidate clearing) lives in `src/stores/plan.store.ts`.

**Status of implementation steps:** The service function (`savePlanToTrip`), Zod schema (`SavePlanCommandSchema`), and all error factories are **already implemented**. Steps below focus on verification and one remaining gap.

---

## 2. Request Details

- **HTTP Method:** PUT
- **URL Structure:** `/api/trips/{tripId}/plan`
- **Path Parameters:**
  - `tripId` (required): positive integer
- **Request Body:**

```json
{
  "plan_json": {
    "days": [
      {
        "day": 1,
        "activities": [
          {
            "timeOfDay": "morning",
            "locationName": "Wawel Castle",
            "description": "Visit the historic royal castle",
            "categoryTag": "culture_museums"
          }
        ]
      }
    ]
  },
  "plan_language": "pl"
}
```

- **Validation Rules:**
  - `plan_json`: required — valid JSON object with a `days` array (≥1 day, each day ≥1 activity)
  - `plan_language`: required — 2-10 character language code matching `/^[a-z]{2,10}$/i`
  - Each activity must have: `timeOfDay` (`morning|afternoon|evening`), `locationName` (string), `description` (string), `categoryTag` (valid `WhatPreference`)

---

## 3. Used Types

All types are defined in `src/types.ts`.

### Input Command Model — `SavePlanCommand` (already exists)

```typescript
export interface SavePlanCommand {
  plan_json: PlanJson
  plan_language: string
}
```

### Response DTO — `TripDTO` (already exists)

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
  status: TripStatus // computed — never stored in DB; will be 'CONFIRMED' after save
}
```

### Validation Schema — `SavePlanCommandSchema` (already exists)

Defined in `src/lib/validation/plan.schemas.ts`:

```typescript
export const SavePlanCommandSchema = z.object({
  plan_json: PlanJsonSchema,
  plan_language: z
    .string()
    .min(1)
    .max(10)
    .regex(/^[a-z]{2,10}$/i, 'Must be a valid language code')
})

export function validateSavePlanCommand(data: unknown) {
  return SavePlanCommandSchema.parse(data)
}
```

---

## 4. Response Details

### Success — `200 OK`

Returns full updated `TripDTO` with `plan_json` populated and `status: "CONFIRMED"`:

```json
{
  "id": 456,
  "user_id": "uuid-string",
  "title": "Summer in Croatia",
  "destination": "Croatia",
  "num_days": 10,
  "num_people": 4,
  "what": ["culture_museums", "beach_relax"],
  "speed": "balance",
  "type": "roadtrip",
  "budget": "moderate",
  "note_body": "Planning a 10-day trip...",
  "plan_language": "pl",
  "plan_json": { "days": [...] },
  "status": "CONFIRMED",
  "created_at": "2024-01-10T09:00:00Z",
  "updated_at": "2024-01-23T12:15:00Z"
}
```

### Error Responses

| Status | Code               | Condition                                        |
| ------ | ------------------ | ------------------------------------------------ |
| `400`  | `VALIDATION_ERROR` | Invalid `plan_json` structure or `plan_language` |
| `401`  | `UNAUTHORIZED`     | No valid session                                 |
| `403`  | `FORBIDDEN`        | Trip belongs to another user                     |
| `404`  | `NOT_FOUND`        | Trip does not exist                              |
| `500`  | `INTERNAL_ERROR`   | DB update failure                                |

---

## 5. Data Flow

```
Component (e.g., PlanView.vue)
  │
  ▼
planStore.savePlanToTrip(tripId)         [src/stores/plan.store.ts]
  │
  ├─► Guard: planCandidate.value !== null → throw if no candidate to save
  │
  ├─► supabaseClient.auth.getUser()     → extract userId; throw error if null
  │
  ▼
savePlanToTrip(tripId, userId, plan, language)  [src/lib/services/trip.service.ts]
  │
  ├─► validateSavePlanCommand({ plan_json, plan_language })
  │     [src/lib/validation/plan.schemas.ts]
  │     └─ ZodError → throw createValidationError() (400)
  │
  ├─► supabase.from('trips').select('*').eq('id', tripId).single()
  │     RLS enforces auth.uid() = user_id at DB level
  │     └─ error/null → throw createNotFoundError() (404)
  │
  ├─► Explicit ownership check: trip.user_id === userId
  │     └─ mismatch → throw createForbiddenError() (403)
  │
  ├─► supabase.from('trips')
  │     .update({ plan_json, plan_language })
  │     .eq('id', tripId)
  │     .select().single()
  │     └─ error → throw createInternalError() (500)
  │
  ├─► deriveTripStatus(updatedTrip.note_body, updatedTrip.plan_json)
  │     → returns 'CONFIRMED' (plan_json is now non-null)
  │
  └─► return TripDTO
        │
        ▼
  planStore:
    tripStore.currentTrip = updatedTrip   → update trip state
    planCandidate.value = null            → clear candidate
```

---

## 6. Security Considerations

### Authentication

- `supabaseClient.auth.getUser()` called before any DB write
- No valid session → stop immediately, no DB interaction

### Authorization — Defense in Depth

| Layer          | Mechanism                                                                        |
| -------------- | -------------------------------------------------------------------------------- |
| Application    | `auth.getUser()` guard + explicit `trip.user_id === userId` check                |
| Database (RLS) | `USING (auth.uid() = user_id)` — prevents cross-user writes even if app has bugs |

### Data Validation

- `plan_json` validated with Zod schema before the DB write — prevents malformed JSON being persisted
- `plan_language` validated as a short alphanumeric code
- Supabase client uses parameterized queries — no SQL injection risk

### XSS Prevention

- Store raw data in DB; sanitize/escape on render (Vue auto-escapes template expressions)

---

## 7. Error Handling

**Strategy:** Guard clauses with early returns in the service layer. All errors use factory functions from `src/lib/errors/api.error.ts`.

| Scenario                       | Root Cause                          | Factory                   | HTTP |
| ------------------------------ | ----------------------------------- | ------------------------- | ---- |
| No plan candidate in store     | `planCandidate.value === null`      | `new Error()` in store    | —    |
| No session                     | `auth.getUser()` returns null       | (store-level guard)       | 401  |
| Invalid `plan_json` structure  | Zod parse fails in service          | `createValidationError()` | 400  |
| Invalid `plan_language` format | Zod parse fails in service          | `createValidationError()` | 400  |
| Trip not found                 | `.single()` returns PGRST116 / null | `createNotFoundError()`   | 404  |
| Trip belongs to another user   | `trip.user_id !== userId`           | `createForbiddenError()`  | 403  |
| DB update failure              | Supabase `updateError`              | `createInternalError()`   | 500  |

Zod errors are mapped to field-specific `details` before being wrapped in `createValidationError()`:

```typescript
catch (error) {
  if (error instanceof ZodError) {
    const details: Record<string, string> = {}
    error.issues.forEach(issue => {
      details[issue.path.join('.')] = issue.message
    })
    throw createValidationError('Invalid plan data', details)
  }
  throw error
}
```

No `plan_generations` logging for this endpoint (only AI generation attempts are recorded there).

---

## 8. Performance Considerations

- **Two DB round-trips:** fetch-for-ownership-check + update. Could be combined into `.update().eq('user_id', userId)` (skipping the separate fetch), but explicit fetch gives a clearer 403 vs 404 distinction — acceptable trade-off.
- **JSONB storage:** PostgreSQL stores `plan_json` as JSONB efficiently; no additional serialization needed.
- **`updated_at` trigger:** The `update_trips_updated_at` trigger fires automatically on every UPDATE — no application-level timestamp management required.
- **Concurrency:** Last write wins (acceptable for MVP). Future: consider optimistic locking with a `version` field.

---

## 9. Implementation Steps

> Most items are already implemented. Steps are ordered: verification first, then the one remaining gap.

### Step 1 — Verify `savePlanToTrip` in trip.service.ts (ALREADY IMPLEMENTED)

**File:** `src/lib/services/trip.service.ts`

Confirm the function:

1. Calls `validateSavePlanCommand()` and catches `ZodError` → `createValidationError()`
2. Fetches trip with `.single()` → throws `createNotFoundError()` on error/null
3. Checks `trip.user_id !== userId` → throws `createForbiddenError()`
4. Updates `plan_json` and `plan_language`, returns typed `TripDTO`
5. Calls `deriveTripStatus()` on the updated row

### Step 2 — Verify `SavePlanCommandSchema` (ALREADY IMPLEMENTED)

**File:** `src/lib/validation/plan.schemas.ts`

Confirm schema validates:

- `plan_json.days` is array with ≥1 entry
- Each day has `day: positive integer` and `activities: array with ≥1 entry`
- Each activity has all required string fields and valid `categoryTag` enum value
- `plan_language` matches `/^[a-z]{2,10}$/i` and is max 10 chars

### Step 3 — Verify store clears `planCandidate` after save (ALREADY IMPLEMENTED)

**File:** `src/stores/plan.store.ts`

After `savePlanService()` resolves successfully:

- `tripStore.currentTrip` is updated with the new `TripDTO`
- `planCandidate.value = null` — candidate is cleared
- `generationError.value = null` — error state is reset

### Step 4 — Add error factory for store-level auth guard (GAP — minor)

**File:** `src/stores/plan.store.ts`

The current `savePlanToTrip` action throws a plain `Error('User not authenticated')` when `auth.getUser()` returns null. Align with the project's error pattern:

```typescript
// Replace:
if (!user) throw new Error('User not authenticated')

// With:
if (!user) throw createUnauthorizedError()
```

Then in the catch block, use `toApiError(err)` to convert to `saveError.value`.

### Step 5 — Verify RLS policies are active

```sql
-- Users can update only their own trips
CREATE POLICY "Users can update own trips"
  ON trips FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Step 6 — Manual verification checklist

- [ ] Authenticated user with a plan candidate can save it (200)
- [ ] Returned `TripDTO` has `status: "CONFIRMED"` and non-null `plan_json`
- [ ] `planStore.planCandidate` is null after successful save
- [ ] `tripStore.currentTrip` reflects the updated trip
- [ ] Saving with invalid `plan_json` structure returns 400 with `details`
- [ ] Saving with invalid `plan_language` (too long, wrong charset) returns 400
- [ ] Unauthenticated request returns 401
- [ ] Another user's `tripId` returns 403
- [ ] Non-existent `tripId` returns 404
- [ ] Overwriting an existing plan succeeds (1:1 relationship — second save also returns 200)
- [ ] `trips.updated_at` is automatically updated by the DB trigger

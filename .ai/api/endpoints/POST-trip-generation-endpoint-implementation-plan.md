# API Endpoint Implementation Plan: POST /api/trips/{tripId}/generate-plan

## 1. Endpoint Overview

Generates an AI-powered travel plan for a trip. The plan is returned to the client but **not persisted** — it is stored in Pinia state as a temporary candidate until the user explicitly saves it via `PUT /api/trips/{tripId}/plan`.

**Implementation approach:** Implemented as a Supabase Edge Function (`generate-plan`) called from the Pinia store via `supabaseClient.functions.invoke()`. The Edge Function calls OpenRouter.ai server-side (API key never exposed to the browser).

**Key files already implemented:**

- `src/lib/services/generation.service.ts` — quota check, language detection, AI prompt building, Edge Function call, generation recording
- `src/stores/plan.store.ts` — orchestration, state management, trip/profile data assembly
- `src/lib/validation/plan.schemas.ts` — `PlanJsonSchema`, `EdgeFunctionResponseSchema`, `validateAIResponse()`

**Key gaps to address:** See Implementation Steps.

---

## 2. Request Details

- **HTTP Method:** POST
- **URL Structure:** `/api/trips/{tripId}/generate-plan`
- **Path Parameters:**
  - `tripId` (required): positive integer
- **Request Body:** none (server reads trip and profile directly from DB)
- **Headers:**
  - `Authorization: Bearer <supabase_session_token>` — required

---

## 3. Used Types

All types are defined in `src/types.ts`.

### Response DTO — `GeneratedPlanDTO`

```typescript
export interface GeneratedPlanDTO {
  plan: PlanJson
  language: string
  model_used: string
  generated_at: string // ISO 8601 timestamp
  quota: GenerationQuotaDTO // updated quota snapshot (saves extra round-trip)
}

export interface GenerationQuotaDTO {
  used: number
  limit: number
  remaining: number
  reset_at: string // ISO 8601 timestamp
}
```

### Internal Command Models

**`GeneratePlanCommand`** — internal aggregated context for AI prompt:

```typescript
export interface GeneratePlanCommand {
  userId: string
  tripId: number
  destination: string // validated non-null before this is constructed
  noteBody: string
  userProfile: {
    hasKids: boolean
    hasPets: boolean
    hasMobilityIssues: boolean
    hasDietaryPreferences: boolean
    dietaryPreferencesDescription: string | null // included verbatim in prompt when non-null
  }
  tripPreferences: TripPreferencesDto
}
```

**`QuotaCheckResult`** — returned by `checkGenerationQuota()`:

```typescript
export interface QuotaCheckResult {
  allowed: boolean
  used: number
  limit: number
  resetAt: string // ISO 8601 — 24h from oldest counted generation
}
```

**`AIPlanParams`** — passed to `callAIService()`:

```typescript
export interface AIPlanParams {
  language: string
  noteBody: string
  destination: string
  userProfile: {
    hasKids: boolean
    hasPets: boolean
    hasMobilityIssues: boolean
    hasDietaryPreferences: boolean
    dietaryPreferencesDescription: string | null
  }
  tripPreferences: TripPreferencesDto
}
```

**`RecordGenerationParams`** — passed to `recordGenerationAttempt()`:

```typescript
export interface RecordGenerationParams {
  userId: string
  tripId: number
  status: 'success' | 'api_error' | 'validation_error'
  modelName?: string
  errorMessage?: string
}
```

---

## 4. Response Details

### Success — `200 OK`

```json
{
  "plan": {
    "days": [
      {
        "day": 1,
        "activities": [
          {
            "timeOfDay": "morning",
            "locationName": "Wawel Castle",
            "description": "Visit the historic royal castle and cathedral on the Vistula River",
            "categoryTag": "culture_museums"
          }
        ]
      }
    ]
  },
  "language": "pl",
  "model_used": "anthropic/claude-3.5-sonnet",
  "generated_at": "2024-01-23T12:00:00Z",
  "quota": {
    "used": 4,
    "limit": 10,
    "remaining": 6,
    "reset_at": "2024-01-24T10:00:00Z"
  }
}
```

> The plan is **not** written to `trips.plan_json`. The client stores it in Pinia state temporarily.

### Error Responses

| Status | Code               | Condition                                             |
| ------ | ------------------ | ----------------------------------------------------- |
| `400`  | `INVALID_TRIP_ID`  | `tripId` is not a positive integer                    |
| `400`  | `VALIDATION_ERROR` | `destination` is null or empty on the trip            |
| `400`  | `VALIDATION_ERROR` | `note_body` exceeds 10,000 characters                 |
| `401`  | `UNAUTHORIZED`     | No valid session                                      |
| `403`  | `FORBIDDEN`        | Trip belongs to another user                          |
| `404`  | `NOT_FOUND`        | Trip does not exist                                   |
| `422`  | `VALIDATION_ERROR` | AI response failed structural validation (Zod)        |
| `429`  | `QUOTA_EXCEEDED`   | 10 generations used and 24-hour cooldown still active |
| `502`  | `AI_API_ERROR`     | OpenRouter.ai call failed (timeout, upstream error)   |

**429 example:**

```json
{
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "You have reached the limit of 10 plan generations in 24 hours",
    "details": { "used": 10, "limit": 10, "reset_at": "2024-01-24T10:00:00Z" }
  }
}
```

**502 example:**

```json
{
  "error": {
    "code": "AI_API_ERROR",
    "message": "Failed to generate plan. Please try again.",
    "details": { "reason": "API timeout" }
  }
}
```

---

## 5. Data Flow

```
Component (e.g., TripDetailView)
  │
  ▼
planStore.generatePlan(tripId)           [src/stores/plan.store.ts]
  │
  ├─► auth.getUser()                    → extract userId; throw UNAUTHORIZED if null
  ├─► validateTripId(tripId)            → throw INVALID_TRIP_ID (400) if invalid
  │
  ├─► getTripById(tripId, userId)       [trip.service.ts]
  │     └─ throw NOT_FOUND (404) if trip missing
  │     └─ throw FORBIDDEN (403) if wrong owner
  │
  ├─► Guard: trip.destination non-null/non-empty
  │     └─ throw VALIDATION_ERROR (400) if missing
  │
  ├─► Guard: trip.note_body length ≤ 10,000 chars
  │     └─ throw VALIDATION_ERROR (400) if exceeded
  │
  ├─► checkGenerationQuota(userId)      [generation.service.ts] — client-side pre-check (informational)
  │     └─ throw QUOTA_EXCEEDED (429) if used ≥ 10
  │
  ├─► fetchProfile(userId)              → get traveler flags for prompt
  │
  ├─► language = i18n.global.locale      [plan.store.ts]
  │     → active UI locale ('pl' | 'en') from vue-i18n singleton
  │
  ▼
  callAIService(params)                 → supabaseClient.functions.invoke('generate-plan', …)
  │
  ▼
Edge Function: generate-plan           [supabase/functions/generate-plan/index.ts]
  │
  ├─► auth.getUser()                    → validates JWT server-side
  ├─► Parse + validate body (tripId, prompt, language)
  │
  ├─► rpc('try_reserve_generation_slot', { p_trip_id })   ← ATOMIC via advisory lock
  │     DB function acquires pg_advisory_xact_lock(hashtext(user_id))
  │     Counts status IN ('success','api_error') + non-stale 'pending' (< 90 s)
  │     Applies fixed-batch cooldown logic
  │     If within limit: INSERT pending → returns reservation_id
  │     └─ raises P0429 QUOTA_EXCEEDED → return 429 to client
  │
  ├─► callOpenRouterAPI(request)        → OpenRouter.ai (server-side API key)
  │     └─ on error: rpc('finalize_generation_slot', { reservation_id, 'api_error', … })
  │                  return 502 / 401 / 429 / 504 / 503
  │
  ├─► parseOpenRouterResponse(response)
  │     └─ on parse error: rpc('finalize_generation_slot', { reservation_id, 'api_error', … })
  │                        return 502
  │
  ├─► rpc('finalize_generation_slot', { reservation_id, 'success', model_used })
  │
  └─► return { plan, model_used }
        │
        ▼
  planStore: validateAIResponse(data)  [plan.schemas.ts]
    └─ on ZodError: recordGenerationAttempt(validation_error), throw 422
  planStore: fetchGenerationQuota()    → refresh quota display
  planStore.planCandidate = GeneratedPlanDTO
```

### plan_generations Recording Rules

| `status`           | When recorded                                      | `model_name` | `error_message` | Counts toward quota?  |
| ------------------ | -------------------------------------------------- | ------------ | --------------- | --------------------- |
| `pending`          | Slot reserved atomically before AI call starts     | null         | null            | ✅ Yes (while active) |
| `success`          | AI responded with valid plan (pending → finalized) | Set          | null            | ✅ Yes                |
| `api_error`        | OpenRouter call failed (pending → finalized)       | null/set     | Error details   | ✅ Yes                |
| `validation_error` | Pre-validation failed (destination/length)         | null         | Validation msg  | ❌ No                 |

**Not recorded:** auth failures (401), ownership failures (403), trip-not-found (404), quota-exceeded (429), invalid tripId (400).

**Stale pending:** A `pending` record that is never finalized (e.g. Edge Function crash) stops counting toward the
quota after 90 seconds and is effectively ignored in all subsequent quota checks.

---

## 6. Security Considerations

### Authentication & Authorization

- Session validated via `supabaseClient.auth.getUser()` before any DB query
- Trip ownership enforced via RLS + explicit `trip.user_id === userId` check
- OpenRouter.ai API key stored in Supabase Edge Function secrets — never sent to browser

### Input Validation

| Check                 | Rule                                        | Error |
| --------------------- | ------------------------------------------- | ----- |
| `tripId` format       | Positive integer                            | 400   |
| `destination` on trip | Non-null, non-empty string                  | 400   |
| `note_body` on trip   | null or max 10,000 characters (no minimum)  | 400   |
| AI response structure | Validated with `EdgeFunctionResponseSchema` | 422   |
| `categoryTag` values  | Must be valid `WhatPreference` enum values  | 422   |

### Rate Limiting

- 10 generations per user; 24-hour cooldown starts at the 10th attempt — all slots reset at once after it expires (fixed-batch, not rolling)
- Counted from `plan_generations` where `status IN ('success', 'api_error')` plus non-stale `pending` (< 90 s old)
- Aborted generations (user navigates away mid-generation) are recorded as `api_error` and **do** count toward the quota
- Quota enforcement is **atomic**: `try_reserve_generation_slot()` uses `pg_advisory_xact_lock` to serialise
  concurrent requests for the same user — eliminates the TOCTOU race that existed when check and insert were separate
- Rejected with `429` before AI is invoked

### Threat Mitigation

| Threat                | Mitigation                                                    |
| --------------------- | ------------------------------------------------------------- |
| AI key exposure       | Stored server-side in Edge Function env; never sent to client |
| Cross-user access     | RLS + explicit ownership check                                |
| Prompt injection      | Note body passed as data, not concatenated into SQL           |
| Cost abuse            | Rate limit (10/24h) + quota enforced before AI invocation     |
| Malformed AI response | Zod schema validation on every response                       |

---

## 7. Error Handling

**Strategy:** Guard clauses with early returns. Record generation attempt before throwing AI errors.

| Scenario                           | When                                           | Factory                                   | HTTP |
| ---------------------------------- | ---------------------------------------------- | ----------------------------------------- | ---- |
| Invalid `tripId` format            | Parse fails or ≤ 0                             | `createInvalidTripIdError()`              | 400  |
| `destination` null/empty           | Pre-AI validation                              | `createValidationError()`                 | 400  |
| `note_body` > 10,000 chars         | Pre-AI validation                              | `createValidationError()`                 | 400  |
| No session                         | `auth.getUser()` returns null                  | `createUnauthorizedError()`               | 401  |
| Trip not owned by user             | Ownership check                                | `createForbiddenError()`                  | 403  |
| Trip not found                     | DB query returns null                          | `createNotFoundError()`                   | 404  |
| AI response fails Zod              | `EdgeFunctionResponseSchema.parse()` throws    | record `validation_error` + 422           |
| Quota ≥ 10                         | `checkGenerationQuota` returns `allowed:false` | `createQuotaExceededError()`              | 429  |
| Edge Function / OpenRouter failure | `supabaseClient.functions.invoke` error        | record `api_error` + `createAIApiError()` | 502  |
| Unexpected error                   | Any uncaught exception                         | `createInternalError()`                   | 500  |

---

## 8. Performance Considerations

- **Parallel DB queries:** Fetch trip, profile, and quota count in `Promise.all()` to reduce latency
- **Language detection:** Limit sample to first 1,000 chars (`generation.service.ts` already does this)
- **Index:** `idx_plan_generations_user_created ON plan_generations(user_id, created_at DESC)` — efficient quota count
- **AI latency:** OpenRouter.ai response time varies with trip length (~30 s for 3 days, up to 2–3 min for 10–14 days); Edge Function timeout is set to 145 s
- **Loading state:** `planStore.isGenerating` drives a spinner/skeleton on the client

---

## 9. Implementation Status

> All steps below are **implemented**. This section is kept as a reference and verification checklist.

### What was implemented

| Area                                           | File                                    | Status  |
| ---------------------------------------------- | --------------------------------------- | ------- |
| Quota status filter (`success`, `api_error`)   | `generation.service.ts`                 | ✅ Done |
| `destination` pre-validation guard             | `plan.store.ts`                         | ✅ Done |
| `destination` passed to `callAIService`        | `plan.store.ts`                         | ✅ Done |
| Quota snapshot in `GeneratedPlanDTO`           | `plan.store.ts`                         | ✅ Done |
| Generation attempt recording                   | Edge Function (server-side)             | ✅ Done |
| Edge Function with 145 s timeout               | `generate-plan/index.ts`                | ✅ Done |
| **Atomic quota reservation via advisory lock** | `generate-plan/index.ts` + DB migration | ✅ Done |
| RLS on `plan_generations`                      | migrations                              | ✅ Done |

### Atomic quota implementation detail

The original TOCTOU race (read quota → check → insert, non-atomic) was replaced with:

1. **`try_reserve_generation_slot(tripId)`** RPC called from Edge Function — acquires advisory lock per user,
   counts quota (including non-stale `pending`), inserts `pending` record if allowed, returns `reservation_id`
2. AI call proceeds
3. **`finalize_generation_slot(reservationId, status, model, error)`** RPC finalises the record

The Edge Function no longer does direct `INSERT INTO plan_generations` — all DB writes go through these
SECURITY DEFINER functions.

### Manual verification checklist

- [ ] Trip with destination and valid note generates a plan (200)
- [ ] Trip with missing destination returns 400
- [ ] Trip with note_body > 10,000 chars returns 400
- [ ] Unauthenticated request returns 401
- [ ] Another user's tripId returns 403/404
- [ ] Non-existent tripId returns 404
- [ ] After 10 successful generations, next request returns 429 with `reset_at`
- [ ] Two simultaneous generation requests from the same user: only one succeeds, second gets 429
- [ ] `validation_error` generation records do NOT count toward quota
- [ ] Generated plan NOT saved to `trips.plan_json` (verify DB)
- [ ] `planStore.planCandidate` is populated after generation
- [ ] `planCandidate.quota` reflects updated quota
- [ ] AI Edge Function error returns 502 (not 500)
- [ ] Stale `pending` record (> 90 s old) does not block future generation

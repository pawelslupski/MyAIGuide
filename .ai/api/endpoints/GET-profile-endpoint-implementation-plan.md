# API Endpoint Implementation Plan: GET /api/profiles/me

## 1. Endpoint Overview

Retrieves the full profile of the currently authenticated user. The profile contains global traveler flags (`has_kids`, `has_pets`, `has_mobility_issues`, `has_dietary_preferences`, `dietary_preferences_description`) and default trip-preference fields (`default_what`, `default_speed`, `default_type`, `default_budget`).

This endpoint is a **standard CRUD read** implemented via the **Supabase JS client + PostgREST + RLS** — no Edge Function is required. A profile is automatically created by the `on_user_created` database trigger on registration, so it is always present for authenticated users.

---

## 2. Request Details

- **HTTP Method:** GET
- **URL Structure:** `/api/profiles/me` (maps to a Supabase PostgREST query on the `profiles` table filtered by the authenticated user's `user_id`)
- **Parameters:**
  - Required: `Authorization: Bearer <supabase_session_token>` (HTTP header)
  - Optional: none
- **Path parameters:** none
- **Query parameters:** none
- **Request Body:** none

---

## 3. Used Types

### Response DTO — `ProfileDTO`

Defined in `src/types.ts`. Extends the raw DB row, narrowing string preference columns to typed enum unions:

```typescript
export interface ProfileDTO extends Omit<
  Tables<'profiles'>,
  'default_what' | 'default_speed' | 'default_type' | 'default_budget'
> {
  default_what: WhatPreference[] // enum array
  default_speed: SpeedPreference // 'slow_chill' | 'balance' | 'intensive'
  default_type: TypePreference // 'base' | 'base_with_trips' | 'roadtrip'
  default_budget: BudgetPreference // 'budget' | 'moderate' | 'luxury'
}
```

### Validation Schema — `ProfileDTOSchema`

Defined in `src/lib/validation/profile.schemas.ts`. Used to validate the Supabase response before returning it to the caller:

```typescript
export const ProfileDTOSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.string().uuid(),
  has_kids: z.boolean(),
  has_pets: z.boolean(),
  has_mobility_issues: z.boolean(),
  has_dietary_preferences: z.boolean(),
  dietary_preferences_description: z.string().nullable(),
  default_what: z.array(WhatPreferenceSchema).default([]),
  default_speed: z.enum(['slow_chill', 'balance', 'intensive']).nullable(),
  default_type: z.enum(['base', 'base_with_trips', 'roadtrip']).nullable(),
  default_budget: z.enum(['budget', 'moderate', 'luxury']).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
})
```

### No Command Model

GET endpoint — no request body, no command model required.

---

## 4. Response Details

### Success — `200 OK`

Returns the full `ProfileDTO` object:

```json
{
  "id": 123,
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "has_kids": false,
  "has_pets": false,
  "has_mobility_issues": false,
  "has_dietary_preferences": true,
  "dietary_preferences_description": "Fish allergy – please include suitable restaurants",
  "default_what": ["nature", "foodie"],
  "default_speed": "balance",
  "default_type": "roadtrip",
  "default_budget": "moderate",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-20T14:45:00Z"
}
```

### Error Responses

| HTTP Code | Error Code       | Condition                                               |
| --------- | ---------------- | ------------------------------------------------------- |
| `401`     | `UNAUTHORIZED`   | Missing, invalid, or expired Bearer token               |
| `404`     | `NOT_FOUND`      | Profile row not found (defensive; should never occur)   |
| `500`     | `INTERNAL_ERROR` | Supabase DB error or response schema validation failure |

All errors follow the shared `ErrorResponse` structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

---

## 5. Data Flow

```
Client (Vue SPA)
  │
  │  1. User is authenticated (Pinia auth store / Supabase Auth SDK holds session)
  │
  ▼
profile.store.ts :: fetchProfile()
  │
  │  2. Resolve authenticated user via supabaseClient.auth.getUser()
  │     → throw createUnauthorizedError() if user is null
  │
  ▼
profile.service.ts :: getProfile(userId: string)
  │
  │  3. Query Supabase PostgREST:
  │     supabaseClient
  │       .from('profiles')
  │       .select('*')
  │       .eq('user_id', userId)
  │       .single()
  │
  │  4. RLS policy enforces auth.uid() = user_id at DB level
  │
  │  5. If fetchError.code === 'PGRST116' → throw createProfileNotFoundError() (404)
  │     If other fetchError                → throw createInternalError(message)  (500)
  │
  │  6. Validate response with ProfileDTOSchema.parse(data)
  │     On ZodError → throw createInternalError('Profile data validation failed')
  │
  │  7. Return validated ProfileDTO
  │
  ▼
profile.store.ts
  │
  │  8. Assign to profile.value = result
  │     Set isLoading = false
  │
  ▼
Client (Vue SPA)
     Reads profile from store; displays preferences in UI
```

---

## 6. Security Considerations

### Authentication

- Resolve the current user using `supabaseClient.auth.getUser()` **before** any database interaction.
- If no session exists, throw `createUnauthorizedError()` (401) immediately — no DB query is made.
- Supabase manages JWT storage and auto-refresh; the anon key is used (no service role key needed).

### Authorization (IDOR prevention)

- The query filters by `user_id = userId` **and** RLS policy enforces `auth.uid() = user_id` at the PostgreSQL level.
- No resource ID is exposed in the URL — the user can only ever access their own profile.
- Defense in depth: application-level `user_id` filter + DB-level RLS.

### Data Exposure

- All profile fields returned are appropriate for the profile owner — no sensitive data from other users is accessible.
- `dietary_preferences_description` may contain personal medical information; it is only returned to the authenticated owner and protected by RLS.

### No Privileged Operations

- Standard anon key + RLS is sufficient; no Supabase service role key is required for this endpoint.
- No Edge Function needed.

---

## 7. Error Handling

| Scenario                              | Root Cause                                   | Error Factory                  | HTTP |
| ------------------------------------- | -------------------------------------------- | ------------------------------ | ---- |
| No session / invalid token            | `auth.getUser()` returns null user           | `createUnauthorizedError()`    | 401  |
| Expired JWT (not refreshed)           | `auth.getUser()` returns null user           | `createUnauthorizedError()`    | 401  |
| Profile row missing (trigger failure) | `PGRST116` from `.single()` with no rows     | `createProfileNotFoundError()` | 404  |
| DB connection failure                 | Non-PGRST116 Supabase error                  | `createInternalError(msg)`     | 500  |
| Response fails schema validation      | ZodError from `ProfileDTOSchema.parse(data)` | `createInternalError(msg)`     | 500  |

All errors are caught in `profile.store.ts::fetchProfile()` in the single `catch` block, converted via `toApiError(err)`, stored in `error.value`, and rethrown for components to handle.

---

## 8. Performance Considerations

- **Index:** `idx_profiles_user_id` (unique index on `profiles.user_id`) makes the lookup O(1) — no full table scan.
- **Single row:** `.single()` terminates the query immediately after the first match.
- **No joins:** The query fetches all columns from one table — minimal data transfer.
- **Caching:** The Pinia store holds the profile in memory after the first fetch. Components should check `profile.value` before calling `fetchProfile()` to avoid redundant requests.

---

## 9. Implementation Steps

1. **Create `src/lib/services/profile.service.ts`**

   Extract the Supabase query logic from `profile.store.ts` into a standalone service function following the `trip.service.ts` pattern:

   ```typescript
   // src/lib/services/profile.service.ts
   import { supabaseClient } from '@/db/supabase.client'
   import type { ProfileDTO } from '@/types'
   import { validateProfileDTO } from '@/lib/validation/profile.schemas'
   import { createProfileNotFoundError, createInternalError } from '@/lib/errors/api.error'
   import { ZodError } from 'zod'

   /**
    * Fetch the authenticated user's profile by their userId.
    *
    * @param userId - Authenticated user UUID (from Supabase Auth session)
    * @returns Promise<ProfileDTO> - Typed, validated profile data
    * @throws ApiError 404 if profile row not found (edge case; trigger should always create it)
    * @throws ApiError 500 on DB error or response validation failure
    */
   export async function getProfile(userId: string): Promise<ProfileDTO> {
     const { data, error } = await supabaseClient
       .from('profiles')
       .select('*')
       .eq('user_id', userId)
       .single()

     if (error) {
       if (error.code === 'PGRST116') throw createProfileNotFoundError()
       throw createInternalError(error.message)
     }

     try {
       return validateProfileDTO(data)
     } catch (err) {
       if (err instanceof ZodError) {
         throw createInternalError('Profile data validation failed')
       }
       throw err
     }
   }
   ```

2. **Refactor `src/stores/profile.store.ts::fetchProfile()`**

   Replace the inline Supabase query with a call to the new service function. The store retains responsibility for:
   - Auth session check (`supabaseClient.auth.getUser()`)
   - State management (`isLoading`, `error`, `profile`)
   - Error conversion via `toApiError`

   ```typescript
   // In profile.store.ts
   import { getProfile } from '@/lib/services/profile.service'

   async function fetchProfile(): Promise<void> {
     isLoading.value = true
     error.value = null

     try {
       const {
         data: { user }
       } = await supabaseClient.auth.getUser()
       if (!user) throw createUnauthorizedError()

       profile.value = await getProfile(user.id)
     } catch (err: unknown) {
       const apiErr = toApiError(err)
       error.value = apiErr.toResponse()
       throw apiErr
     } finally {
       isLoading.value = false
     }
   }
   ```

3. **Verify `ProfileDTOSchema` covers all DB columns**

   Open `src/lib/validation/profile.schemas.ts` and confirm the schema includes every column returned by `SELECT *` on `profiles`. The existing schema already covers all fields — no changes required.

4. **Add `createProfileNotFoundError` factory (if missing)**

   Confirm `src/lib/errors/api.error.ts` exports `createProfileNotFoundError()`. It already exists:

   ```typescript
   export function createProfileNotFoundError(): ApiError {
     return new ApiError(404, 'NOT_FOUND', 'Profile not found')
   }
   ```

   No changes required.

5. **Update `updateProfile` action in the store (cleanup)**

   The existing `updateProfile` in `profile.store.ts` uses a raw Supabase query without error factories. Align it with the pattern used by `fetchProfile` (use `toApiError`, typed errors). This is a parallel improvement — do after the service extraction is verified.

6. **Write a service-level unit test (recommended)**

   Create `src/lib/services/profile.service.test.ts`. Mock `supabaseClient` and test:
   - Returns `ProfileDTO` on a valid Supabase response.
   - Throws `404 NOT_FOUND` when Supabase returns `PGRST116`.
   - Throws `500 INTERNAL_ERROR` on a generic Supabase error.
   - Throws `500 INTERNAL_ERROR` when the response fails `ProfileDTOSchema` (e.g., unknown enum value).

7. **Integration smoke-test (manual)**

   In the running dev environment:
   - Login as a test user.
   - Navigate to the profile page — confirm the store loads without errors.
   - Open DevTools → Network → confirm the Supabase PostgREST request returns `200` with the expected JSON shape.
   - Logout and reload — confirm the page redirects / shows 401 handling instead of crashing.

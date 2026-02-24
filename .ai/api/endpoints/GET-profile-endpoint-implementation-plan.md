# API Endpoint Implementation Plan: GET /api/profiles/me

## 1. Endpoint Overview

`GET /api/profiles/me` retrieves the authenticated user's global travel profile — preference flags (kids, pets,
mobility, dietary) and default trip preferences (what, speed, type, budget).

**Implementation approach:** This project uses the Supabase JS Client directly in Pinia stores (no standalone
REST server). The "endpoint" is implemented as the `fetchProfile()` action in `src/stores/profile.store.ts`,
which queries Supabase PostgREST and relies on RLS for data isolation. Per the API plan (section 6.2), standard
CRUD operations like this use the Supabase JS Client — not an Edge Function.

---

## 2. Request Details

- **HTTP Method:** GET
- **URL Pattern:** `/api/profiles/me` (maps to `supabase.from('profiles').select('*')` filtered by authenticated user)
- **Parameters:**
  - Required: none
  - Optional: none
- **Request Body:** none
- **Headers:**
  - `Authorization: Bearer <supabase_session_token>` — required; handled automatically by the Supabase JS Client session

---

## 3. Used Types

All types are defined in `src/types.ts`:

```typescript
// Response DTO — direct mapping to profiles table row
type ProfileDTO = Tables<'profiles'>
// {
//   id: number
//   user_id: string
//   has_kids: boolean
//   has_pets: boolean
//   has_mobility_issues: boolean
//   has_dietary_preferences: boolean
//   default_what: string[]
//   default_speed: string | null
//   default_type: string | null
//   default_budget: string | null
//   created_at: string
//   updated_at: string
// }

// Standard error response
interface ErrorResponse {
  error: { code: string; message: string; details?: Record<string, unknown> }
}
```

New Zod schema to be created in `src/lib/validation/profile.schemas.ts`:

```typescript
// ProfileDTOSchema — validates Supabase response shape per DATA_VALIDATION rule in backend.mdc
const ProfileDTOSchema: z.ZodObject<...>
```

---

## 4. Response Details

### Success — 200 OK

```json
{
  "id": 123,
  "user_id": "uuid-string",
  "has_kids": false,
  "has_pets": false,
  "has_mobility_issues": false,
  "has_dietary_preferences": true,
  "default_what": ["nature", "foodie"],
  "default_speed": "balance",
  "default_type": "roadtrip",
  "default_budget": "moderate",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-20T14:45:00Z"
}
```

### Error Responses

| Status | Code             | Condition                                                                     |
| ------ | ---------------- | ----------------------------------------------------------------------------- |
| 401    | `UNAUTHORIZED`   | No valid Supabase session                                                     |
| 404    | `NOT_FOUND`      | Profile row does not exist (edge case — should be auto-created by DB trigger) |
| 500    | `INTERNAL_ERROR` | Supabase connection failure or unexpected DB error                            |
| 500    | `INTERNAL_ERROR` | Zod validation mismatch on DB response (schema drift)                         |

All errors follow the standard `ErrorResponse` format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

---

## 5. Data Flow

```
Component (e.g. DashboardView)
  │
  ▼
profileStore.fetchProfile()           [src/stores/profile.store.ts]
  │
  ├─► supabaseClient.auth.getUser()   → validates session, extracts user.id
  │     └─ throws UNAUTHORIZED if no session
  │
  ├─► supabase.from('profiles')
  │     .select('*')
  │     .eq('user_id', user.id)       → RLS enforces auth.uid() = user_id at DB level
  │     .single()
  │     └─ returns ProfileDTO row or error
  │
  ├─► ProfileDTOSchema.parse(data)    → Zod validation (response integrity check)
  │     └─ throws INTERNAL_ERROR on schema mismatch
  │
  └─► profile.value = validatedData   → reactive Pinia state updated
```

The `defaultPreferences` computed getter derives `TripPreferencesDto` from the stored profile, used as fallbacks
when creating new trips.

---

## 6. Security Considerations

### Authentication

- Supabase JS Client automatically attaches the active session JWT to every request
- `supabaseClient.auth.getUser()` must be called first to confirm session validity before trusting `user.id`
- If no valid session exists, throw `createUnauthorizedError()` immediately (guard clause)

### Authorization — Defense in Depth

| Layer          | Mechanism                                                                              |
| -------------- | -------------------------------------------------------------------------------------- |
| Application    | `auth.getUser()` guard; query filtered by `user.id`                                    |
| Database (RLS) | `USING (auth.uid() = user_id)` — blocks cross-user reads even on misconfigured queries |

RLS policy (`profiles` table):

```sql
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);
```

### Additional Notes

- Never expose Supabase service role key on the frontend — the anon key is used via `src/db/supabase.client.ts`
- Profile data contains no sensitive PII beyond user preferences

---

## 7. Error Handling

### New Error Factory Required

Add to `src/lib/errors/api.error.ts`:

```typescript
export function createProfileNotFoundError(): ApiError {
  return new ApiError(404, 'NOT_FOUND', 'Profile not found')
}
```

### Error Mapping in Store

```typescript
catch (err: unknown) {
  const apiErr = toApiError(err)   // converts any error to ApiError
  error.value = apiErr.toResponse()
  throw apiErr
}
```

| Error source                           | Resulting code   | Status |
| -------------------------------------- | ---------------- | ------ |
| `auth.getUser()` returns no user       | `UNAUTHORIZED`   | 401    |
| Supabase returns `PGRST116` (no rows)  | `NOT_FOUND`      | 404    |
| Supabase returns other PostgREST error | `INTERNAL_ERROR` | 500    |
| Zod parse failure                      | `INTERNAL_ERROR` | 500    |

### No Generation Log Required

Profile fetch failures are not recorded in `plan_generations` — that table is exclusively for AI generation
attempts. Errors are surfaced through the store's `error` ref for component-level display.

---

## 8. Performance Considerations

- **Index:** `idx_profiles_user_id` (UNIQUE) on `profiles(user_id)` — O(1) lookup by user
- **Single row:** `.single()` ensures exactly one row is returned; PostgreSQL stops scanning after the first match
- **Caching:** Profile is stored in Pinia state for the session. Components should check `profile.value` before
  calling `fetchProfile()` again to avoid redundant queries. Add a `isProfileLoaded` computed if needed.
- **No pagination needed:** 1:1 relationship between user and profile

---

## 9. Implementation Steps

### Step 1 — Create Zod schema for ProfileDTO

**File:** `src/lib/validation/profile.schemas.ts` (new file)

Define `ProfileDTOSchema` using Zod, matching the `profiles` table structure and DB constraints:

```typescript
import { z } from 'zod'

export const WhatPreferenceSchema = z.enum([
  'nature',
  'culture_museums',
  'beach_relax',
  'city_break',
  'foodie'
])

export const ProfileDTOSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.string().uuid(),
  has_kids: z.boolean(),
  has_pets: z.boolean(),
  has_mobility_issues: z.boolean(),
  has_dietary_preferences: z.boolean(),
  default_what: z.array(WhatPreferenceSchema).default([]),
  default_speed: z.enum(['slow_chill', 'balance', 'intensive']).nullable(),
  default_type: z.enum(['base', 'base_with_trips', 'roadtrip']).nullable(),
  default_budget: z.enum(['budget', 'moderate', 'luxury']).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
})

export function validateProfileDTO(data: unknown) {
  return ProfileDTOSchema.parse(data)
}
```

> Note: `WhatPreferenceSchema` is also defined in `plan.schemas.ts`. Extract it to a shared
> `preference.schemas.ts` to avoid duplication, or re-export from `profile.schemas.ts`.

### Step 2 — Add `createProfileNotFoundError` factory

**File:** `src/lib/errors/api.error.ts` (edit existing)

Add after the existing `createNotFoundError` (which is trip-specific):

```typescript
export function createProfileNotFoundError(): ApiError {
  return new ApiError(404, 'NOT_FOUND', 'Profile not found')
}
```

### Step 3 — Update `fetchProfile()` in profile store

**File:** `src/stores/profile.store.ts` (edit existing)

Integrate Zod validation and `ApiError` pattern into the existing `fetchProfile()` action:

```typescript
import { validateProfileDTO } from '@/lib/validation/profile.schemas'
import {
  createUnauthorizedError,
  createProfileNotFoundError,
  createInternalError,
  toApiError
} from '@/lib/errors/api.error'

async function fetchProfile(): Promise<void> {
  isLoading.value = true
  error.value = null

  try {
    const {
      data: { user }
    } = await supabaseClient.auth.getUser()
    if (!user) throw createUnauthorizedError()

    const { data, error: fetchError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (fetchError) {
      // PGRST116 = no rows returned by .single()
      if (fetchError.code === 'PGRST116') throw createProfileNotFoundError()
      throw createInternalError(fetchError.message)
    }

    // Validate DB response shape (guards against schema drift)
    profile.value = validateProfileDTO(data)
  } catch (err: unknown) {
    const apiErr = toApiError(err)
    error.value = apiErr.toResponse()
    throw apiErr
  } finally {
    isLoading.value = false
  }
}
```

### Step 4 — Guard against redundant calls in components

**File:** any component calling `fetchProfile()` (e.g. `src/views/DashboardView.vue`)

Add a guard to skip the fetch if profile is already loaded:

```typescript
if (!profileStore.profile) {
  await profileStore.fetchProfile()
}
```

Or add an `isProfileLoaded` computed to the store:

```typescript
const isProfileLoaded = computed(() => profile.value !== null)
```

### Step 5 — Verify RLS policy is applied

**File:** `supabase/migrations/` — confirm the SELECT policy exists:

```sql
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);
```

This is defined in `db-plan.md` section 4.1. Verify it is included in the active migration files.

### Step 6 — Manual verification checklist

- [ ] Authenticated user receives their own profile (200)
- [ ] Unauthenticated request is rejected (401)
- [ ] Request with a valid session but no profile row returns 404
- [ ] `defaultPreferences` computed reflects fetched profile values
- [ ] `isLoading` and `error` state are correctly set/cleared during the fetch lifecycle
- [ ] Cross-user access is blocked by RLS (cannot access another user's profile even with valid auth)

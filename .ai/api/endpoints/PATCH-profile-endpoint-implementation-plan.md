# API Endpoint Implementation Plan: PATCH /api/profiles/me

## 1. Endpoint Overview

Updates the current authenticated user's global profile. All fields are optional — only provided fields are modified (partial update). Contains cross-field validation: `dietary_preferences_description` is required and non-empty when `has_dietary_preferences` is `true`, and must be `null` otherwise.

**Implementation approach:** Standard Supabase JS Client (PostgREST + RLS) — no Edge Function required. DB write logic lives in `src/lib/services/profile.service.ts` (`updateProfile`); orchestration (auth, validation, state) lives in `src/stores/profile.store.ts`.

**Status:** `updateProfile` in `profile.service.ts` is **already implemented**. The store action and Zod command schema are the main gaps to address.

---

## 2. Request Details

- **HTTP Method:** PATCH
- **URL Structure:** `/api/profiles/me`
- **Path Parameters:** none
- **Query Parameters:** none
- **Request Body (all fields optional):**

```json
{
  "has_kids": true,
  "has_pets": false,
  "has_mobility_issues": false,
  "has_dietary_preferences": true,
  "dietary_preferences_description": "Vegetarian – no gluten",
  "default_what": ["culture_museums", "nature"],
  "default_speed": "intensive",
  "default_type": "base",
  "default_budget": "luxury"
}
```

**Validation rules:**

- `has_dietary_preferences = true` → `dietary_preferences_description` must be non-null and non-empty (after trim)
- `has_dietary_preferences = false` → `dietary_preferences_description` must be `null` or omitted
- `default_what`: each element must be one of `nature | culture_museums | beach_relax | city_break | foodie`
- `default_speed`: one of `slow_chill | balance | intensive`
- `default_type`: one of `base | base_with_trips | roadtrip`
- `default_budget`: one of `budget | moderate | luxury`

---

## 3. Used Types

All types in `src/types.ts`.

### Command Model — `UpdateProfileCommand` (already exists)

```typescript
export interface UpdateProfileCommand {
  has_kids?: boolean
  has_pets?: boolean
  has_mobility_issues?: boolean
  has_dietary_preferences?: boolean
  dietary_preferences_description?: string | null
  default_what?: WhatPreference[]
  default_speed?: SpeedPreference
  default_type?: TypePreference
  default_budget?: BudgetPreference
}
```

### Response DTO — `ProfileDTO` (already exists)

Same shape as `GET /api/profiles/me` — full updated profile object.

### Error Response — `ErrorResponse` (already exists)

```typescript
export interface ErrorResponse {
  error: { code: string; message: string; details?: Record<string, unknown> }
}
```

---

## 4. Response Details

### Success — `200 OK`

Returns the full updated `ProfileDTO` (same shape as `GET /api/profiles/me`).

### Error Responses

| HTTP Code | Error Code         | Condition                                                         |
| --------- | ------------------ | ----------------------------------------------------------------- |
| `400`     | `VALIDATION_ERROR` | Invalid enum value, dietary description missing when flag is true |
| `401`     | `UNAUTHORIZED`     | No valid Supabase session                                         |
| `500`     | `INTERNAL_ERROR`   | DB update failure or response schema validation failure           |

**Example `400` response:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid profile data",
    "details": {
      "dietary_preferences_description": "Required and non-empty when has_dietary_preferences is true"
    }
  }
}
```

---

## 5. Data Flow

```
Profile Settings View (Vue component)
  │
  ▼
profileStore.updateProfile(command: UpdateProfileCommand)   [src/stores/profile.store.ts]
  │
  ├─► supabaseClient.auth.getUser()   → extract userId; throw createUnauthorizedError() if null
  │
  ├─► validateUpdateProfileCommand(command)   [src/lib/validation/profile.schemas.ts]
  │     └─ ZodError → throw createValidationError(message, details) (400)
  │
  ▼
profile.service.ts :: updateProfile(userId, updates)
  │
  ├─► supabase.from('profiles')
  │     .update(updates)
  │     .eq('user_id', userId)
  │     .select().single()
  │     └─ error → throw createInternalError(msg) (500)
  │
  ├─► validateProfileDTO(data)   [profile.schemas.ts]
  │     └─ ZodError → throw createInternalError('Profile data validation failed') (500)
  │
  └─► return ProfileDTO
        │
        ▼
  profileStore.profile.value = updatedProfile
```

---

## 6. Security Considerations

### Authentication

- `supabaseClient.auth.getUser()` called before any DB write — no update is made without a valid session.

### Authorization (IDOR prevention)

- Query filters by `user_id` at the application level; RLS policy also enforces `auth.uid() = user_id` at DB level.
- No resource ID in the URL — users can only ever modify their own profile.

### Data Validation

- Zod validates all enum values before they reach the DB — prevents invalid string values being stored.
- Cross-field dietary rule enforced at the Zod `superRefine` level before any DB interaction.

---

## 7. Error Handling

| Scenario                                   | Root Cause                                | Factory                     | HTTP |
| ------------------------------------------ | ----------------------------------------- | --------------------------- | ---- |
| No session / invalid token                 | `auth.getUser()` returns null             | `createUnauthorizedError()` | 401  |
| Invalid enum value (`default_speed`, etc.) | Zod enum check fails                      | `createValidationError()`   | 400  |
| Dietary description missing when flag=true | Zod `superRefine` cross-field check fails | `createValidationError()`   | 400  |
| Dietary description set when flag=false    | Zod `superRefine` cross-field check fails | `createValidationError()`   | 400  |
| DB update failure                          | Supabase returns error on `.update()`     | `createInternalError()`     | 500  |
| Response fails schema validation           | ZodError from `validateProfileDTO()`      | `createInternalError()`     | 500  |

---

## 8. Performance Considerations

- **Index:** `idx_profiles_user_id` (unique) makes the `WHERE user_id = ?` lookup O(1).
- **Single row:** `.single()` terminates immediately after the first match.
- **No joins:** Update touches one table with one row — minimal overhead.
- **Pinia cache:** Store updates `profile.value` directly after a successful write — no re-fetch needed.

---

## 9. Implementation Steps

### Step 1 — Add `UpdateProfileCommandSchema` to `profile.schemas.ts`

**File:** `src/lib/validation/profile.schemas.ts`

```typescript
import { z } from 'zod'

export const UpdateProfileCommandSchema = z
  .object({
    has_kids: z.boolean().optional(),
    has_pets: z.boolean().optional(),
    has_mobility_issues: z.boolean().optional(),
    has_dietary_preferences: z.boolean().optional(),
    dietary_preferences_description: z.string().nullable().optional(),
    default_what: z.array(WhatPreferenceSchema).optional(),
    default_speed: z.enum(['slow_chill', 'balance', 'intensive']).optional(),
    default_type: z.enum(['base', 'base_with_trips', 'roadtrip']).optional(),
    default_budget: z.enum(['budget', 'moderate', 'luxury']).optional()
  })
  .superRefine((data, ctx) => {
    if (data.has_dietary_preferences === true) {
      if (!data.dietary_preferences_description?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dietary_preferences_description'],
          message: 'Required and non-empty when has_dietary_preferences is true'
        })
      }
    }
    if (data.has_dietary_preferences === false && data.dietary_preferences_description != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dietary_preferences_description'],
        message: 'Must be null when has_dietary_preferences is false'
      })
    }
  })

export function validateUpdateProfileCommand(data: unknown) {
  return UpdateProfileCommandSchema.parse(data)
}
```

### Step 2 — Add `updateProfile` action to `profile.store.ts`

**File:** `src/stores/profile.store.ts`

```typescript
import { validateUpdateProfileCommand } from '@/lib/validation/profile.schemas'
import { updateProfile as updateProfileService } from '@/lib/services/profile.service'
import { ZodError } from 'zod'

async function updateProfile(command: UpdateProfileCommand): Promise<void> {
  isLoading.value = true
  error.value = null

  try {
    const {
      data: { user }
    } = await supabaseClient.auth.getUser()
    if (!user) throw createUnauthorizedError()

    const validated = validateUpdateProfileCommand(command)
    profile.value = await updateProfileService(user.id, validated)
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      const details = Object.fromEntries(err.issues.map((i) => [i.path.join('.'), i.message]))
      const apiErr = createValidationError('Invalid profile data', details)
      error.value = apiErr.toResponse()
      throw apiErr
    }
    const apiErr = toApiError(err)
    error.value = apiErr.toResponse()
    throw apiErr
  } finally {
    isLoading.value = false
  }
}
```

### Step 3 — Verify `updateProfile` in `profile.service.ts` (ALREADY IMPLEMENTED)

**File:** `src/lib/services/profile.service.ts`

Confirm the function:

1. Calls `.update(updates).eq('user_id', userId).select().single()`
2. Throws `createInternalError()` on DB error
3. Runs `validateProfileDTO(data)` and catches `ZodError` → `createInternalError()`

### Step 4 — Manual verification checklist

- [ ] Authenticated user can update a single field (partial update works)
- [ ] Updating `has_dietary_preferences: true` without description returns `400`
- [ ] Updating `has_dietary_preferences: false` with description returns `400`
- [ ] Updating both `has_dietary_preferences: true` + non-empty description returns `200`
- [ ] Invalid enum value (e.g., `default_speed: "fast"`) returns `400` with `details`
- [ ] Unauthenticated request returns `401`
- [ ] `profile.value` in Pinia store reflects the updated data after success
- [ ] `updated_at` is automatically bumped by the DB trigger

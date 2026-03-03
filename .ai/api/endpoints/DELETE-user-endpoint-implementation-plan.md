# API Endpoint Implementation Plan: DELETE /api/users/me

## 1. Endpoint Overview

Permanently deletes the authenticated user's account and **all** associated data (`profiles`, `trips`, `plan_generations`) via database cascade. Requires an explicit confirmation string to prevent accidental deletion. Re-login after deletion is impossible.

**Implementation approach:** Requires a **Supabase Edge Function** because `auth.admin.deleteUser()` needs the **Supabase service role key**, which must never be exposed to the browser. The Edge Function verifies the session, validates the confirmation string, deletes the auth user (cascading to all owned data), and returns the result.

**Status:** Not yet implemented. This plan covers full implementation of both the Edge Function and the client-side store action.

---

## 2. Request Details

- **HTTP Method:** DELETE
- **URL Structure:** `/api/users/me`
- **Path Parameters:** none
- **Query Parameters:** none
- **Request Body:**

```json
{
  "confirmation": "DELETE MY ACCOUNT"
}
```

> The exact string `"DELETE MY ACCOUNT"` is required to prevent accidental deletion.

- **Headers:**
  - `Authorization: Bearer <supabase_session_token>` — required

---

## 3. Used Types

No new types needed. The Edge Function returns a plain success or error JSON object.

### Error Response — `ErrorResponse` (from `src/types.ts`)

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
  "message": "Account successfully deleted"
}
```

### Error Responses

| HTTP Code | Error Code         | Condition                                  |
| --------- | ------------------ | ------------------------------------------ |
| `400`     | `VALIDATION_ERROR` | Missing or incorrect `confirmation` string |
| `401`     | `UNAUTHORIZED`     | No valid Supabase session                  |
| `500`     | `INTERNAL_ERROR`   | Deletion failed (Supabase Admin API error) |

---

## 5. Data Flow

```
Account Settings View (Vue component)
  │
  ▼
authStore.deleteAccount(confirmation)     [src/stores/auth.store.ts]
  │
  ├─► Guard: supabaseClient.auth.getUser() → extract userId
  │     └─ null → throw createUnauthorizedError() (401)
  │
  ├─► Guard: confirmation !== 'DELETE MY ACCOUNT'
  │     └─ throw createValidationError('Invalid confirmation string') (400)
  │
  ▼
supabaseClient.functions.invoke('delete-account', { body: { confirmation } })
  │
  │  [supabase/functions/delete-account/index.ts — Edge Function]
  │
  ├─► Verify JWT from Authorization header via supabase.auth.getUser()
  │     └─ invalid → return 401
  │
  ├─► Validate body.confirmation === 'DELETE MY ACCOUNT'
  │     └─ mismatch → return 400
  │
  ├─► supabaseAdmin.auth.admin.deleteUser(userId)
  │     Uses service role key (server-side only — never sent to client)
  │     └─ error → return 500
  │
  │   CASCADE: DB triggers ON DELETE CASCADE remove:
  │     profiles → deleted
  │     trips    → deleted (which cascades to plan_generations)
  │
  └─► return 200 { message: 'Account successfully deleted' }
        │
        ▼
  authStore:
    await supabaseClient.auth.signOut()   ← clear local session
    router.push('/register')              ← redirect to guest page
```

---

## 6. Security Considerations

### Service Role Key

- `supabaseAdmin` client (with service role key) is instantiated **only inside the Edge Function** using `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`.
- The key is stored in Supabase Secrets — never in source code or the browser.

### Authentication

- JWT from the `Authorization` header is verified server-side using `supabase.auth.getUser()` in the Edge Function. The `userId` is extracted from the verified token — it cannot be spoofed.

### Confirmation String

- The required literal string `"DELETE MY ACCOUNT"` acts as a deliberate friction mechanism to prevent accidental deletion (both client-side and server-side validation).

### Cascade Deletion

- `profiles`: `user_id` FK with `ON DELETE CASCADE` → deleted automatically.
- `trips`: `user_id` FK with `ON DELETE CASCADE` → deleted automatically.
- `plan_generations`: `trip_id` FK with `ON DELETE CASCADE` → deleted when trips are deleted.

---

## 7. Error Handling

| Scenario                         | Root Cause                                    | Response                    | HTTP |
| -------------------------------- | --------------------------------------------- | --------------------------- | ---- |
| No session / invalid token       | `auth.getUser()` returns null (client or EF)  | `createUnauthorizedError()` | 401  |
| Wrong confirmation string        | `confirmation !== 'DELETE MY ACCOUNT'`        | `createValidationError()`   | 400  |
| Admin delete API failure         | `supabaseAdmin.auth.admin.deleteUser()` error | `createInternalError()`     | 500  |
| Client-side: Edge Function error | `functions.invoke()` returns error            | `toApiError(err)`           | 500  |

---

## 8. Performance Considerations

- **Single admin API call:** `deleteUser()` is atomic — either the user is deleted (with cascade) or it is not.
- **Session cleanup:** `auth.signOut()` is called client-side after a successful delete to clear JWT from local storage.
- **No retry:** Account deletion is irreversible; do not retry on failure.

---

## 9. Implementation Steps

### Step 1 — Create `supabase/functions/delete-account/index.ts` (Edge Function)

**File:** `supabase/functions/delete-account/index.ts`

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Verify caller session
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate confirmation string
    const { confirmation } = await req.json()
    if (confirmation !== 'DELETE MY ACCOUNT') {
      return new Response(
        JSON.stringify({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid confirmation string' }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete user via admin API (service role key — server-side only)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    if (deleteError) {
      return new Response(
        JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Account deletion failed' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify({ message: 'Account successfully deleted' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('[delete-account] Unexpected error:', err)
    return new Response(
      JSON.stringify({
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

### Step 2 — Add `deleteAccount` action to `auth.store.ts`

**File:** `src/stores/auth.store.ts`

```typescript
async function deleteAccount(confirmation: string): Promise<void> {
  if (confirmation !== 'DELETE MY ACCOUNT') {
    throw createValidationError('Invalid confirmation string', {
      confirmation: 'Must be exactly: DELETE MY ACCOUNT'
    })
  }

  const { data, error } = await supabaseClient.functions.invoke('delete-account', {
    body: { confirmation }
  })

  if (error) throw createInternalError(error.message)

  // Clear local session after successful deletion
  await supabaseClient.auth.signOut()
  router.push('/register')
}
```

### Step 3 — Ensure CASCADE policies are in place (DB migrations)

Verify in applied migrations:

```sql
-- profiles.user_id → auth.users.id ON DELETE CASCADE
-- trips.user_id → auth.users.id ON DELETE CASCADE
-- plan_generations.trip_id → trips.id ON DELETE CASCADE
```

### Step 4 — Manual verification checklist

- [ ] Correct confirmation string deletes the account (`200`)
- [ ] Wrong confirmation string returns `400`
- [ ] After deletion, session is cleared and user is redirected to `/register`
- [ ] After deletion, login with the deleted credentials fails
- [ ] All `trips`, `profiles`, `plan_generations` rows for the user are gone (cascade)
- [ ] Unauthenticated request to the Edge Function returns `401`
- [ ] Service role key is never visible in browser Network tab

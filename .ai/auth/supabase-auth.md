# Supabase Auth Integration with Vue 3 SPA

Use this guide when introducing or modifying authentication in this project.
The app is a **client-side SPA** (Vue 3 + Vite) — there is no server-side rendering,
no middleware layer, and no HTTP-only cookies. Sessions are managed entirely in the browser.

## Core Requirements

1. Use `@supabase/supabase-js` — already installed and configured at `src/db/supabase.client.ts`
2. Session state lives in a **Pinia store** (`src/stores/auth.store.ts`) via `onAuthStateChange`
3. Route protection is implemented as a **Vue Router navigation guard** (`beforeEach`)
4. Supabase stores the session in `localStorage` automatically

## Environment Variables

Frontend `.env` (already set up):

```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Variables use the `VITE_` prefix so Vite exposes them to the browser via `import.meta.env`.

## Supabase Client

The client is already initialised in `src/db/supabase.client.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../db/database.types'

export const supabaseClient = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

**Always import from this file** — never call `createClient` elsewhere in the app.

## Auth Store

All authentication state lives in `src/stores/auth.store.ts` using Pinia Composition API:

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { supabaseClient } from '@/db/supabase.client'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const isLoading = ref(true) // true until initial session check completes
  const isPasswordRecovery = ref(false)

  const isAuthenticated = computed(() => !!session.value)
  const userId = computed(() => user.value?.id ?? null)
  const userEmail = computed(() => user.value?.email ?? null)

  function initialize(): void {
    supabaseClient.auth.onAuthStateChange((event: AuthChangeEvent, newSession: Session | null) => {
      session.value = newSession
      user.value = newSession?.user ?? null

      if (event === 'PASSWORD_RECOVERY') {
        isPasswordRecovery.value = true
      }
      if (event === 'SIGNED_OUT') {
        resetAllStores()
      }
    })

    supabaseClient.auth.getSession().then(({ data }) => {
      session.value = data.session
      user.value = data.session?.user ?? null
      isLoading.value = false
    })
  }

  async function login(email: string, password: string): Promise<void> {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password })
    if (error) throw error
    // State updated via onAuthStateChange
  }

  async function register(email: string, password: string): Promise<void> {
    const { error } = await supabaseClient.auth.signUp({ email, password })
    if (error) throw error
  }

  async function logout(): Promise<void> {
    const { error } = await supabaseClient.auth.signOut()
    if (error) throw error
  }

  async function resetPassword(email: string): Promise<void> {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) throw error
  }

  async function updatePassword(newPassword: string): Promise<void> {
    const { error } = await supabaseClient.auth.updateUser({ password: newPassword })
    if (error) throw error
    isPasswordRecovery.value = false
  }

  async function deleteAccount(): Promise<void> {
    const { error } = await supabaseClient.functions.invoke('delete-account')
    if (error) throw error
    await logout()
  }

  function resetAllStores(): void {
    // Composition API stores do not support $reset() — use explicit clear actions
    import('@/stores/trip.store').then(({ useTripStore }) => useTripStore().clearTrip())
    import('@/stores/plan.store').then(({ usePlanStore }) => usePlanStore().discardCandidate())
    import('@/stores/profile.store').then(({ useProfileStore }) => {
      useProfileStore().profile = null
    })
  }

  return {
    user,
    session,
    isLoading,
    isPasswordRecovery,
    isAuthenticated,
    userId,
    userEmail,
    initialize,
    login,
    register,
    logout,
    resetPassword,
    updatePassword,
    deleteAccount
  }
})
```

### Key rules for the auth store

- `onAuthStateChange` is the **single source of truth** — `login()` and `register()` do not set refs directly
- `isLoading` starts `true` and is only set to `false` after `getSession()` resolves; the router guard waits on it
- Call `initialize()` once in `App.vue` `<script setup>` before any navigation

## Router Guard

Route protection is a Vue Router `beforeEach` guard in `src/router/index.ts`:

```typescript
router.beforeEach(async (to) => {
  const { watch } = await import('vue')
  const { useAuthStore } = await import('@/stores/auth.store')
  const authStore = useAuthStore()

  // Wait for initial session check to complete
  if (authStore.isLoading) {
    await new Promise<void>((resolve) => {
      const unwatch = watch(
        () => authStore.isLoading,
        (loading) => {
          if (!loading) {
            unwatch()
            resolve()
          }
        },
        { immediate: true }
      )
    })
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return { name: 'dashboard' }
  }
})
```

### Route meta flags

| `meta` field         | Meaning                                                 |
| -------------------- | ------------------------------------------------------- |
| `requiresAuth: true` | Redirect unauthenticated users to `/login`              |
| `guestOnly: true`    | Redirect authenticated users to `/` (dashboard)         |
| _(neither)_          | Accessible to everyone (e.g. `/reset-password`, `/404`) |

## Supabase Auth Operations

| Operation           | Method                                                              |
| ------------------- | ------------------------------------------------------------------- |
| Register            | `supabaseClient.auth.signUp({ email, password })`                   |
| Login               | `supabaseClient.auth.signInWithPassword({ email, password })`       |
| Logout              | `supabaseClient.auth.signOut()`                                     |
| Forgot password     | `supabaseClient.auth.resetPasswordForEmail(email, { redirectTo })`  |
| Update password     | `supabaseClient.auth.updateUser({ password })`                      |
| Get current session | `supabaseClient.auth.getSession()`                                  |
| Verify user JWT     | `supabaseClient.auth.getUser()` (validates with Supabase server)    |
| Delete account      | `supabaseClient.functions.invoke('delete-account')` (Edge Function) |

## onAuthStateChange Events

| Event               | Trigger                        | Action in auth store              |
| ------------------- | ------------------------------ | --------------------------------- |
| `INITIAL_SESSION`   | On listener registration       | Sets initial `user` / `session`   |
| `SIGNED_IN`         | After login or register        | Updates `user` and `session` refs |
| `SIGNED_OUT`        | After `signOut()`              | Clears state, resets other stores |
| `TOKEN_REFRESHED`   | Automatic JWT refresh          | Updates `session` ref             |
| `PASSWORD_RECOVERY` | User opens password reset link | Sets `isPasswordRecovery = true`  |
| `USER_UPDATED`      | After `updateUser()`           | Updates `user` ref                |

## Session Persistence

Supabase JS client automatically stores the session in `localStorage`.
On page refresh, `getSession()` restores it and refreshes the JWT if needed.
The JWT expiry (`jwt_expiry = 3600` in `config.toml`) is handled transparently.

## Account Deletion (Edge Function)

Account deletion requires the `service_role` key (admin privilege) and is handled
by the `supabase/functions/delete-account/` Edge Function using a **two-client pattern**:

1. Verify the caller's identity with the anon client + their JWT
2. Delete the user with the admin client (`auth.admin.deleteUser(userId)`)
3. All user data is removed via `ON DELETE CASCADE` on `user_id` foreign keys

The Edge Function reads `SUPABASE_SERVICE_ROLE_KEY` from Supabase's built-in environment —
this secret is **never exposed to the frontend**.

## Row Level Security

All user-owned tables (`profiles`, `trips`, `plan_generations`) enforce RLS with:

```sql
USING (auth.uid() = user_id)
```

The Supabase JS client automatically sends the user's JWT in every request, so
`auth.uid()` resolves correctly. When a user accesses another user's resource,
RLS filters out the row and `.single()` returns a `PGRST116` error (no rows found).

## Common Pitfalls

1. **DO NOT create a second Supabase client** — always import from `src/db/supabase.client.ts`
2. **DO NOT call `$reset()`** on stores — Composition API stores don't support it; use explicit clear actions
3. **DO NOT skip the `isLoading` wait** in the router guard — without it, page refresh always redirects to login
4. **DO NOT store the user ID in `.env`** — always read it from `supabaseClient.auth.getUser()` at runtime

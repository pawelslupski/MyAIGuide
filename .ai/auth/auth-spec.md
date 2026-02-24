# Authentication System — Technical Specification

## 1. Overview

This specification covers the complete authentication system for MyAIGuide, addressing PRD user stories US-001 through US-004. The system uses Supabase Auth for email/password authentication, Pinia for reactive auth state, Vue Router guards for route protection, RLS for database-level data isolation, and an Edge Function for secure account deletion.

### Current State

- No auth store, no login/register views, no router guards, no session management
- RLS is **disabled** (migration `20260111120500_disable_all_rls_policies.sql` drops all policies)
- Router has three routes: `/` (DemoView), `/trips/:id` (TripDetailView), `/:pathMatch(.*)*` (404)
- Supabase client exists at `src/db/supabase.client.ts` with a hardcoded `DEFAULT_USER_ID`
- Stores (`trip.store`, `plan.store`, `profile.store`, `quota.store`) call `supabaseClient.auth.getUser()` but there is no auth initialization
- `config.toml` has `enable_confirmations = false` (no email verification required)

### Target State

- `/` is the authenticated dashboard; unauthenticated users redirect to `/login`
- Full email/password auth cycle: register, login, logout, forgot password, reset password
- Auth store manages reactive session state via `onAuthStateChange`
- Global router guard protects all routes except `/login`, `/register`, `/forgot-password`, `/reset-password`
- RLS re-enabled on all tables
- Account deletion via Edge Function using `service_role` key

---

## 2. UI Architecture

### 2.1 New Views

#### LoginView (`src/views/LoginView.vue`)

**Route:** `/login`
**Layout:** AuthLayout
**Meta:** `{ requiresAuth: false, guestOnly: true }`

**Structure:**

- Centered card (max-w-sm), brand logo/title at top
- Email input (type="email", autocomplete="email")
- Password input (type="password", autocomplete="current-password")
- "Log in" primary Button (full width)
- "Forgot password?" link below form → `/forgot-password`
- "Don't have an account? Register" link → `/register`
- Error Alert below form for auth errors (invalid credentials, network errors)

**Form Validation (client-side, Zod):**

- `email`: required, valid email format
- `password`: required, min 6 characters (matches `config.toml` `minimum_password_length = 6`)

**Behavior:**

- On submit: call `authStore.login(email, password)`
- On success: redirect to `route.query.redirect` or `/` (dashboard)
- On error: display error message in Alert component, do not clear password field
- Loading state: disable button, show spinner text "Logging in..."
- If already authenticated (guestOnly guard): redirect to `/`

**Error Messages:**

- Invalid credentials: "Invalid email or password. Please try again."
- Network error: "Unable to connect. Please check your internet connection."
- Rate limited: "Too many login attempts. Please wait a moment and try again."
- Generic: "An error occurred. Please try again."

#### RegisterView (`src/views/RegisterView.vue`)

**Route:** `/register`
**Layout:** AuthLayout
**Meta:** `{ requiresAuth: false, guestOnly: true }`

**Structure:**

- Centered card (max-w-sm), brand logo/title at top
- Email input (type="email", autocomplete="email")
- Password input (type="password", autocomplete="new-password")
- Confirm password input (type="password", autocomplete="new-password")
- "Create account" primary Button (full width)
- "Already have an account? Log in" link → `/login`
- Error Alert for validation/auth errors

**Form Validation (client-side, Zod):**

- `email`: required, valid email format
- `password`: required, min 6 characters
- `confirmPassword`: required, must match `password`

**Behavior:**

- On submit: call `authStore.register(email, password)`
- On success: user is logged in automatically (no email confirmation required per `config.toml`), redirect to `/` (dashboard)
- On error: display error message, do not clear fields
- Loading state: disable button, show spinner text "Creating account..."

**Error Messages:**

- Email already registered: "An account with this email already exists."
- Weak password: "Password must be at least 6 characters."
- Passwords don't match: "Passwords do not match." (client-side only)
- Generic: "Could not create account. Please try again."

#### ForgotPasswordView (`src/views/ForgotPasswordView.vue`)

**Route:** `/forgot-password`
**Layout:** AuthLayout
**Meta:** `{ requiresAuth: false, guestOnly: true }`

**Structure:**

- Centered card (max-w-sm)
- Heading: "Reset your password"
- Description: "Enter your email address and we'll send you a link to reset your password."
- Email input (type="email", autocomplete="email")
- "Send reset link" primary Button (full width)
- "Back to login" link → `/login`
- Success state: replace form with confirmation message

**Form Validation (client-side, Zod):**

- `email`: required, valid email format

**Behavior:**

- On submit: call `supabaseClient.auth.resetPasswordForEmail(email, { redirectTo })`
- `redirectTo` should point to the app's `/reset-password` URL
- On success: show success message "If an account with that email exists, we've sent a password reset link. Check your inbox."
- Always show the same success message regardless of whether email exists (security best practice)
- Loading state: disable button, show spinner text "Sending..."

#### ResetPasswordView (`src/views/ResetPasswordView.vue`)

**Route:** `/reset-password`
**Layout:** AuthLayout
**Meta:** `{ requiresAuth: false }`

**Structure:**

- Centered card (max-w-sm)
- Heading: "Set new password"
- New password input (type="password", autocomplete="new-password")
- Confirm new password input (type="password", autocomplete="new-password")
- "Update password" primary Button (full width)
- Success state: show confirmation with link to login

**Form Validation (client-side, Zod):**

- `password`: required, min 6 characters
- `confirmPassword`: required, must match `password`

**Behavior:**

- User arrives via Supabase reset email link which contains a recovery token
- Supabase JS client automatically picks up the token from the URL fragment
- The `onAuthStateChange` listener will fire a `PASSWORD_RECOVERY` event
- On submit: call `supabaseClient.auth.updateUser({ password })`
- On success: show success message, link to `/login`
- On error: show error in Alert

**Error Messages:**

- Expired/invalid link: "This reset link has expired or is invalid. Please request a new one."
- Generic: "Could not update password. Please try again."

### 2.2 Layout Components

#### AuthLayout (`src/layouts/AuthLayout.vue`)

**Purpose:** Minimal centered layout for unauthenticated pages (login, register, forgot/reset password).

**Structure:**

```
<div class="min-h-screen flex items-center justify-center bg-background p-4">
  <div class="w-full max-w-sm">
    <div class="text-center mb-8">
      <!-- Brand logo/title -->
      <h1 class="text-2xl font-bold">MyAIGuide</h1>
      <p class="text-muted-foreground mt-1">AI-powered trip planning</p>
    </div>
    <Card>
      <slot />  <!-- View content -->
    </Card>
  </div>
</div>
```

- Supports dark mode via existing theme system (CSS variables)
- Optional: ThemeToggle in top-right corner

#### AppLayout (`src/layouts/AppLayout.vue`)

**Purpose:** Main application shell for authenticated pages with a top header bar.

**Structure:**

```
<div class="min-h-screen bg-background">
  <header class="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
    <div class="container flex h-14 items-center justify-between px-4">
      <!-- Left: Brand -->
      <RouterLink to="/" class="font-bold text-lg">MyAIGuide</RouterLink>

      <!-- Right: User menu -->
      <div class="flex items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              {{ authStore.userEmail }}
              <ChevronDown class="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @click="router.push('/profile')">Profile</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem @click="authStore.logout()">Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </header>

  <main class="container px-4 py-6">
    <slot />
  </main>
</div>
```

**Key decisions:**

- Header-based layout (not sidebar) — simpler for MVP, matches PRD requirement for login/logout button in "top-right corner" (US-002)
- User email displayed in dropdown trigger (PRD says nothing about avatars)
- ThemeToggle preserved from existing implementation
- `container` class for max-width constraint

### 2.3 Route Changes

**Current routes:**

| Path               | Name          | Component      | Auth                      |
| ------------------ | ------------- | -------------- | ------------------------- |
| `/`                | `home`        | DemoView       | No                        |
| `/trips/:id`       | `trip-detail` | TripDetailView | Yes (meta only, no guard) |
| `/:pathMatch(.*)*` | `not-found`   | NotFoundView   | No                        |

**New routes:**

| Path               | Name              | Component          | Auth           | Layout     |
| ------------------ | ----------------- | ------------------ | -------------- | ---------- |
| `/`                | `dashboard`       | DashboardView      | Yes            | AppLayout  |
| `/login`           | `login`           | LoginView          | No (guestOnly) | AuthLayout |
| `/register`        | `register`        | RegisterView       | No (guestOnly) | AuthLayout |
| `/forgot-password` | `forgot-password` | ForgotPasswordView | No (guestOnly) | AuthLayout |
| `/reset-password`  | `reset-password`  | ResetPasswordView  | No             | AuthLayout |
| `/trips/:id`       | `trip-detail`     | TripDetailView     | Yes            | AppLayout  |
| `/profile`         | `profile`         | ProfileView        | Yes            | AppLayout  |
| `/:pathMatch(.*)*` | `not-found`       | NotFoundView       | No             | AuthLayout |

**Key changes:**

- `/` changes from DemoView to DashboardView (authenticated)
- DemoView is removed (or repurposed; for MVP the landing page is the login page)
- New auth-related routes added
- All protected routes wrapped in AppLayout
- All guest routes wrapped in AuthLayout
- `DashboardView` is created as a **stub** for auth routing; full trip-list implementation per US-010 is out of auth scope

**PRD interpretation — "login button in top-right corner" (US-002):**
The PRD says _"Użytkownik może logować się do systemu poprzez przycisk w prawym górnym rogu."_ Since the user chose `/` → Dashboard (authenticated) with unauthenticated users redirected to `/login`, there is no public page that would display a login button in a header. The `/login` page itself IS the entry point for unauthenticated users. The logout button in the top-right header dropdown satisfies the second half of this criterion (_"Użytkownik może się wylogować z systemu poprzez przycisk w prawym górnym rogu na ekranie głównym"_).

### 2.4 Key User Flows

#### Registration Flow

1. User navigates to `/register`
2. Fills in email, password, confirm password
3. Client-side Zod validation runs on submit
4. `authStore.register()` calls `supabaseClient.auth.signUp()`
5. `onAuthStateChange` fires `SIGNED_IN` event
6. Auth store updates reactive state
7. Router guard allows access, redirects to `/` (dashboard)
8. Profile auto-creation trigger (`20260111120400`) creates empty profile in DB — this trigger uses `SECURITY DEFINER` so it bypasses RLS and can INSERT into `profiles` even though `auth.uid()` is not yet set during a server-side trigger execution

#### Login Flow

1. User navigates to `/login` (or redirected from protected route)
2. Fills in email, password
3. Client-side Zod validation runs on submit
4. `authStore.login()` calls `supabaseClient.auth.signInWithPassword()`
5. `onAuthStateChange` fires `SIGNED_IN` event
6. Auth store updates reactive state
7. Router redirects to `query.redirect` or `/` (dashboard)

#### Logout Flow

1. User clicks "Log out" in header dropdown
2. `authStore.logout()` calls `supabaseClient.auth.signOut()`
3. `onAuthStateChange` fires `SIGNED_OUT` event
4. Auth store clears user/session state
5. All other stores are reset via explicit clear functions (see `resetAllStores()` below)
6. Router redirects to `/login`

#### Password Recovery Flow

1. User clicks "Forgot password?" on login page → `/forgot-password`
2. Enters email, submits
3. `supabaseClient.auth.resetPasswordForEmail()` sends recovery email
4. User opens email link → redirected to `/reset-password` with recovery token in URL hash
5. `onAuthStateChange` fires `PASSWORD_RECOVERY` event
6. User enters new password, confirms
7. `supabaseClient.auth.updateUser({ password })` updates password
8. User redirected to `/login` with success message

#### Account Deletion Flow

1. User navigates to profile settings
2. Clicks "Delete account" button (destructive variant)
3. AlertDialog confirmation: "This will permanently delete your account, all trips, and all plans. This action cannot be undone."
4. User confirms by typing "DELETE" or clicking confirm
5. `authStore.deleteAccount()` calls `delete-account` Edge Function
6. Edge Function uses `service_role` to delete user from `auth.users` (cascades to all data)
7. Client-side: `signOut()` clears session
8. Redirect to `/login`

---

## 3. Backend Logic

### 3.1 Auth Store (`src/stores/auth.store.ts`)

**Purpose:** Centralized reactive authentication state management.

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { supabaseClient } from '@/db/supabase.client'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const isLoading = ref(true) // true until initial session check completes
  const isPasswordRecovery = ref(false)

  // Getters
  const isAuthenticated = computed(() => !!session.value)
  const userId = computed(() => user.value?.id ?? null)
  const userEmail = computed(() => user.value?.email ?? null)

  /**
   * Initialize auth state and set up listener.
   * Must be called once in App.vue (or main.ts) before router starts navigating.
   */
  function initialize(): void {
    // Set up auth state change listener
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

    // Get initial session (synchronous check of stored session)
    supabaseClient.auth.getSession().then(({ data }) => {
      session.value = data.session
      user.value = data.session?.user ?? null
      isLoading.value = false
    })
  }

  async function login(email: string, password: string): Promise<void> {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    })
    if (error) throw error
    // State is updated via onAuthStateChange listener
  }

  async function register(email: string, password: string): Promise<void> {
    const { error } = await supabaseClient.auth.signUp({
      email,
      password
    })
    if (error) throw error
    // State is updated via onAuthStateChange listener
  }

  async function logout(): Promise<void> {
    const { error } = await supabaseClient.auth.signOut()
    if (error) throw error
    // State is cleared via onAuthStateChange listener (SIGNED_OUT event)
  }

  async function resetPassword(email: string): Promise<void> {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) throw error
  }

  async function updatePassword(newPassword: string): Promise<void> {
    const { error } = await supabaseClient.auth.updateUser({
      password: newPassword
    })
    if (error) throw error
    isPasswordRecovery.value = false
  }

  async function deleteAccount(): Promise<void> {
    const { error } = await supabaseClient.functions.invoke('delete-account')
    if (error) throw error
    await logout()
  }

  /**
   * Reset all Pinia stores on logout.
   * Prevents stale data from previous session.
   *
   * NOTE: Composition API stores do NOT support Pinia's $reset().
   * Each store must expose an explicit clear/reset action, or we
   * must manually set refs back to their initial values here.
   */
  function resetAllStores(): void {
    // Lazy imports to avoid circular dependencies
    import('@/stores/trip.store').then(({ useTripStore }) => {
      const tripStore = useTripStore()
      tripStore.clearTrip() // existing action
    })
    import('@/stores/plan.store').then(({ usePlanStore }) => {
      const planStore = usePlanStore()
      planStore.discardCandidate() // existing action
    })
    import('@/stores/profile.store').then(({ useProfileStore }) => {
      const profileStore = useProfileStore()
      profileStore.profile = null // direct ref reset
    })
    // quota store — reset to null so it re-fetches on next login
    import('@/stores/quota.store').then(({ useQuotaStore }) => {
      const quotaStore = useQuotaStore()
      if ('quota' in quotaStore) {
        quotaStore.quota = null
      }
    })
  }

  return {
    // State
    user,
    session,
    isLoading,
    isPasswordRecovery,
    // Getters
    isAuthenticated,
    userId,
    userEmail,
    // Actions
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

**Key design decisions:**

1. **`onAuthStateChange` as single source of truth:** All state updates go through the listener. `login()` and `register()` do not manually set `user`/`session` — the listener handles it. This prevents race conditions and ensures consistency.

2. **`isLoading` flag:** Starts `true`, set to `false` after `getSession()` resolves. The router guard waits for `isLoading === false` before making auth decisions. This prevents flash-of-login-page on refresh.

3. **`isPasswordRecovery` flag:** Set when `PASSWORD_RECOVERY` event fires. Used by ResetPasswordView to know the user arrived via a recovery link.

4. **Store reset on logout:** When `SIGNED_OUT` fires, all stores (trip, plan, profile, quota) must be reset to prevent data leakage between accounts. Because all project stores use Composition API syntax (`defineStore('name', () => {...})`), Pinia's built-in `$reset()` is **not available**. Each store is reset via its existing clear action (e.g. `clearTrip()`, `discardCandidate()`) or by directly setting refs to `null`.

### 3.2 Router Guard

**File:** `src/router/index.ts`

```typescript
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  // Guest-only routes (redirect to / if authenticated)
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { requiresAuth: false, guestOnly: true }
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { requiresAuth: false, guestOnly: true }
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('@/views/ForgotPasswordView.vue'),
    meta: { requiresAuth: false, guestOnly: true }
  },
  // Reset password — NOT guestOnly (user may have a session from the recovery link)
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('@/views/ResetPasswordView.vue'),
    meta: { requiresAuth: false }
  },
  // Protected routes
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/trips/:id',
    name: 'trip-detail',
    component: () => import('@/views/TripView.vue'),
    meta: { requiresAuth: true },
    beforeEnter: (to: any) => {
      const tripId = parseInt(to.params.id as string, 10)
      if (isNaN(tripId) || tripId <= 0) {
        return { name: 'not-found' }
      }
    }
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/ProfileView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    return { top: 0 }
  }
})

router.beforeEach(async (to) => {
  const { watch } = await import('vue')
  const { useAuthStore } = await import('@/stores/auth.store')
  const authStore = useAuthStore()

  // Wait for initial auth state to be determined
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

  // Protected route — redirect to login if not authenticated
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  // Guest-only route — redirect to dashboard if already authenticated
  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return { name: 'dashboard' }
  }
})

export default router
```

**Key design decisions:**

1. **Async dynamic import of auth store:** Avoids circular dependency issues between router and store. Uses dynamic `import()` inside `beforeEach`.

2. **Wait for `isLoading`:** The guard waits until the initial `getSession()` call completes. Without this, a page refresh would always redirect to `/login` because the session hasn't been restored yet.

3. **`guestOnly` meta:** Prevents authenticated users from seeing login/register pages. They are redirected to dashboard. Exception: `/reset-password` is NOT guestOnly because the recovery link creates a temporary session.

4. **Redirect preservation:** When redirecting to login, the original target path is stored in `query.redirect` so the user can be redirected back after successful login.

### 3.3 Auth Initialization

**File:** `src/App.vue` (or `src/main.ts`)

```typescript
// In App.vue <script setup>
import { useAuthStore } from '@/stores/auth.store'

const authStore = useAuthStore()
authStore.initialize()
```

`initialize()` must be called **before** any navigation occurs. Two options:

**Option A — In App.vue setup (recommended):**
The `App.vue` component runs its `<script setup>` synchronously before the first render. Call `initialize()` here. The router guard handles waiting for `isLoading` to become false.

**Option B — In main.ts before mounting:**

```typescript
const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

const authStore = useAuthStore()
authStore.initialize()

app.use(router)
app.mount('#app')
```

Option A is simpler and recommended.

### 3.4 Account Deletion Edge Function

**File:** `supabase/functions/delete-account/index.ts`

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST allowed' } }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // 1. Extract user from the request's Authorization header (anon key JWT)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Missing authorization' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create anon client to verify the user's JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const {
      data: { user },
      error: userError
    } = await anonClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid session' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Use service_role client to delete the user
    // service_role bypasses RLS and has admin privileges
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)
    if (deleteError) {
      console.error('[ERROR] Failed to delete user:', deleteError)
      return new Response(
        JSON.stringify({
          error: {
            code: 'DELETION_FAILED',
            message: 'Failed to delete account. Please try again.'
          }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. All user data (profiles, trips, plan_generations) is cascade-deleted
    // via ON DELETE CASCADE foreign keys on user_id

    console.log(`[INFO] User ${user.id} account deleted successfully`)

    return new Response(JSON.stringify({ message: 'Account successfully deleted' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[ERROR] Unexpected error:', error)
    return new Response(
      JSON.stringify({
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

**Key design decisions:**

1. **service_role key:** Required because `auth.admin.deleteUser()` needs admin privileges. The anon key cannot delete users. The service_role key is automatically available to Edge Functions via `SUPABASE_SERVICE_ROLE_KEY` env var.

2. **Two-client pattern:** First verify the user's identity using the anon client + their JWT, then use the admin client to perform the deletion. This ensures only the authenticated user can trigger their own deletion.

3. **Cascade deletion:** No need to manually delete profiles, trips, or plan_generations — the `ON DELETE CASCADE` foreign keys handle this automatically when the user is removed from `auth.users`.

### 3.5 Zod Validation Schemas

**File:** `src/lib/validation/auth.schemas.ts`

```typescript
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters')
})

export const registerSchema = z
  .object({
    email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
    password: z
      .string()
      .min(1, 'Password is required')
      .min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password')
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address')
})

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(1, 'Password is required')
      .min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password')
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })

export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>
```

### 3.6 Removing DEFAULT_USER_ID

The `DEFAULT_USER_ID` constant in `src/db/supabase.client.ts` must be removed. All code that references it should instead get the user ID from `supabaseClient.auth.getUser()` (which the existing stores already do).

Additionally, `SUPABASE_USER_ID` must be removed from `.env.example` — it is a pre-auth development artifact that is never referenced in source code. With real authentication, the user ID is always obtained from the Supabase session at runtime.

---

## 4. Authentication System

### 4.1 Supabase Auth Flows

All auth operations use the Supabase JS client (`@supabase/supabase-js`). No custom auth API endpoints are needed.

| Operation       | Method                                                             | Notes                                   |
| --------------- | ------------------------------------------------------------------ | --------------------------------------- |
| Register        | `supabaseClient.auth.signUp({ email, password })`                  | No email confirmation (per config.toml) |
| Login           | `supabaseClient.auth.signInWithPassword({ email, password })`      | Returns session + user                  |
| Logout          | `supabaseClient.auth.signOut()`                                    | Clears local session                    |
| Forgot password | `supabaseClient.auth.resetPasswordForEmail(email, { redirectTo })` | Sends recovery email                    |
| Update password | `supabaseClient.auth.updateUser({ password })`                     | Used after recovery link                |
| Get session     | `supabaseClient.auth.getSession()`                                 | Check stored session                    |
| Get user        | `supabaseClient.auth.getUser()`                                    | Validates JWT with server               |
| Delete account  | `supabaseClient.functions.invoke('delete-account')`                | Custom Edge Function                    |

### 4.2 Session Management via `onAuthStateChange`

The `onAuthStateChange` listener is the **central mechanism** for auth state management. It fires on:

| Event               | When                           | Action                           |
| ------------------- | ------------------------------ | -------------------------------- |
| `INITIAL_SESSION`   | On listener registration       | Set initial state                |
| `SIGNED_IN`         | After login or register        | Update `user` and `session` refs |
| `SIGNED_OUT`        | After logout                   | Clear all state, reset stores    |
| `TOKEN_REFRESHED`   | When JWT is refreshed          | Update `session` ref             |
| `PASSWORD_RECOVERY` | When user clicks recovery link | Set `isPasswordRecovery` flag    |
| `USER_UPDATED`      | After `updateUser()`           | Update `user` ref                |

**Token refresh:** Supabase JS client handles JWT refresh automatically. The `TOKEN_REFRESHED` event updates the session ref so components always have the latest token. The JWT expiry is 3600s (1 hour) per `config.toml`.

**Session persistence:** Supabase JS client stores the session in `localStorage` by default. On page refresh, `getSession()` retrieves the stored session and the client validates/refreshes the JWT automatically.

### 4.3 RLS Re-enablement Migration

**File:** `supabase/migrations/20260222000000_reenable_rls.sql`

This migration reverses `20260111120500_disable_all_rls_policies.sql` by re-enabling RLS and recreating all policies.

```sql
-- migration: re-enable row level security on all tables
-- purpose: restore per-user data isolation for production auth
-- affected tables: profiles, trips, plan_generations
-- dependencies: auth system implementation
-- considerations:
--   - reverses 20260111120500_disable_all_rls_policies.sql
--   - all policies use auth.uid() to match user_id
--   - plan_generations remains append-only (no UPDATE policy)

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================

alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own profile"
  on profiles for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- TRIPS TABLE
-- ============================================================================

alter table trips enable row level security;

create policy "Users can view own trips"
  on trips for select
  using (auth.uid() = user_id);

create policy "Users can insert own trips"
  on trips for insert
  with check (auth.uid() = user_id);

create policy "Users can update own trips"
  on trips for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own trips"
  on trips for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- PLAN_GENERATIONS TABLE
-- ============================================================================

alter table plan_generations enable row level security;

create policy "Users can view own generations"
  on plan_generations for select
  using (auth.uid() = user_id);

create policy "Users can insert own generations"
  on plan_generations for insert
  with check (auth.uid() = user_id);

-- No UPDATE policy (append-only table)

create policy "Users can delete own generations"
  on plan_generations for delete
  using (auth.uid() = user_id);

-- Update table comments
comment on table profiles is 'User profiles storing global preferences and flags (1:1 with auth.users)';
comment on table trips is 'User trips with notes, preferences, and confirmed plans';
comment on table plan_generations is 'AI plan generation attempts for rate limiting and diagnostics (append-only)';
```

### 4.4 config.toml Adjustments

The current `config.toml` has:

```toml
site_url = "http://127.0.0.1:3000"
additional_redirect_urls = ["https://127.0.0.1:3000"]
```

**Required changes:**

```toml
# Fix site_url to match Vite dev server port
site_url = "http://127.0.0.1:5173"

# Update redirect URLs to match Vite dev server
additional_redirect_urls = ["http://127.0.0.1:5173/reset-password"]
```

The `site_url` must match the Vite dev server port (5173, not 3000) for password reset emails to generate correct links. The `additional_redirect_urls` should include the reset password path.

Other relevant settings (already correct):

- `enable_confirmations = false` — no email verification needed to sign in after registration
- `enable_signup = true` — registration is allowed
- `minimum_password_length = 6` — matches Zod validation
- `enable_anonymous_sign_ins = false` — only email/password auth
- `jwt_expiry = 3600` — 1 hour token lifetime (auto-refreshed)

---

## 5. Files to Create/Modify

### New Files

| File                                                  | Purpose                                  |
| ----------------------------------------------------- | ---------------------------------------- |
| `src/stores/auth.store.ts`                            | Auth state management (Pinia)            |
| `src/views/LoginView.vue`                             | Login page                               |
| `src/views/RegisterView.vue`                          | Registration page                        |
| `src/views/ForgotPasswordView.vue`                    | Password reset request page              |
| `src/views/ResetPasswordView.vue`                     | New password entry page                  |
| `src/views/DashboardView.vue`                         | Trip list dashboard (replaces `/` route) |
| `src/layouts/AuthLayout.vue`                          | Minimal centered layout for auth pages   |
| `src/layouts/AppLayout.vue`                           | Main app shell with header               |
| `src/lib/validation/auth.schemas.ts`                  | Zod schemas for auth forms               |
| `supabase/functions/delete-account/index.ts`          | Edge Function for account deletion       |
| `supabase/migrations/20260222000000_reenable_rls.sql` | Re-enable RLS policies                   |

### Modified Files

| File                        | Changes                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| `src/router/index.ts`       | New routes, global auth guard, layout wrapping                    |
| `src/db/supabase.client.ts` | Remove `DEFAULT_USER_ID`                                          |
| `src/App.vue`               | Call `authStore.initialize()`, wrap router-view with layouts      |
| `supabase/config.toml`      | Fix `site_url` to port 5173, update `additional_redirect_urls`    |
| `.env.example`              | Remove `SUPABASE_USER_ID` (pre-auth artifact, never used in code) |

### Unchanged Files

The existing stores (`trip.store.ts`, `plan.store.ts`, `profile.store.ts`, `quota.store.ts`) already call `supabaseClient.auth.getUser()` for user context. With auth properly initialized, these will work without modification. The `DEFAULT_USER_ID` fallback in services should be removed.

---

## 6. PRD Acceptance Criteria Verification

### US-001: Registration

| Criterion                                                                               | Covered                                                  |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Login and registration on dedicated pages                                               | Yes — `/login` and `/register` routes                    |
| Registration requires email, password, confirm password                                 | Yes — RegisterView with Zod validation                   |
| After successful registration, account created, user logged in, redirected to dashboard | Yes — `signUp()` + `onAuthStateChange` + redirect to `/` |
| Invalid data shows clear error messages                                                 | Yes — Zod validation + Supabase error mapping            |

### US-002: Login, Logout, Route Protection

| Criterion                                                         | Covered                                                                                                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Login and registration on dedicated pages                         | Yes                                                                                                                                        |
| Login requires email and password                                 | Yes — LoginView with Zod validation                                                                                                        |
| Unauthenticated access to protected routes redirects to login     | Yes — router `beforeEach` guard                                                                                                            |
| After login, user sees dashboard; after logout, loses access      | Yes — auth store + guard                                                                                                                   |
| Login button in top-right corner                                  | Reinterpreted — no public page exists; unauthenticated users land directly on `/login` full-page form (see section 2.3 PRD interpretation) |
| Logout button in top-right corner on main screen                  | Yes — header dropdown                                                                                                                      |
| No external auth providers (Google, GitHub)                       | Yes — only email/password                                                                                                                  |
| Password recovery is possible                                     | Yes — `/forgot-password` + `/reset-password`                                                                                               |
| All actions (generate, save, delete, edit) require authentication | Yes — router guard + RLS                                                                                                                   |

### US-003: Data Isolation

| Criterion                                                | Covered                                                                                                                                                              |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User sees only their own notes, profile, plans           | Yes — RLS policies with `auth.uid() = user_id`                                                                                                                       |
| Accessing another user's resources results in auth error | Yes — RLS filters out rows; existing stores use `.single()` which throws `PGRST116` (no rows) when the row belongs to another user, surfaced as an error to the user |

### US-004: Account Deletion

| Criterion                                                                | Covered                                            |
| ------------------------------------------------------------------------ | -------------------------------------------------- |
| "Delete account" action with clear warning                               | Yes — AlertDialog with destructive confirmation    |
| After confirmation, account + notes + plans deleted; re-login impossible | Yes — Edge Function `admin.deleteUser()` + CASCADE |

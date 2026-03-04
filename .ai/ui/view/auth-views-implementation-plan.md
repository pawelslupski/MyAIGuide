# Auth Views — Combined Implementation Plan

## 1. Overview

This document covers all four authentication views and their shared infrastructure for MyAIGuide MVP.
It reflects the **current state of the codebase** and identifies the remaining work.

### PRD User Stories Covered

- **US-001** – Registration
- **US-002** – Login, logout, route protection, password recovery
- **US-003** – Data isolation (enforced via RLS; UI only shows own data)
- **US-004** – Account deletion (covered in `auth-spec.md §3.4`; not a view)

### Views in Scope

| View                 | Path               | Route meta                | Status                 |
| -------------------- | ------------------ | ------------------------- | ---------------------- |
| `LoginView.vue`      | `/login`           | `{ guestOnly: true }`     | ✅ Implemented         |
| `RegisterView.vue`   | `/register`        | `{ guestOnly: true }`     | ✅ Implemented         |
| `ForgotPasswordView` | `/forgot-password` | `{ guestOnly: true }`     | ⚠️ Stub — needs wiring |
| `ResetPasswordView`  | `/reset-password`  | `{ requiresAuth: false }` | ⚠️ Stub — needs wiring |

> **Not in scope here:** `NotFoundView.vue` (trivial 404 page, no auth logic).

---

## 2. Shared Infrastructure

### 2.1 AuthLayout (`src/layouts/AuthLayout.vue`) — ✅ Implemented

Minimal centered layout wrapping all four auth views.

```
min-h-screen centered  →  max-w-sm card  →  slot (view content)
```

- Brand header: "MyAIGuide / AI-powered trip planning"
- `ThemeToggle` pinned `top-4 right-4`
- shadcn-vue `Card` as container; view injects `CardHeader`, `CardContent`, `CardFooter`

### 2.2 Route Configuration (`src/router/index.ts`) — ✅ Implemented

```typescript
// guestOnly routes (→ dashboard when authenticated)
{ path: '/login',           name: 'login',           meta: { guestOnly: true } }
{ path: '/register',        name: 'register',         meta: { guestOnly: true } }
{ path: '/forgot-password', name: 'forgot-password',  meta: { guestOnly: true } }
// public but NOT guestOnly (recovery link creates a temporary session)
{ path: '/reset-password',  name: 'reset-password',   meta: { requiresAuth: false } }
```

`router.beforeEach` waits for `authStore.isLoading === false` before enforcing guards — prevents
false redirect to `/login` on page refresh while Supabase restores the stored session.

### 2.3 Zod Validation Schemas (`src/lib/validation/auth.schemas.ts`) — ✅ Implemented

| Export                 | Fields validated                                      |
| ---------------------- | ----------------------------------------------------- |
| `loginSchema`          | `email` (required, valid), `password` (required, ≥ 6) |
| `registerSchema`       | above + `confirmPassword` (must match)                |
| `forgotPasswordSchema` | `email` (required, valid)                             |
| `resetPasswordSchema`  | `password` (required, ≥ 6) + `confirmPassword` match  |

Matching type exports: `LoginFormData`, `RegisterFormData`, `ForgotPasswordFormData`, `ResetPasswordFormData`.

### 2.4 AuthStore (`src/stores/auth.store.ts`) — ⚠️ Partially Implemented

**Implemented actions:** `initialize`, `login`, `register`, `logout`, `deleteAccount`

**Missing actions (must be added):**

```typescript
async function resetPassword(email: string): Promise<void> {
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  })
  if (error) throw error
}

async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabaseClient.auth.updateUser({ password: newPassword })
  if (error) throw error
}
```

Both must be added to the store's `return` object.

**Missing state (must be added):**

```typescript
// Tracks whether user arrived via PASSWORD_RECOVERY email link.
// Set by onAuthStateChange; consumed by ResetPasswordView.
const isPasswordRecovery = ref(false)
```

Inside `initialize()`, the existing `onAuthStateChange` handler must also handle:

```typescript
if (event === 'PASSWORD_RECOVERY') {
  isPasswordRecovery.value = true
}
```

`isPasswordRecovery` must be included in the store's `return` object.

---

## 3. LoginView (`src/views/LoginView.vue`) — ✅ Implemented

**Structure:** `CardHeader` (title) → `CardContent` (form) → `CardFooter` (register link)

**Form fields:**

| Field      | Input type | Autocomplete       | Validation             |
| ---------- | ---------- | ------------------ | ---------------------- |
| `email`    | `email`    | `email`            | Required, valid format |
| `password` | `password` | `current-password` | Required, ≥ 6 chars    |

**Behavior:**

- `handleSubmit` runs `loginSchema.safeParse`, maps field errors to `fieldErrors` reactive
- On success: `authStore.login(email, password)` → `router.push(route.query.redirect ?? '/')`
- On error: `mapAuthError()` maps Supabase error message to user-friendly string; password field preserved
- Loading state: button disabled, text "Logging in...", `Loader2` spinner

**Error mapping (`mapAuthError`):**

| Supabase error keyword    | Displayed message                                |
| ------------------------- | ------------------------------------------------ |
| `invalid` / `credentials` | "Invalid email or password. Please try again."   |
| `rate` / `too many`       | "Too many login attempts. Please wait a moment…" |
| `network` / `fetch`       | "Unable to connect. Please check your internet…" |
| _(fallback)_              | "An error occurred. Please try again."           |

**Links:** "Forgot password?" → `/forgot-password` · "Register" → `/register`

---

## 4. RegisterView (`src/views/RegisterView.vue`) — ✅ Implemented

**Structure:** `CardHeader` → `CardContent` (form) → `CardFooter` (login link)

**Form fields:**

| Field             | Input type | Autocomplete   | Validation             |
| ----------------- | ---------- | -------------- | ---------------------- |
| `email`           | `email`    | `email`        | Required, valid format |
| `password`        | `password` | `new-password` | Required, ≥ 6 chars    |
| `confirmPassword` | `password` | `new-password` | Required, must match   |

**Behavior:**

- `handleSubmit` runs `registerSchema.safeParse` (Zod `.refine` handles password match)
- On success: `authStore.register(email, password)` → `router.push('/')`
- No email confirmation required (`enable_confirmations = false` in `config.toml`)
- Profile auto-created by DB trigger on `auth.users` INSERT

**Error mapping (`mapRegisterError`):**

| Supabase error keyword | Displayed message                             |
| ---------------------- | --------------------------------------------- |
| `already` / `exists`   | "An account with this email already exists."  |
| `password` + `weak`    | "Password must be at least 6 characters."     |
| _(fallback)_           | "Could not create account. Please try again." |

**Links:** "Log in" → `/login`

---

## 5. ForgotPasswordView (`src/views/ForgotPasswordView.vue`) — ⚠️ Needs Wiring

The view UI is complete. Only the `authStore` call is missing (currently a `TODO` stub).

**Required change — remove TODO and wire up the store:**

```typescript
// Replace:
// TODO: import { useAuthStore } from '@/stores/auth.store'
// const authStore = useAuthStore()

// With:
import { useAuthStore } from '@/stores/auth.store'
const authStore = useAuthStore()

// Replace in handleSubmit:
// TODO: await authStore.resetPassword(form.email)

// With:
await authStore.resetPassword(form.email)
```

**Full behavior:**

- On submit: calls `authStore.resetPassword(email)` → sets `submitted = true`
- On _any_ outcome (success or error): always shows success state — prevents email enumeration
- Success state shows `MailCheck` icon + "If an account with that email exists, we've sent…"
- Supabase sends link to `${window.location.origin}/reset-password` (set inside `resetPassword()`)

---

## 6. ResetPasswordView (`src/views/ResetPasswordView.vue`) — ⚠️ Needs Wiring

The view UI is complete. The `authStore` call is a `TODO` stub.

**Required change — remove TODO and wire up the store:**

```typescript
// Replace comments with:
import { useAuthStore } from '@/stores/auth.store'
const authStore = useAuthStore()

// Replace in handleSubmit:
// TODO: await authStore.updatePassword(form.password)

// With:
await authStore.updatePassword(form.password)
```

**How the recovery token is handled:**

1. User clicks the link in the Supabase recovery email
2. The link redirects to `/reset-password` with a token in the URL hash
3. Supabase JS client automatically picks up the token and fires `PASSWORD_RECOVERY` event
4. `authStore.initialize()` (called in `App.vue`) sets `isPasswordRecovery = true`
5. View calls `supabaseClient.auth.updateUser({ password })` via `authStore.updatePassword()`

**Error mapping (`mapResetError`):**

| Supabase error keyword          | Displayed message                                                      |
| ------------------------------- | ---------------------------------------------------------------------- |
| `expired` / `invalid` / `token` | "This reset link has expired or is invalid. Please request a new one." |
| _(fallback)_                    | "Could not update password. Please try again."                         |

**Success state:** `ShieldCheck` icon + "Your password has been updated successfully." + "Go to login" button.

**Footer link (form state only):** "Request a new reset link" → `/forgot-password`

---

## 7. Supabase Auth Operations Reference

| Operation       | Method                                                             | Notes                            |
| --------------- | ------------------------------------------------------------------ | -------------------------------- |
| Login           | `supabaseClient.auth.signInWithPassword({ email, password })`      | State via `onAuthStateChange`    |
| Register        | `supabaseClient.auth.signUp({ email, password })`                  | No email confirmation required   |
| Logout          | `supabaseClient.auth.signOut()`                                    | Triggers `SIGNED_OUT` event      |
| Forgot password | `supabaseClient.auth.resetPasswordForEmail(email, { redirectTo })` | `redirectTo` = `/reset-password` |
| Update password | `supabaseClient.auth.updateUser({ password })`                     | User must have active session    |
| Session restore | `supabaseClient.auth.getSession()`                                 | Called in `initialize()`         |

---

## 8. `onAuthStateChange` Event Handling

| Event               | Trigger                        | AuthStore action                     |
| ------------------- | ------------------------------ | ------------------------------------ |
| `SIGNED_IN`         | After login or register        | Update `user`, `session`             |
| `SIGNED_OUT`        | After logout                   | Clear state, call `resetAllStores()` |
| `TOKEN_REFRESHED`   | JWT auto-refresh (every ~1 h)  | Update `session`                     |
| `PASSWORD_RECOVERY` | User opens recovery email link | Set `isPasswordRecovery = true`      |
| `USER_UPDATED`      | After `updateUser()`           | Update `user`                        |

---

## 9. Accessibility

- All inputs use `<Label for="...">` bound to matching `id`
- Field-level error messages rendered as `<p class="text-xs text-destructive">` immediately below each input
- Error border: `border-destructive focus-visible:ring-destructive` on invalid inputs
- Global auth errors use shadcn-vue `<Alert variant="destructive">`
- Submit buttons disable during loading with `Loader2` spinner and descriptive text
- `novalidate` on `<form>` disables browser native validation (Zod handles it)
- All forms use `@submit.prevent` — no native form submission

---

## 10. Remaining Work Checklist

### `src/stores/auth.store.ts`

- [ ] Add `isPasswordRecovery` ref (initial value `false`)
- [ ] Handle `PASSWORD_RECOVERY` event in `onAuthStateChange` → set `isPasswordRecovery = true`
- [ ] Add `resetPassword(email: string)` action
- [ ] Add `updatePassword(newPassword: string)` action
- [ ] Export `isPasswordRecovery`, `resetPassword`, `updatePassword` in the return object

### `src/views/ForgotPasswordView.vue`

- [ ] Remove TODO comments
- [ ] Import and use `useAuthStore`
- [ ] Wire `authStore.resetPassword(form.email)` in `handleSubmit`

### `src/views/ResetPasswordView.vue`

- [ ] Remove TODO comments
- [ ] Import and use `useAuthStore`
- [ ] Wire `authStore.updatePassword(form.password)` in `handleSubmit`

### Already Complete (no changes needed)

- [x] `AuthLayout.vue` — fully implemented
- [x] `LoginView.vue` — fully implemented
- [x] `RegisterView.vue` — fully implemented
- [x] `src/router/index.ts` — fully implemented (routes + guard)
- [x] `src/lib/validation/auth.schemas.ts` — all four schemas present

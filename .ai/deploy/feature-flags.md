# Feature Flags – Implementation Plan

## Goal

Separate deployments from releases by introducing a lightweight, environment-aware feature flag
system. Each flag controls whether a given feature is active for a given environment (`local`,
`integration`, `prod`). Flags are resolved **once at module load time** and never change while the
application is running.

---

## Key Design Decisions

| Decision                 | Choice                                                                                                         | Reason                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Single source of truth   | `src/lib/features/flags.ts`                                                                                    | Shared by frontend (Vite/Vue) and backend (Deno/Edge Functions) via relative import                                                 |
| Config structure         | **Feature-first** (outer key = feature, inner key = env)                                                       | Adding a new flag = one new block; environments never need to be touched separately                                                 |
| ENV resolution           | Once at module load → cached in `const ENV`                                                                    | No reactive overhead; consistent for the entire lifetime of the process                                                             |
| ENV source – frontend    | `import.meta.env.VITE_ENV_NAME` (Vite)                                                                         | Follows existing project convention (see `.ai/auth/supabase-auth.md`)                                                               |
| ENV source – backend     | `Deno.env.get('ENV_NAME')`                                                                                     | Standard Deno runtime API used by all Supabase Edge Functions                                                                       |
| Fallback                 | `'local'`                                                                                                      | Safest default – dev environment, flags can be off without breaking anything                                                        |
| Disabled-route behaviour | Routes with `requiresFeature` redirect to `/maintenance`; `requiresAuth` routes allow through when auth is off | Auth routes stay accessible in local only if they also set `requiresFeature: 'auth'`; currently they don't, so they render normally |
| Debug logging            | `console.log` on every `isFeatureEnabled` call                                                                 | Diagnosability without adding a runtime dependency                                                                                  |

---

## Flag Configuration (`src/lib/features/flags.ts`)

### Type model

```typescript
export type FeatureName = 'auth' | 'plan-generation' // extend here for new flags
export type EnvName = 'local' | 'integration' | 'prod'

type FeatureConfig = Record<FeatureName, Record<EnvName, boolean>>
```

### Feature-first structure

```typescript
const featureFlags: FeatureConfig = {
  auth: {
    local: false, // disabled locally — anonymous sign-in used instead
    integration: true,
    prod: true
  },
  'plan-generation': {
    local: true,
    integration: true,
    prod: true
  }
}
```

**Adding a new flag in the future:**

1. Add the flag name to `FeatureName`
2. Add one new block to `featureFlags` with all three env values
3. Nothing else needs to change

### ENV resolution (called once)

```typescript
// Resolved once when the module is first imported — never re-evaluated
const ENV: EnvName = resolveEnv()

function resolveEnv(): EnvName {
  // Vite/browser: VITE_ENV_NAME injected at build time
  const viteEnv = (import.meta as any).env?.VITE_ENV_NAME
  if (viteEnv === 'local' || viteEnv === 'integration' || viteEnv === 'prod') return viteEnv

  // Deno: ENV_NAME from process environment (Supabase Edge Functions)
  if (typeof Deno !== 'undefined') {
    const denoEnv = Deno.env.get('ENV_NAME')
    if (denoEnv === 'local' || denoEnv === 'integration' || denoEnv === 'prod') {
      return denoEnv as EnvName
    }
  }

  return 'local' // safe fallback
}
```

### Public API

```typescript
export function isFeatureEnabled(feature: FeatureName): boolean {
  const result = featureFlags[feature][ENV]
  console.log(`[FeatureFlags] isFeatureEnabled('${feature}') → ${result} (env: ${ENV})`)
  return result
}
```

The `env` override parameter is removed — flags are always evaluated against the pre-resolved
`ENV` constant. This enforces the "configured once at startup" rule.

---

## Environment Variable Setup

### Frontend (`.env` / `.env.example`)

```env
VITE_ENV_NAME=local   # local | integration | prod
```

### Backend (Supabase Edge Functions)

Set `ENV_NAME` as a Supabase secret or in the local `.env` file used by `supabase functions serve`:

```bash
supabase secrets set ENV_NAME=prod
# or locally:
ENV_NAME=integration supabase functions serve
```

---

## Auth-disabled local behaviour

When `auth.local = false`:

1. **Auth routes** (`/login`, `/register`, etc.) redirect to `/maintenance` (controlled by `requiresFeature: 'auth'`).
2. **Protected routes** (dashboard, trip-detail) are **allowed through** — no login redirect.
3. **Auth store** calls `signInAnonymously()` on startup so a real Supabase JWT is created, enabling RLS. The trigger on `auth.users` auto-creates a profile row for the anonymous user.
4. **Stores** call `getSession()` (local cache, no network round-trip) to retrieve the user. If sign-in fails and no session exists, `fetchProfile` and `fetchTrips` **return silently** (empty state) instead of showing an error. A `console.error` is emitted so failures are visible in DevTools.

> **Note:** Requires `enable_anonymous_sign_ins = true` in `supabase/config.toml` and a running local Supabase instance (`supabase start`). If Supabase was started before that setting was added, run `supabase stop && supabase start` to pick it up.

---

## Integration Points

### 1. Router — `src/router/index.ts`

- `requiresFeature?: FeatureName` added to `RouteMeta`
- `/maintenance` route added (no guard)
- Auth routes (`/login`, `/register`, `/forgot-password`) use `guestOnly: true` — **not** `requiresFeature: 'auth'`, so they are **not** redirected to `/maintenance` when auth is off; they render normally
- In `beforeEach`, the full guard order is:

```typescript
// 1. Feature-gated routes → maintenance when flag is off
if (to.meta.requiresFeature && !isFeatureEnabled(to.meta.requiresFeature)) {
  return { name: 'maintenance' }
}

// 2. Wait for auth store to finish initialising (handles page-refresh race)
if (authStore.isLoading) {
  /* watch until false */
}

// 3. Auth guard — only active when auth is enabled
if (to.meta.requiresAuth && !authStore.isAuthenticated && isFeatureEnabled('auth')) {
  return { name: 'login', query: { redirect: to.fullPath } }
}

// 4. Guest-only redirect — only active when auth is enabled
if (to.meta.guestOnly && authStore.isAuthenticated && isFeatureEnabled('auth')) {
  return { name: 'dashboard' }
}
```

When `auth` is disabled: `requiresAuth` routes allow through; `guestOnly` redirect is skipped.

### 2. Component — `src/components/PlanPanel.vue`

- Import `isFeatureEnabled` and evaluate once in `<script setup>`
- When disabled: render a "not available" card instead of the full generation UI
- When enabled: render the existing component unchanged

### 3. View — `src/views/TripView.vue`

- Import `isFeatureEnabled` and evaluate once in `<script setup>`
- Wrap `<PlanPanel>` with `v-if="isPlanGenerationEnabled"`
- When disabled: render a simple placeholder `<div>` (no Card import needed)

### 4. Edge Function — `supabase/functions/api/index.ts`

- Import `isFeatureEnabled` via `'../../../src/lib/features/flags.ts'`
- After CORS preflight, before routing:

```typescript
if (!isFeatureEnabled('auth')) {
  return new Response(
    JSON.stringify({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Auth feature is disabled in this environment'
      }
    }),
    { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
```

### 5. Edge Function — `supabase/functions/generate-plan/index.ts`

- Import `isFeatureEnabled` via `'../../../src/lib/features/flags.ts'`
- After CORS preflight and method check, before authentication:

```typescript
if (!isFeatureEnabled('plan-generation')) {
  return createErrorResponse(
    503,
    'SERVICE_UNAVAILABLE',
    'Plan generation is disabled in this environment'
  )
}
```

---

## New / Modified Files

| File                                        | Action     | Notes                                                                                                    |
| ------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| `src/lib/features/flags.ts`                 | **Create** | Universal flag module                                                                                    |
| `src/views/MaintenanceView.vue`             | **Create** | Redirect target when flag is off                                                                         |
| `src/router/index.ts`                       | **Modify** | `requiresFeature` meta, `/maintenance` route, 4-step guard                                               |
| `src/stores/auth.store.ts`                  | **Modify** | `signInAnonymously()` on startup when auth disabled; `getSession()` re-read before unblocking navigation |
| `src/stores/profile.store.ts`               | **Modify** | `getSession()` instead of `getUser()`; silent return when auth disabled and no session                   |
| `src/stores/trip.store.ts`                  | **Modify** | `getSession()` instead of `getUser()`; `fetchTrips` silent return when auth disabled and no session      |
| `src/components/PlanPanel.vue`              | **Modify** | Internal flag check, disabled state                                                                      |
| `src/views/TripView.vue`                    | **Modify** | `v-if="isPlanGenerationEnabled"` on PlanPanel                                                            |
| `supabase/functions/api/index.ts`           | **Modify** | 503 when auth flag off                                                                                   |
| `supabase/functions/generate-plan/index.ts` | **Modify** | 503 when plan-generation flag off                                                                        |
| `.env.example`                              | **Modify** | Add `VITE_ENV_NAME`                                                                                      |

---

## Out of Scope (this step)

- Dynamic flag changes at runtime (e.g. remote config, Supabase table)
- Per-user or percentage-rollout flags
- Admin UI for flag management

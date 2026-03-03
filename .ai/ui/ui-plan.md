# UI Architecture Plan – MyAIGuide MVP

## 1. Executive Summary

MyAIGuide is a Vue 3.5 SPA for AI-powered trip planning. This document defines the complete UI architecture based on
the Product Requirements Document (PRD), API design, and accessibility standards (WCAG AA). It reflects the
implemented codebase as of the current state and supersedes earlier drafts.

### Core Concept

The application follows a simple data model: **1 note = 1 trip = 1 plan**. Each trip contains user notes (up to
10,000 characters, no minimum) and per-trip travel preferences, which are used to generate a single AI-powered travel
plan stored in JSON format.

### Key Design Decisions

- **No dedicated profile route** – per PRD §3.2 / US-005 the global profile panel lives at the top of the dashboard
  above the trip list; there is no `/profile` page.
- **Dashboard at `/`** – the root path is the dashboard (authenticated default route).
- **Note validation**: maximum 10,000 characters, **no minimum length** enforced anywhere.
- **Plan candidate is ephemeral** – generated plan lives only in Pinia state; page refresh discards it.
- **Language is auto-detected** from note content; no manual language selector.

---

## 2. Technology Stack

### Frontend Framework

- **Vue 3.5** – Composition API with `<script setup>` syntax
- **TypeScript 5** – Static typing throughout
- **Vite 7** – Build tool and dev server

### UI & Styling

- **shadcn-vue** – Primary component library (accessible, customizable)
- **Tailwind CSS 3** – Utility-first styling with responsive variants and dark-mode support
- **Lucide Vue Next** – Icon library (consistent icon set for preference flags and actions)

### State & Routing

- **Pinia** – State management (auth, profile, trips, plans, quota)
- **Vue Router** – Client-side routing with `beforeEach` navigation guards

### Backend Integration

- **Custom Supabase Client** – `@/db/supabase.client.ts` for auth + database operations
- **Supabase Auth** – Email/password only (no OAuth per PRD §3.1 / US-002)
- **Supabase Edge Functions** – AI plan generation, quota calculation, account deletion

---

## 3. Application Structure

### 3.1 Route Hierarchy

```
/                           → DashboardView       (protected, requiresAuth)   ← default after login
/login                      → LoginView            (public, guestOnly)
/register                   → RegisterView         (public, guestOnly)
/forgot-password            → ForgotPasswordView   (public, guestOnly)
/reset-password             → ResetPasswordView    (public)
/trips/:id                  → TripView             (protected, requiresAuth)
/:pathMatch(.*)*            → NotFoundView         (fallback 404)
```

> There is no `/profile` route. The global profile panel (`UserProfilePanel`) is embedded directly in the dashboard.
> Trip creation is **inline** from the dashboard — clicking "New Trip" calls `tripStore.createTrip()` and navigates to
> `/trips/:id` immediately. There is no `/trips/new` route.

### 3.2 Layout Components

**`AuthLayout`** – Minimal centered layout for public (auth) pages.

- Wraps: `LoginView`, `RegisterView`, `ForgotPasswordView`, `ResetPasswordView`
- No sidebar; just a centered card with the brand header.

**`AppLayout`** – Main application shell for all protected pages.

- Persistent sidebar on desktop (≥1024px), collapsible overlay on mobile/tablet.
- Main content area with `<slot />`.
- User email + logout button in sidebar footer.

### 3.3 View Components

#### Public Views

| View                     | Path               | Purpose                                         |
| ------------------------ | ------------------ | ----------------------------------------------- |
| `LoginView.vue`          | `/login`           | Email/password login form                       |
| `RegisterView.vue`       | `/register`        | Email/password + confirmation registration form |
| `ForgotPasswordView.vue` | `/forgot-password` | Password reset request (email input)            |
| `ResetPasswordView.vue`  | `/reset-password`  | New password entry (post email-link)            |

#### Protected Views

| View                | Path         | Purpose                                               |
| ------------------- | ------------ | ----------------------------------------------------- |
| `DashboardView.vue` | `/`          | `UserProfilePanel` at top + trip list with pagination |
| `TripView.vue`      | `/trips/:id` | Split/stacked layout: note editor + plan panel        |
| `NotFoundView.vue`  | `/*`         | 404 fallback for unmatched routes                     |

---

## 4. Key UI Components

### 4.1 Sidebar Navigation (`Sidebar.vue`)

**Built on:** shadcn-vue Navigation Menu

**Structure:**

- Brand / logo header
- Navigation items with icons:
  - Dashboard (Home icon) → `/`
  - My Trips (Map icon) → `/`
- User section at bottom: logged-in email + Logout button

**Responsive Behavior:**

- Desktop (≥1024px): persistent sidebar, 256 px width
- Mobile / Tablet (<1024px): hidden by default, slides in as overlay on hamburger click

**Accessibility:**

- `aria-label="Main navigation"` on `<nav>` element
- `aria-current="page"` on the active route link
- Keyboard-navigable (Tab, Enter, Arrow keys)
- Skip-to-main-content link at page top

---

### 4.2 User Profile Panel (`UserProfilePanel.vue`)

**Location:** Top of `DashboardView`, above the trip list (per PRD §3.2 / US-005).

**Card structure: "Your Travel Profile"**

#### Section A – About you (traveler flags)

Four pill-toggle buttons, each with a Lucide icon:

| Field                     | Label                   | Icon            |
| ------------------------- | ----------------------- | --------------- |
| `has_kids`                | Traveling with kids     | `Baby`          |
| `has_pets`                | Traveling with pets     | `PawPrint`      |
| `has_mobility_issues`     | Mobility considerations | `Accessibility` |
| `has_dietary_preferences` | Dietary preferences     | `Utensils`      |

**Dietary preferences edge case** (DB CHECK constraint: flag `true` requires non-empty description):

- Toggle **OFF → ON**: show `Textarea` optimistically; **do not** save the flag until the user fills in a description.
  `onBlur` with empty text → destructive toast, revert pill to OFF.
  `onBlur` with text → save `{ has_dietary_preferences: true, dietary_preferences_description: <text> }` together.
- Toggle **ON → OFF**: save immediately `{ has_dietary_preferences: false, dietary_preferences_description: null }`.

#### Section B – Default travel style

| Sub-section       | Selection          | Options                                                                                                              |
| ----------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Interests (What?) | Multi-select pills | Nature `TreePine`, Culture/Museums `Landmark`, Beach/Relax `Waves`, City Break `Building2`, Foodie `UtensilsCrossed` |
| Pace (How fast?)  | Single-select row  | Slow & Chill `Snail`, Balanced `Scale`, Intensive `Zap`                                                              |
| Trip type         | Single-select row  | Base `MapPin`, Base + Day Trips `Map`, Road Trip `Car`                                                               |
| Budget            | Single-select row  | Budget `PiggyBank`, Moderate `Wallet`, Luxury `Gem`                                                                  |

**Auto-save pattern:**

- Every pill toggle / selection calls `profileStore.updateProfile()` immediately.
- `isUpdating` ref disables all controls while a save is in flight (prevents race conditions).
- Destructive toast on any save error.

**Loading state:** Skeleton placeholders while `profileStore.isLoading && !profile`.

---

### 4.3 Trip Card (`TripCard.vue`)

**Built on:** shadcn-vue Card

**Displayed information:**

- Trip title
- Status badge (CREATED / DRAFT / CONFIRMED — derived, never stored)
- Truncated note preview (≤100 characters)
- Last modified timestamp (relative)

**Status badge logic (derived server-side):**

| Status      | Condition                                     | Badge color  |
| ----------- | --------------------------------------------- | ------------ |
| `CREATED`   | `note_body` null / empty AND `plan_json` null | Gray         |
| `DRAFT`     | `note_body` has content AND `plan_json` null  | Orange/amber |
| `CONFIRMED` | `plan_json` is NOT NULL                       | Green        |

**Interaction:** click anywhere on card → navigate to `/trips/:id`.

---

### 4.4 Note Editor (`TripNoteEditor.vue`)

**Features:**

- `<Textarea>` for note content (no minimum, max 10,000 characters)
- Real-time character counter: `N / 10,000`
- Counter color coding (WCAG AA):
  - Normal (`text-muted-foreground`): 0–9,000 characters
  - Warning (`text-yellow-600`): 9,001–9,999 characters
  - Error (`text-destructive`): ≥ 10,000 characters
- "Generate Plan" button is disabled when character count > 10,000
- Auto-save on blur (debounced 500 ms via `tripStore.updateTrip()`)

---

### 4.5 Trip Preferences Panel (`TripPreferences.vue`)

**Fields in TripView (per-trip overrides):**

| Field             | Required for generation? | Editable at trip level?    |
| ----------------- | ------------------------ | -------------------------- |
| Destination       | ✅ Yes                   | ✅ Yes                     |
| Number of days    | No                       | ✅ Yes (1–30)              |
| Number of people  | No                       | ✅ Yes (1–20)              |
| Interests (What?) | No                       | ✅ Yes (overrides profile) |
| Pace (Speed)      | No                       | ✅ Yes (overrides profile) |
| Trip type         | No                       | ✅ Yes (overrides profile) |
| Budget            | No                       | ✅ Yes (overrides profile) |

**Read-only at trip level** (always sourced from profile, shown for context only):

- `has_kids`, `has_pets`, `has_mobility_issues`, `has_dietary_preferences` + description

**Inherited-value indicator:**

- Values that match the current profile default are shown with a subtle muted style and a tooltip "From your profile".
- Overridden values show a "Reset to profile default" ghost button.

---

### 4.6 Generation Quota Counter

**Location:** Plan panel, directly above the "Generate Plan" button.

**Display format:** `X / 10 generations used in the last 24 h`

**Progress bar** visualization with color states (WCAG AA):

| Used | Color                 |
| ---- | --------------------- |
| 0–7  | Green                 |
| 8–9  | Yellow/amber          |
| 10   | Red (button disabled) |

When quota = 10/10, show: reset time (`Resets at HH:MM`).

Data source: `quota` field returned in the `POST …/generate-plan` response; also from
`GET /api/users/me/generation-quota` on TripView mount.

---

### 4.7 Plan Candidate vs. Saved Plan (`PlanViewer.vue`)

**Unsaved candidate state:**

- Amber alert banner: "Unsaved plan – changes will be lost on page refresh"
- Prominent "Save Plan" button (primary, large, full-width)
- "Discard" button (outline)
- All activity fields editable inline (description, location name)

**Saved plan state:**

- Green alert banner: "Plan saved · Last updated [relative timestamp]"
- "Regenerate Plan" button
- Read-only by default; inline "Edit" affordance per activity field

**No plan yet:**

- Placeholder message with instructions to write a note and generate a plan.
- Pre-generation checklist shown if destination is missing.

---

### 4.8 Plan Day List (`PlanDayList.vue`)

**Built on:** shadcn-vue Accordion

**Structure per day:**

```
AccordionItem: "Day 1"
  ├── Morning
  │     locationName  (editable in candidate mode)
  │     description   (editable in candidate mode)
  │     categoryTag   badge
  ├── Afternoon
  └── Evening
```

Category tag badge colors (consistent icon mapping to `WhatPreference`):

- `nature` → TreePine
- `culture_museums` → Landmark
- `beach_relax` → Waves
- `city_break` → Building2
- `foodie` → UtensilsCrossed

---

## 5. State Management (Pinia)

### 5.1 AuthStore (`stores/auth.store.ts`)

**State:** `user`, `session`, `isLoading`

**Computed:** `isAuthenticated`

**Actions:** `login()`, `register()`, `logout()`, `resetPasswordForEmail()`, `initialize()`

Supabase auth state listener (`onAuthStateChange`) keeps store in sync with session changes.

---

### 5.2 ProfileStore (`stores/profile.store.ts`)

**State:** `profile: ProfileDTO | null`, `isLoading`, `error`

**Computed:** `defaultPreferences` – returns `{ what, speed, type, budget }` snapshot for use when creating trips.

**Actions:**

- `fetchProfile()` – `GET /api/profiles/me`
- `updateProfile(updates)` – `PATCH /api/profiles/me`

Profile is always guaranteed to exist for authenticated users (created by DB trigger on registration).

---

### 5.3 TripStore (`stores/trip.store.ts`)

**State:** `trips: TripListItemDTO[]`, `currentTrip: TripDTO | null`, `tripsPagination`, `isLoadingTrips`,
`isCreatingTrip`

**Actions:**

- `fetchTrips(page)` – `GET /api/trips?page=N`
- `fetchTripById(id)` – `GET /api/trips/:id`
- `createTrip({ title: 'New Trip' })` – `POST /api/trips`; always called with the hardcoded default title; profile defaults applied for preference fields; returns `TripDTO` (use `trip.id` for navigation)
- `updateTrip(id, updates)` – `PATCH /api/trips/:id`
- `deleteTripById(id)` – `DELETE /api/trips/:id`

---

### 5.4 PlanStore (`stores/plan.store.ts`)

**State:** `candidate: GeneratedPlanDTO | null`, `quota: GenerationQuotaDTO | null`, `isGenerating`

**Computed:** `hasUnsavedCandidate`

**Actions:**

- `generatePlan(tripId)` – `POST /api/trips/:id/generate-plan`; stores result as `candidate`; updates `quota`
- `savePlan(tripId)` – `PUT /api/trips/:id/plan`; persists `candidate`; clears `candidate`
- `discardCandidate()` – clears `candidate` without saving
- `fetchQuota()` – `GET /api/users/me/generation-quota`

The candidate is intentionally **not persisted** to localStorage; it is lost on page refresh (per PRD §3.6 / US-016).

---

## 6. Routing and Navigation

### 6.1 Route Guard Strategy

`router.beforeEach` blocks navigation until `authStore.isLoading === false` (wait for Supabase session restore),
then enforces:

- `requiresAuth: true` + not authenticated → redirect to `/login?redirect=<path>`
- `guestOnly: true` + authenticated → redirect to `/`

### 6.2 Unsaved Candidate Guard

In `TripView.vue`:

```typescript
onBeforeRouteLeave(() => {
  if (planStore.hasUnsavedCandidate) {
    return window.confirm('You have an unsaved plan. Leave and discard it?')
  }
})
```

### 6.3 Trip ID Validation Guard

The `/trips/:id` route has an `beforeEnter` guard that parses the id parameter as an integer; non-numeric or
non-positive values are redirected to `not-found`.

---

## 7. Responsive Design

### 7.1 Breakpoints (Tailwind defaults)

| Breakpoint | Min width | Usage                                       |
| ---------- | --------- | ------------------------------------------- |
| `sm`       | 640px     | Two-column trip grid                        |
| `md`       | 768px     | Larger padding, spacing                     |
| `lg`       | 1024px    | Split panel in TripView; persistent sidebar |
| `xl`       | 1280px    | Three-column trip grid                      |

### 7.2 Layout Patterns

**Dashboard trip grid:**

```
grid-cols-1 → sm:grid-cols-2 → lg:grid-cols-3
```

**TripView split panel:**

```
Single column (mobile)  →  lg:grid-cols-2 (note left, plan right, sticky)
```

**Sidebar:**

```
Mobile: hidden, overlay on toggle
Desktop (lg+): fixed left, 256px, always visible
```

---

## 8. Accessibility (WCAG AA)

### 8.1 Color Contrast

All text meets minimum 4.5:1 (normal text) or 3:1 (large text) ratios.

Key color assignments:

- Status badges use shadcn-vue `Badge` variant colors verified against WCAG AA
- Character counter warning/error states: `text-yellow-600` / `text-destructive`
- Profile pill active state: `bg-primary text-primary-foreground`
- Focus rings: `focus-visible:ring-2 focus-visible:ring-ring`

### 8.2 ARIA & Semantics

- `<nav aria-label="Main navigation">` on sidebar nav element
- `aria-current="page"` on active nav link
- `aria-live="polite"` on quota counter for screen reader updates
- shadcn-vue Dialog manages `aria-modal`, focus trap, and `Escape` dismissal automatically
- All icon-only buttons include `aria-label`

### 8.3 Keyboard Navigation

- Full Tab order through all interactive elements
- Preference pill toggles and accordion items keyboard-operable
- Modal dialogs trap focus; close on `Escape`
- Skip-to-main-content link at page top

---

## 9. Error Handling and Notifications

### 9.1 Toast Notification System

**Component:** shadcn-vue `Toast` / `Toaster`

| Error type                  | Variant                      | Duration                |
| --------------------------- | ---------------------------- | ----------------------- |
| Validation errors (400)     | `destructive`                | 5 s                     |
| AI generation failure (502) | `destructive` + Retry action | persistent              |
| Quota exceeded (429)        | `destructive`                | 10 s (shows reset time) |
| Profile/trip save failure   | `destructive`                | 5 s                     |
| Network errors              | `destructive` + Retry action | persistent              |

### 9.2 Inline Error States

- Trip list: `<Alert variant="destructive">` with "Failed to load trips" + Retry button
- TripView load failure: similar inline alert
- Generation button: disabled with tooltip when quota = 10/10 or destination missing

### 9.3 Confirmation Dialogs

- Delete trip: shadcn-vue `Dialog` with "Delete trip?" + destructive button
- Discard unsaved plan: `window.confirm` in route-leave guard (MVP; can be upgraded to Dialog later)
- Account deletion: requires typing confirmation string "DELETE MY ACCOUNT"

---

## 10. Performance

### 10.1 Code Splitting

All views are lazy-loaded via dynamic import in the router:

```typescript
component: () => import('@/views/DashboardView.vue')
```

### 10.2 Data Fetching Order

**On app mount (AppLayout / main.ts):**

1. `authStore.initialize()` — restore Supabase session

**On DashboardView mount:**

1. `profileStore.fetchProfile()` (warms store for UserProfilePanel)
2. `tripStore.fetchTrips(1)` (parallel with profile fetch)

**On TripView mount:**

1. `tripStore.fetchTripById(id)`
2. `planStore.fetchQuota()`

### 10.3 Pinia Cache Invalidation

| Store               | Invalidated when                                                  |
| ------------------- | ----------------------------------------------------------------- |
| ProfileStore        | `updateProfile()` call (replaces in-place)                        |
| TripStore — list    | After `createTrip()` or `deleteTripById()`                        |
| TripStore — current | After `updateTrip()` (replaces in-place)                          |
| PlanStore candidate | On `discardCandidate()`, `savePlan()`, or route leave             |
| PlanStore quota     | After each `generatePlan()` (quota snapshot returned in response) |

---

## 11. User Journey Maps

### 11.1 New User Onboarding

1. Visit `/` → redirected to `/login`
2. Click "Create account" → `/register` → fill email / password / confirm
3. Submit → account created, profile auto-generated with defaults → redirect to `/`
4. `UserProfilePanel` at top of dashboard → set traveler flags and default preferences
5. Click "New Trip" → trip created → navigate to `/trips/:id`
6. Write note in the Note editor panel
7. Set trip destination (required for generation)
8. Click "Generate Plan" → loading spinner → plan candidate appears
9. Review / edit activity descriptions → click "Save Plan"
10. Back to dashboard → trip card shows status `CONFIRMED`

### 11.2 Returning User – New Trip

1. Visit `/` → already authenticated → dashboard loads
2. Profile panel shows current settings; optionally adjust
3. Click "New Trip" → `/trips/:id` (new)
4. Write note → generate → save
5. Dashboard shows updated trip list

### 11.3 Editing Existing Trip

1. Dashboard → click trip card → `/trips/:id`
2. Edit note or per-trip preferences
3. Click "Generate Plan" → new candidate replaces old display
4. Save → overwrites previous confirmed plan
5. Back to dashboard → updated timestamp

### 11.4 Quota Limit Handling

1. User reaches 10/10 generations
2. "Generate Plan" button becomes disabled; quota counter shows red with reset time
3. After ≥24 h the oldest recorded generation falls outside the rolling window
4. Quota counter refreshes (next page load or after next generation attempt)

### 11.5 Dietary Preferences

1. Toggle "Dietary preferences" pill ON → textarea appears immediately (optimistic)
2. User types description, blurs textarea → both flag + description saved together
3. Empty blur → destructive toast "Description required", pill reverts to OFF
4. Toggle ON pill OFF → immediate save of `{ has_dietary_preferences: false, dietary_preferences_description: null }`

### 11.6 Password Recovery

1. `/login` → click "Forgot password?" → `/forgot-password`
2. Enter email → submit → confirmation message (always 200 to avoid email enumeration)
3. User clicks link in email → `/reset-password`
4. Enter new password → submit → redirect to `/login`

### 11.7 Account Deletion

1. User menu in sidebar → "Delete Account"
2. Modal: warning text + input field requiring "DELETE MY ACCOUNT"
3. Submit → `DELETE /api/users/me` → all data wiped → redirect to `/login`

---

## 12. User Story → UI Element Mapping

| US     | Story                         | UI element                                                                         |
| ------ | ----------------------------- | ---------------------------------------------------------------------------------- |
| US-001 | Registration                  | `RegisterView` form + redirect to `/`                                              |
| US-002 | Login / Logout / Auth guard   | `LoginView`, logout button in sidebar, `router.beforeEach` guard                   |
| US-003 | Data isolation                | RLS on server; UI shows only own data                                              |
| US-004 | Account deletion              | Delete Account modal in sidebar user menu                                          |
| US-005 | Global profile flags          | `UserProfilePanel` Section A (traveler flag pills) in `DashboardView`              |
| US-006 | Default travel preferences    | `UserProfilePanel` Section B (what/speed/type/budget pills)                        |
| US-008 | Create trip + note            | "New Trip" button in `DashboardView` → inline creation → `TripView`                |
| US-009 | Edit / delete trip            | Note editor + preferences in `TripView`; delete via card menu / detail page        |
| US-010 | Trip list                     | `DashboardView` trip grid sorted by `updated_at` DESC with pagination              |
| US-011 | Per-trip preferences          | `TripPreferences` panel in `TripView` (overridable, with read-only profile flags)  |
| US-012 | Note length validation        | Character counter in `TripNoteEditor`; "Generate Plan" button disabled if > 10,000 |
| US-013 | Generate plan + quota counter | "Generate Plan" button + `GenerationQuotaCounter`; 10/10 → button locked           |
| US-014 | Review / edit candidate       | Editable fields in `PlanDayList` when plan is a candidate                          |
| US-015 | Save plan                     | "Save Plan" button; confirmed plan shown on re-open                                |
| US-016 | Regenerate + error handling   | "Regenerate" button; destructive toast + retry on error; candidate lost on refresh |
| US-017 | Plan language from note       | Auto-detected server-side; `plan_language` shown in plan header (read-only)        |

---

## 13. Component Hierarchy

```
App
├── AuthLayout (public routes)
│   ├── LoginView            → /login
│   ├── RegisterView         → /register
│   ├── ForgotPasswordView   → /forgot-password
│   └── ResetPasswordView    → /reset-password
├── AppLayout (protected routes)
│   ├── Sidebar (Navigation Menu + user section)
│   ├── DashboardView        → /
│   │   ├── UserProfilePanel
│   │   │   ├── [Section A] flag pill buttons × 4 (+ Textarea for dietary)
│   │   │   └── [Section B] pill groups (what/speed/type/budget)
│   │   ├── TripCard × N
│   │   └── TripListPagination
│   ├── TripView             → /trips/:id
│   │   ├── TripNoteEditor (Textarea + char counter)
│   │   ├── TripPreferences (per-trip overrides + read-only profile flags)
│   │   └── PlanViewer
│   │       ├── GenerationQuotaCounter (Progress bar)
│   │       ├── [Generate / Regenerate button]
│   │       ├── PlanDayList (Accordion × days)
│   │       │   └── ActivityItem × N (editable in candidate mode)
│   │       └── [Save Plan / Discard buttons]
│   └── NotFoundView         → /*
└── Toaster (global toast outlet)
```

---

## 14. shadcn-vue Component Usage

### Core Components

| Component                                     | Used for                                                    |
| --------------------------------------------- | ----------------------------------------------------------- |
| `Card / CardHeader / CardTitle / CardContent` | Profile panel, trip cards, plan day items                   |
| `Button`                                      | All actions; variants: default, outline, ghost, destructive |
| `Badge`                                       | Trip status, category tags, time-of-day labels              |
| `Alert / AlertTitle / AlertDescription`       | Unsaved plan warning, saved plan confirmation, error states |
| `Dialog / DialogContent / DialogFooter`       | Delete trip confirmation, account deletion                  |
| `Toast / Toaster`                             | All transient notifications                                 |
| `Accordion / AccordionItem`                   | Plan day expansion in PlanDayList                           |
| `Textarea`                                    | Note editor, dietary description                            |
| `Input`                                       | Trip title, destination, account deletion confirmation      |
| `Progress`                                    | Quota counter visualization                                 |
| `Skeleton`                                    | Loading placeholders (profile panel, trip list)             |
| `Separator`                                   | Visual dividers in panels                                   |

### Form Components

| Component | Used for                                 |
| --------- | ---------------------------------------- |
| `Label`   | Form field labels in auth forms          |
| `Input`   | Email, password, trip title, destination |

---

## 15. Security Considerations

| Concern                     | Mitigation in UI                                                               |
| --------------------------- | ------------------------------------------------------------------------------ |
| Route access without auth   | `router.beforeEach` guard redirects to `/login`                                |
| AI API key exposure         | Key lives only in Edge Function environment; never sent to browser             |
| Cross-user data access      | RLS enforced at DB level; UI shows only data returned by the authenticated API |
| Accidental account deletion | Requires typing "DELETE MY ACCOUNT" confirmation string                        |
| Unsaved plan data loss      | `onBeforeRouteLeave` guard warns before navigation                             |
| Password reset enumeration  | `ForgotPasswordView` shows success message regardless of email existence       |

---

## 16. Summary

This UI architecture provides a complete, production-ready foundation for MyAIGuide MVP:

✅ **Modern Tech Stack** – Vue 3.5, TypeScript 5, Vite 7, shadcn-vue, Tailwind CSS 3
✅ **Correct Route Hierarchy** – dashboard at `/`, no `/profile` route, all auth routes present
✅ **Profile in Dashboard** – `UserProfilePanel` embedded per PRD §3.2 / US-005
✅ **Accurate Note Validation** – max 10,000 characters, no minimum length
✅ **Dietary Preferences Edge Case** – deferred save pattern satisfies DB CHECK constraint
✅ **Accessible Design** – WCAG AA contrast, ARIA labels, keyboard navigation, screen reader support
✅ **Responsive Layout** – mobile-first with split panel at lg (1024px)
✅ **State Management** – Pinia stores for auth, profile, trips, and plans (candidate ephemeral)
✅ **Error Handling** – toast notifications, inline alerts, retry mechanisms
✅ **User Story Coverage** – all 17 user stories mapped to concrete UI elements

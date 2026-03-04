# View Implementation Plan: DashboardView

## 1. Overview

`DashboardView` is the protected home screen of MyAIGuide (route `/`). It is the first page a logged-in user lands on after authentication and serves as the central hub of the application. The view is composed of two major sections stacked vertically:

1. **`UserProfilePanel`** — A "Your Travel Profile" card permanently embedded at the top of the page. It lets the user view and update their global traveler flags (kids, pets, mobility, dietary) and default travel-style preferences (interests, pace, trip type, budget). Changes auto-save on every interaction. This panel is the _only_ place in the app where the profile is edited — there is no dedicated `/profile` route.

2. **Trip list area** — A responsive grid of `TripCard` components sorted by `updated_at` descending. Includes a "New Trip" button (inline creation — calls `tripStore.createTrip()` and immediately navigates to `/trips/:id`), loading skeletons, an empty state, an error state with retry, and pagination controls.

**User stories addressed:** US-002 (dashboard access), US-005 (global profile flags), US-006 (default travel preferences), US-008 (create trip), US-009 (delete trip from list), US-010 (trip list).

---

## 2. View Routing

- **Path:** `/`
- **Route name:** `dashboard`
- **Guard:** `meta: { requiresAuth: true }` — configured in `src/router/index.ts`
- Unauthenticated access redirects to `/login?redirect=/`
- No additional routes are needed; trip detail is at `/trips/:id` (already present)
- There is **no** `/profile` route and **no** `/trips/new` route — both actions happen on this view

---

## 3. Component Structure

```
DashboardView.vue                     ← view orchestrator
├── UserProfilePanel.vue              ← profile card at top, always visible
│   ├── [Section A] TravelerFlagPill × 4
│   │   └── [dietary only] Textarea (conditional)
│   └── [Section B] PreferencePillGroup × 4
│       ├── WhatPillGroup (multi-select)
│       ├── SpeedPillGroup (single-select)
│       ├── TypePillGroup (single-select)
│       └── BudgetPillGroup (single-select)
├── <trip list header>                ← "My Trips" h2 + "New Trip" Button
├── <loading state>                   ← Skeleton cards (while isLoadingTrips)
├── <error state>                     ← Alert + Retry button (on tripsError)
├── <empty state>                     ← message + "Create your first trip" CTA
├── <grid>                            ← responsive CSS grid
│   └── TripCard.vue × N
├── TripListPagination.vue            ← shown when total_pages > 1
└── <delete Dialog>                   ← one Dialog instance, controlled by local state
```

---

## 4. Component Details

### `DashboardView.vue`

**Description:** The view orchestrator. Initialises data on mount in parallel, manages local UI state for the delete dialog, composes all child components, and wires events from child components to store actions.

**Main elements:**

- `AppLayout` wrapper with `<main>` slot
- `UserProfilePanel` (always rendered when authenticated)
- Trip list section:
  - `<h2>` "My Trips" + `<Button>` "New Trip" (`Plus` icon)
  - Skeleton cards (6 placeholders in the same grid) while `isLoadingTrips`
  - `Alert` (destructive) + "Retry" Button when `tripsError !== null`
  - Empty-state `<div>` with copy + "Create your first trip" Button when `trips.length === 0 && !isLoadingTrips && !tripsError`
  - `div.grid.grid-cols-1.sm:grid-cols-2.lg:grid-cols-3.gap-4.md:gap-6`
  - `TripCard` for each item in `tripStore.trips`
  - `TripListPagination` below the grid
  - `Dialog` (delete confirmation) — a single instance, controlled by `showDeleteDialog` / `deletingTripId`

**Handled interactions:**

- `onMounted`: `Promise.all([profileStore.fetchProfile(), tripStore.fetchTrips(1)])` with individual error handling per promise
- "New Trip" button click → `tripStore.createTrip()` (POST /api/trips with a generated default title) → on success navigate to `/trips/:id` (new trip id)
- Receiving `@delete` emit from `TripCard` → store `deletingTripId`, open Dialog
- Dialog "Confirm Delete" → `tripStore.deleteTripById(deletingTripId)` → show success toast → refresh list → close Dialog
- Dialog "Cancel" / Dialog close → reset `deletingTripId`, close Dialog
- `@page-change` from `TripListPagination` → update `currentPage`, call `tripStore.fetchTrips(newPage)`
- "Retry" click in error state → `tripStore.fetchTrips(currentPage)`

**Handled validation:** None — delegated to child components and stores.

**Types used:**

- `DashboardTripViewModel` (from `src/types.ts`)
- `PaginationDTO` (from `src/types.ts`)

**Props:** None (route-level view)

---

### `UserProfilePanel.vue`

**Description:** A card titled "Your Travel Profile" permanently embedded at the top of the dashboard. Divided into two sections:

- **Section A – About you:** four pill-toggle buttons for traveler flags, plus a conditional Textarea for dietary preferences description.
- **Section B – Default travel style:** four preference groups (Interests, Pace, Trip type, Budget) rendered as pill selectors.

All changes auto-save via `profileStore.updateProfile()` on each interaction. While a save is in flight, `isUpdating` disables all controls to prevent race conditions. A skeleton replaces the card while `profileStore.isLoading && !profileStore.profile`.

**Main elements:**

- `Card` + `CardHeader` (`CardTitle` "Your Travel Profile") + `CardContent`
- `Separator` between Section A and Section B
- **Section A** — "About you" sub-heading + four pill `Button` components (toggle variant):
  - `has_kids` / "Traveling with kids" / `Baby` icon
  - `has_pets` / "Traveling with pets" / `PawPrint` icon
  - `has_mobility_issues` / "Mobility considerations" / `Accessibility` icon
  - `has_dietary_preferences` / "Dietary preferences" / `Utensils` icon
  - Conditional `Textarea` (shown when `has_dietary_preferences` is `true` or pending-on):
    - placeholder "Describe your dietary preferences (required)"
    - `v-model` bound to `dietaryDescriptionDraft` local ref
    - `@blur` triggers the deferred-save logic
- **Section B** — four sub-groups, each labelled:
  - **Interests (What?)** — multi-select pill row; options: Nature (`TreePine`), Culture/Museums (`Landmark`), Beach/Relax (`Waves`), City Break (`Building2`), Foodie (`UtensilsCrossed`)
  - **Pace (How fast?)** — single-select pill row: Slow & Chill (`Snail`), Balanced (`Scale`), Intensive (`Zap`)
  - **Trip type** — single-select pill row: Base (`MapPin`), Base + Day Trips (`Map`), Road Trip (`Car`)
  - **Budget** — single-select pill row: Budget (`PiggyBank`), Moderate (`Wallet`), Luxury (`Gem`)
- `Skeleton` placeholder (matching card layout) while `profileStore.isLoading && !profileStore.profile`

**Handled interactions:**

- `has_kids` / `has_pets` / `has_mobility_issues` toggle → call `profileStore.updateProfile({ <flag>: !currentValue })` immediately
- `has_dietary_preferences` toggle **OFF → ON**:
  - Show Textarea optimistically; set `dietaryPending = true`; do **not** save yet
- `has_dietary_preferences` Textarea `@blur`:
  - Empty description → show destructive toast "Dietary description is required", revert pill to OFF, clear `dietaryPending`
  - Non-empty description → call `profileStore.updateProfile({ has_dietary_preferences: true, dietary_preferences_description: description.trim() })`
- `has_dietary_preferences` toggle **ON → OFF** → call `profileStore.updateProfile({ has_dietary_preferences: false, dietary_preferences_description: null })` immediately
- Interests pill click → toggle value in `default_what` array → call `profileStore.updateProfile({ default_what: newArray })`
- Pace / Trip type / Budget pill click → call `profileStore.updateProfile({ default_<field>: newValue })`

**Handled validation:**

- `has_dietary_preferences = true` requires non-empty `dietary_preferences_description` (after trim) — enforced on `@blur` of Textarea (revert + toast if empty)
- All controls disabled when `isUpdating` (save in flight)
- Skeleton shown while `profileStore.isLoading && !profileStore.profile`

**Types used:**

- `ProfileDTO` (from `src/types.ts`) — read from `profileStore.profile`
- `UpdateProfileCommand` (from `src/types.ts`) — passed to `profileStore.updateProfile()`
- `WhatPreference`, `SpeedPreference`, `TypePreference`, `BudgetPreference` (from `src/types.ts`)

**Props:** None (reads directly from `profileStore`)

**Local state:**

```typescript
const dietaryDescriptionDraft = ref<string>('') // textarea v-model
const dietaryPending = ref<boolean>(false) // pill shown ON but not yet saved
const isUpdating = ref<boolean>(false) // save in flight — disables all controls
```

---

### `TripCard.vue`

**Description:** Displays a single trip as a clickable card. Click navigates to `/trips/:id`. Includes a delete icon button that opens the parent's delete confirmation Dialog.

**Main elements:**

- `Card` (shadcn-vue) — full card is clickable, `cursor-pointer`, `hover:shadow-md` transition
- `CardHeader`: `CardTitle` (trip title) + `Badge` (status)
- `CardContent`:
  - Truncated note preview (up to 100 chars, `…` if truncated, empty string if no note)
  - Relative "Updated X ago" timestamp
- Delete `Button` (ghost, size icon, `Trash2` icon, `aria-label="Delete trip"`) in top-right corner — `@click.stop` to prevent card navigation

**Status badge styling:**

| Status      | Variant / classes                                                          | Label       |
| ----------- | -------------------------------------------------------------------------- | ----------- |
| `CREATED`   | `secondary` (gray)                                                         | New         |
| `DRAFT`     | custom `bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200` | In Progress |
| `CONFIRMED` | custom `bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200` | Planned     |

**Handled interactions:**

- Card `@click` → `router.push({ name: 'trip-detail', params: { id: trip.id } })`
- Delete `Button` `@click.stop` → `emit('delete', trip.id)`

**Handled validation:** None — `notePreview` is pre-truncated by the store.

**Types used:**

- `DashboardTripViewModel`

**Props:**

```typescript
defineProps<{
  trip: DashboardTripViewModel
}>()
```

**Events emitted:** `delete(id: number)`

---

### `TripListPagination.vue`

**Description:** Simple previous / next pagination rendered below the trip grid. Only rendered when `total_pages > 1`.

**Main elements:**

- Flex row: "Previous" `Button` (outline) + page counter `"Page X of Y"` text + "Next" `Button` (outline)

**Handled interactions:**

- "Previous" `@click` → `emit('page-change', pagination.current_page - 1)` (disabled on page 1)
- "Next" `@click` → `emit('page-change', pagination.current_page + 1)` (disabled on last page)

**Handled validation:**

- "Previous" disabled when `current_page === 1` or `isLoading`
- "Next" disabled when `current_page === total_pages` or `isLoading`

**Types used:**

- `PaginationDTO`

**Props:**

```typescript
defineProps<{
  pagination: PaginationDTO
  isLoading: boolean
}>()
```

**Events emitted:** `page-change(page: number)`

---

## 5. Types

### Existing types consumed (from `src/types.ts`)

| Type                     | Usage                                                         |
| ------------------------ | ------------------------------------------------------------- |
| `ProfileDTO`             | Read from `profileStore.profile` in `UserProfilePanel`        |
| `UpdateProfileCommand`   | Passed to `profileStore.updateProfile()` on every pill change |
| `WhatPreference`         | Pill option values for Interests section                      |
| `SpeedPreference`        | Pill option values for Pace section                           |
| `TypePreference`         | Pill option values for Trip type section                      |
| `BudgetPreference`       | Pill option values for Budget section                         |
| `TripStatus`             | Status badge rendering in `TripCard`                          |
| `TripListItemDTO`        | Raw API shape before transformation to ViewModel              |
| `DashboardTripViewModel` | Prop type for `TripCard`; held in `tripStore.trips`           |
| `PaginationDTO`          | Pagination state and `TripListPagination` prop                |
| `ErrorResponse`          | Store error state type                                        |

### `DashboardTripViewModel` (already in `src/types.ts`)

```typescript
export interface DashboardTripViewModel {
  id: number // trip primary key
  title: string // trip title (max 255 chars)
  status: TripStatus // derived: 'CREATED' | 'DRAFT' | 'CONFIRMED'
  notePreview: string // first 100 chars of note_body, empty string if null
  updatedAt: string // ISO 8601 timestamp for relative display
}
```

> `notePreview` is populated from `note_body`, which is fetched internally in the Supabase query but stripped from `TripListItemDTO`. The mapping happens in the store layer (`trip.store.ts`) when building `DashboardTripViewModel`.

---

## 6. State Management

### Pinia stores consumed

**`profileStore` (`src/stores/profile.store.ts`)**

| Member                   | Type                                         | Used for                                               |
| ------------------------ | -------------------------------------------- | ------------------------------------------------------ |
| `profile`                | `ProfileDTO \| null`                         | Read by `UserProfilePanel` to populate pill states     |
| `isLoading`              | `boolean`                                    | Show Skeleton in `UserProfilePanel`                    |
| `error`                  | `ErrorResponse \| null`                      | Toast on profile fetch failure                         |
| `fetchProfile()`         | `() => Promise<void>`                        | Called on `DashboardView.onMounted`                    |
| `updateProfile(updates)` | `(u: UpdateProfileCommand) => Promise<void>` | Called on every pill interaction in `UserProfilePanel` |

**`tripStore` (`src/stores/trip.store.ts`)**

| Member                      | Type                                               | Used for                                                                                     |
| --------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `trips`                     | `DashboardTripViewModel[]`                         | Rendered as `TripCard` list                                                                  |
| `tripsPagination`           | `PaginationDTO`                                    | Passed to `TripListPagination`                                                               |
| `isLoadingTrips`            | `boolean`                                          | Show skeleton cards                                                                          |
| `isCreatingTrip`            | `boolean`                                          | Disable "New Trip" button while creation is in-flight                                        |
| `tripsError`                | `ErrorResponse \| null`                            | Show inline error state                                                                      |
| `fetchTrips(page?, limit?)` | `(page?: number, limit?: number) => Promise<void>` | Called on mount and page change (default: page 1, limit 20)                                  |
| `createTrip(command)`       | `(command: CreateTripCommand) => Promise<TripDTO>` | Creates a trip with `{ title: 'New Trip' }`, returns full DTO; `trip.id` used for navigation |
| `deleteTripById(id)`        | `(id: number) => Promise<void>`                    | Called after user confirms delete Dialog                                                     |

### Local state in `DashboardView.vue`

```typescript
const currentPage = ref<number>(1)
const showDeleteDialog = ref<boolean>(false)
const deletingTripId = ref<number | null>(null)
const isDeleting = ref<boolean>(false)
```

### Local state in `UserProfilePanel.vue`

```typescript
const dietaryDescriptionDraft = ref<string>('') // textarea v-model
const dietaryPending = ref<boolean>(false) // optimistic ON state before save
const isUpdating = ref<boolean>(false) // save in flight — disables all controls
```

---

## 7. API Integration

All operations on the dashboard use the Supabase JS client directly — no Edge Functions are required.

### Fetch profile

**Action:** `profileStore.fetchProfile()` — called on `DashboardView.onMounted` in parallel with trip fetch.

**Supabase query:**

```typescript
supabaseClient.from('profiles').select('*').eq('user_id', authenticatedUserId).single()
```

**Response type:** `ProfileDTO` (validated with `ProfileDTOSchema`)

---

### Update profile

**Action:** `profileStore.updateProfile(updates: UpdateProfileCommand)` — called on every UserProfilePanel pill interaction.

**Supabase query:**

```typescript
supabaseClient
  .from('profiles')
  .update(updates)
  .eq('user_id', authenticatedUserId)
  .select('*')
  .single()
```

**Request type:** `UpdateProfileCommand` (partial — only changed fields sent)

**Response type:** Updated `ProfileDTO`

**Critical constraint:** When sending `{ has_dietary_preferences: true }`, `dietary_preferences_description` must be a non-empty string in the same payload. The DB has a CHECK constraint enforcing this. The UI defers the save until the Textarea has a valid description.

---

### Fetch trips list

**Action:** `tripStore.fetchTrips(page)` — called on mount and on pagination change.

**Supabase query (internal — includes `note_body` for preview mapping):**

```typescript
supabaseClient
  .from('trips')
  .select(
    'id, user_id, title, destination, num_days, num_people, note_body, plan_json, created_at, updated_at',
    { count: 'exact' }
  )
  .eq('user_id', authenticatedUserId)
  .order('updated_at', { ascending: false })
  .range(from, to)
```

**Response shape:** Array of raw rows + `count` (Supabase PostgREST)

**Transformation to `DashboardTripViewModel`:**

- `status` = `deriveTripStatus(row.note_body, row.plan_json)` (from `trip.service.ts`)
- `notePreview` = `row.note_body ? row.note_body.slice(0, 100) + (row.note_body.length > 100 ? '…' : '') : ''`
- `note_body` and `plan_json` are **not** included in the final ViewModel

---

### Create new trip

**Action:** `tripStore.createTrip({ title: 'New Trip' })` — called on "New Trip" button click.

**Store flow:**

1. Auth guard: `supabaseClient.auth.getUser()` — throws `401` if no session.
2. Validates command via `validateCreateTripCommand` (Zod).
3. Applies profile defaults for omitted preference fields (`what`, `speed`, `type`, `budget`).
4. Calls `trip.service.ts :: createTrip(resolved, userId)`.

**Supabase query (inside service):**

```typescript
supabaseClient
  .from('trips')
  .insert({
    title: 'New Trip',
    user_id: authenticatedUserId,
    destination: null,
    num_days: null,
    num_people: null,
    what: profile.default_what ?? [],
    speed: profile.default_speed ?? null,
    type: profile.default_type ?? null,
    budget: profile.default_budget ?? null,
    note_body: null
  })
  .select('*')
  .single()
```

Returns full `TripDTO`. The store prepends a `DashboardTripViewModel` to `trips.value` and the call-site uses `trip.id` for navigation to `/trips/:id`. The user renames the title and fills in details in the trip detail view.

---

### Delete trip

**Action:** `tripStore.deleteTripById(id)` — called after user confirms the delete Dialog.

**Supabase query:**

```typescript
supabaseClient.from('trips').delete().eq('id', tripId).eq('user_id', authenticatedUserId)
```

**Post-delete:** Filter deleted trip from `trips.value` in-place; decrement `tripsPagination.total_count` by 1.

---

## 8. User Interactions

| Interaction                              | Trigger                                  | Outcome                                                                                                                                                |
| ---------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Page load                                | `onMounted`                              | Parallel fetch of profile and trips (page 1); skeletons shown in both sections                                                                         |
| Profile traveler flag toggle (simple)    | Pill `@click` in Section A               | `profileStore.updateProfile({ <flag>: newValue })` immediately; controls disabled while saving                                                         |
| Dietary preference toggle OFF → ON       | `has_dietary_preferences` pill click     | Textarea appears; `dietaryPending = true`; save deferred until valid description entered                                                               |
| Dietary preference Textarea blur (valid) | Textarea `@blur`                         | `profileStore.updateProfile({ has_dietary_preferences: true, dietary_preferences_description: text })`                                                 |
| Dietary preference Textarea blur (empty) | Textarea `@blur`                         | Destructive toast "Dietary description is required"; pill reverts to OFF                                                                               |
| Dietary preference toggle ON → OFF       | `has_dietary_preferences` pill click     | `profileStore.updateProfile({ has_dietary_preferences: false, dietary_preferences_description: null })` immediately                                    |
| Travel style preference change           | Pill click in Section B                  | `profileStore.updateProfile({ default_<field>: newValue })` immediately                                                                                |
| Click "New Trip" button                  | `@click` on header button                | `tripStore.createTrip({ title: 'New Trip' })` → on success `router.push({ name: 'trip-detail', params: { id: trip.id } })`; button shows loading state |
| Click trip card                          | `@click` on `TripCard`                   | `router.push({ name: 'trip-detail', params: { id: trip.id } })`                                                                                        |
| Click delete icon on card                | `@delete` from `TripCard`                | Store `deletingTripId`, open delete Dialog                                                                                                             |
| Confirm delete in Dialog                 | Dialog confirm button click              | `tripStore.deleteTripById(id)` → success toast → list updated → Dialog closed                                                                          |
| Cancel delete in Dialog                  | Dialog cancel / Escape / overlay click   | `deletingTripId = null`, Dialog closed                                                                                                                 |
| Pagination "Previous" / "Next"           | `@page-change` from `TripListPagination` | `currentPage = newPage`, `tripStore.fetchTrips(newPage)`                                                                                               |
| Retry on trips error                     | "Try again" button click                 | `tripStore.fetchTrips(currentPage)`                                                                                                                    |

---

## 9. Conditions and Validation

| Condition                                              | Component                    | Effect                                                     |
| ------------------------------------------------------ | ---------------------------- | ---------------------------------------------------------- |
| `profileStore.isLoading && !profileStore.profile`      | `UserProfilePanel`           | Skeleton replaces the entire panel                         |
| `isUpdating === true`                                  | `UserProfilePanel`           | All pill buttons and Textarea disabled                     |
| `dietaryPending === true`                              | `UserProfilePanel` Section A | Textarea visible; dietary pill visually ON; save deferred  |
| `has_dietary_preferences === true` + empty description | `UserProfilePanel` Section A | On Textarea blur → destructive toast + revert pill to OFF  |
| `tripStore.isLoadingTrips`                             | `DashboardView`              | Skeleton cards grid shown; real grid and pagination hidden |
| `tripStore.tripsError !== null`                        | `DashboardView`              | Inline error Alert with "Try again" button shown           |
| `trips.length === 0 && !isLoadingTrips && !tripsError` | `DashboardView`              | Empty state message + "Create your first trip" CTA shown   |
| `pagination.total_pages > 1`                           | `TripListPagination`         | Pagination component rendered                              |
| `pagination.current_page === 1`                        | `TripListPagination`         | "Previous" button disabled                                 |
| `pagination.current_page === total_pages`              | `TripListPagination`         | "Next" button disabled                                     |
| `tripStore.isCreatingTrip === true`                    | `DashboardView`              | "New Trip" button shows loading spinner, disabled          |
| `isDeleting === true`                                  | Delete Dialog buttons        | Both Dialog buttons disabled to prevent double-submit      |

---

## 10. Error Handling

### Profile fetch error

- Error caught in `DashboardView.onMounted` (individual catch for the profile promise)
- Destructive toast: "Could not load your profile. Please refresh."
- `UserProfilePanel` shows an error state (Alert inside the card) instead of crashing

### Profile update error

- `isUpdating` set back to `false` in the `finally` block
- Destructive toast: "Failed to save profile. Please try again."
- UI reverts the optimistic change — all pill state is derived from `profileStore.profile`, which was not updated on failure

### Dietary preferences deferred-save edge case

- If blur fires with empty text: toast "Dietary description is required" + revert pill + clear `dietaryPending`
- If `profileStore.updateProfile` fails after a valid blur: destructive toast "Failed to save dietary preferences" + `has_dietary_preferences` reverts to previous stored value

### Trips fetch error

- `tripStore.tripsError` is set in the store
- Inline error state renders: `Alert` (destructive), message "Failed to load your trips", "Try again" Button
- "Try again" calls `fetchTrips(currentPage)` and resets `tripsError`

### Create trip error

- Toast (destructive): "Failed to create trip. Please try again."
- No navigation; `isCreatingTrip` resets to `false`

### Delete trip error

- Toast (destructive): "Failed to delete trip. Please try again."
- Trip remains in the list (no optimistic deletion)
- Dialog closes regardless

### Toast notifications

```typescript
import { useToast } from '@/components/ui/toast/use-toast'
const { toast } = useToast()
```

| Scenario                          | Variant     | Duration |
| --------------------------------- | ----------- | -------- |
| Profile fetch failure             | destructive | 5 s      |
| Profile update failure            | destructive | 5 s      |
| Dietary description empty on blur | destructive | 5 s      |
| Trips fetch failure (also inline) | destructive | 5 s      |
| Create trip failure               | destructive | 5 s      |
| Delete trip success               | default     | 3 s      |
| Delete trip failure               | destructive | 5 s      |

---

## 11. Implementation Steps

1. **Install missing shadcn-vue components** (if not yet present):

   ```bash
   npx shadcn-vue@latest add skeleton
   npx shadcn-vue@latest add dialog
   npx shadcn-vue@latest add separator
   ```

2. **Verify `src/stores/profile.store.ts`** exposes:
   - `profile: Ref<ProfileDTO | null>`
   - `isLoading: Ref<boolean>`
   - `error: Ref<ErrorResponse | null>`
   - `fetchProfile(): Promise<void>`
   - `updateProfile(updates: UpdateProfileCommand): Promise<void>`

   `updateProfile` must set `isLoading` (or a separate `isUpdating` ref) and handle errors by reverting state and rethrowing.

3. **Verify `src/stores/trip.store.ts`** exposes:
   - `trips: Ref<DashboardTripViewModel[]>`
   - `tripsPagination: Ref<PaginationDTO>`
   - `isLoadingTrips: Ref<boolean>`
   - `isCreatingTrip: Ref<boolean>`
   - `tripsError: Ref<ErrorResponse | null>`
   - `fetchTrips(page?: number, limit?: number): Promise<void>` — select includes `note_body` internally for `notePreview` mapping; defaults are `page = 1, limit = 20`
   - `createTrip(command: CreateTripCommand): Promise<TripDTO>` — always called with `{ title: 'New Trip' }`; returns full `TripDTO` (use `trip.id` for navigation)
   - `deleteTripById(id: number): Promise<void>`

4. **Create `src/components/UserProfilePanel.vue`:**
   - Uses `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Separator`, `Button`, `Textarea`, `Skeleton`
   - Icons from `lucide-vue-next`: `Baby`, `PawPrint`, `Accessibility`, `Utensils`, `TreePine`, `Landmark`, `Waves`, `Building2`, `UtensilsCrossed`, `Snail`, `Scale`, `Zap`, `MapPin`, `Map`, `Car`, `PiggyBank`, `Wallet`, `Gem`
   - Local state: `dietaryDescriptionDraft`, `dietaryPending`, `isUpdating`
   - Section A: four pill Buttons; dietary Textarea with `@blur` deferred-save logic
   - Section B: four preference groups; each pill calls `profileStore.updateProfile()` on click
   - All controls bound to `profileStore.profile` for their active/inactive state

5. **Create `src/components/TripCard.vue`:**
   - Uses `Card`, `CardHeader`, `CardContent`, `CardTitle`, `Badge`, `Button`
   - `Trash2` icon from `lucide-vue-next`
   - Accepts `DashboardTripViewModel` prop
   - Emits `delete(id: number)` on delete button `@click.stop`
   - Status badge computed from `trip.status` with correct class mapping
   - Relative date using a utility or `Intl.RelativeTimeFormat`

6. **Create `src/components/TripListPagination.vue`:**
   - Uses `Button`
   - Props: `pagination: PaginationDTO`, `isLoading: boolean`
   - Emits `page-change(page: number)`
   - "Previous" / "Next" buttons with correct disabled conditions

7. **Implement `src/views/DashboardView.vue`:**
   - `<script setup>` with `profileStore`, `tripStore`, `router`, `useToast`
   - `onMounted`: `Promise.all` with individual `.catch` for profile and trips
   - Local state: `currentPage`, `showDeleteDialog`, `deletingTripId`, `isDeleting`
   - Template sections (in order): `UserProfilePanel` → trip list header → loading/error/empty/grid → `TripListPagination` → delete `Dialog`
   - Delete Dialog: `Dialog`, `DialogContent`, `DialogHeader`, `DialogFooter`; Confirm button (destructive) + Cancel button; both disabled when `isDeleting`

8. **Verify `Toaster` is mounted** in `App.vue` or `AppLayout.vue` — needed for all toast notifications.

9. **Verify router** has the `trip-detail` named route at `/trips/:id` with `meta: { requiresAuth: true }`.

10. **Manual test checklist:**
    - [ ] `UserProfilePanel` Skeleton shown while profile is loading
    - [ ] All four traveler flag pills reflect `profileStore.profile` values
    - [ ] Toggling a simple flag (kids/pets/mobility) calls `updateProfile` and updates the pill
    - [ ] Dietary: toggle ON → Textarea appears; submit valid text → both saved together
    - [ ] Dietary: blur with empty text → toast + pill reverts to OFF
    - [ ] Dietary: toggle ON → OFF → saves `{ has_dietary_preferences: false, dietary_preferences_description: null }`
    - [ ] All Section B (what/speed/type/budget) pills call `updateProfile` on click
    - [ ] Controls are disabled while a save is in flight
    - [ ] Trip list Skeleton shown while loading
    - [ ] Empty state shown when no trips
    - [ ] Trip cards show correct title, badge (CREATED=gray, DRAFT=amber, CONFIRMED=green), note preview, relative date
    - [ ] Clicking a card navigates to `/trips/:id`
    - [ ] "New Trip" creates a trip and navigates to `/trips/:id`
    - [ ] Delete icon opens Dialog; confirm deletes and removes from list
    - [ ] Cancel/Escape closes Dialog without deleting
    - [ ] Pagination controls appear only when `total_pages > 1`
    - [ ] Pagination Previous/Next disable correctly on first/last page
    - [ ] Error state appears on trips fetch failure; "Try again" retries
    - [ ] Responsive grid: 1 column (mobile), 2 columns (sm), 3 columns (lg)
    - [ ] Dark mode: all badges and pill states meet WCAG AA contrast

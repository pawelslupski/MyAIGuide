# View Implementation Plan: DashboardView

## 1. Overview

DashboardView is the protected home screen of MyAIGuide. It is the first page a logged-in user sees and serves as the central hub for trip management. The view displays:

- A **profile completeness banner** (conditional — shown when the user profile is incomplete and the banner has not been dismissed)
- A **responsive grid of trip cards** sorted by `updated_at` descending, each showing title, status badge, note preview, and last-modified date
- A **"Create New Trip" button** that navigates to the trip creation form
- **Pagination controls** when the list exceeds 20 trips
- An **empty state** when the user has no trips yet

The view addresses user stories US-002 (login/dashboard access), US-007 (profile completeness indicator), US-008 (create trip CTA), US-009 (delete trip), and US-010 (trip list browsing).

---

## 2. View Routing

- **Path:** `/`
- **Route name:** `dashboard`
- **Guard:** `meta: { requiresAuth: true }` — already configured in `src/router/index.ts`
- **No additional routing changes needed** for this view itself; however, the following routes must exist for dashboard navigation to work:
  - `{ path: '/profile', name: 'profile', meta: { requiresAuth: true } }` — target of "Complete Profile" CTA
  - `{ path: '/trips/new', name: 'trip-create', meta: { requiresAuth: true } }` — target of "Create New Trip" button
  - `{ path: '/trips/:id', name: 'trip-detail', meta: { requiresAuth: true } }` — target of card click (already in router)

---

## 3. Component Structure

```
DashboardView.vue                         ← view orchestrator
└── AppLayout                             ← existing layout wrapper
    ├── ProfileCompletenessBanner.vue     ← conditional, reads profileStore
    ├── <header row>                      ← page title + "Create New Trip" Button
    ├── <loading state>                   ← Skeleton cards (while isLoadingTrips)
    ├── <error state>                     ← Alert + Retry button (on tripsError)
    ├── <empty state>                     ← message + CTA (when trips.length === 0)
    ├── <grid>                            ← responsive CSS grid
    │   └── TripCard.vue × N             ← one per trip
    └── TripListPagination.vue            ← shown when total_pages > 1
```

---

## 4. Component Details

### `DashboardView.vue`

**Description:** The view orchestrator. Initialises data on mount, manages local UI state (current page, delete dialog), and composes child components into the layout.

**Main elements:**

- `AppLayout` wrapper with `<main>` slot
- `ProfileCompletenessBanner` (conditional)
- Page header: `<h1>` "My Trips" + `<Button>` "Create New Trip" (navigates to `trip-create`)
- Responsive grid `div.grid.grid-cols-1.sm:grid-cols-2.lg:grid-cols-3.gap-4.md:gap-6`
- Skeleton placeholder cards (3 per visible row) while `isLoadingTrips === true`
- Error state: `Alert` (destructive) + "Retry" `Button` when `tripsError !== null`
- Empty state div with message and "Create your first trip" CTA when `trips.length === 0 && !isLoadingTrips`
- `TripCard` for each item in `trips`
- `TripListPagination` below the grid
- `Dialog` (delete confirmation) rendered once, controlled by `showDeleteDialog` / `deletingTripId`

**Handled interactions:**

- On mount: `profileStore.fetchProfile()` + `tripStore.fetchTrips(1)` in parallel
- "Create New Trip" click → `router.push({ name: 'trip-create' })`
- Receiving `@delete` from `TripCard` → sets `deletingTripId`, opens Dialog
- Dialog "Confirm" → `tripStore.deleteTrip(deletingTripId)` → refresh list → close dialog
- Dialog "Cancel" → close dialog
- `@page-change` from `TripListPagination` → update `currentPage`, call `tripStore.fetchTrips(newPage)`
- "Retry" click on error → `tripStore.fetchTrips(currentPage)`

**Handled validation:** None — validation is delegated to child components and the store.

**Types used:**

- `DashboardTripViewModel` (new, see section 5)
- `PaginationDTO` (from `@/types`)

**Props:** None (it is a route-level view)

---

### `ProfileCompletenessBanner.vue`

**Description:** An informational alert displayed at the top of the page when the user's profile is incomplete. Dismissible — dismissal is persisted in `localStorage` so the banner does not reappear within the same browser session, but reappears on a new session if the profile is still incomplete.

**Main elements:**

- `Alert` (shadcn-vue, info/default variant)
- `AlertTitle` "Complete your profile"
- `AlertDescription` "Set your travel preferences to get personalised trip plans."
- `Button` "Complete Profile" (default variant) → navigates to `{ name: 'profile' }`
- `Button` "Dismiss" (ghost variant, size sm) → emits `@dismiss`

**Handled interactions:**

- "Complete Profile" click → `router.push({ name: 'profile' })`
- "Dismiss" click → emits `@dismiss` (parent sets `bannerDismissed = true` and writes to localStorage)

**Handled validation:**

- Component is only rendered when `v-if="!profileStore.isComplete && !bannerDismissed"` — condition evaluated in parent

**Types used:** none beyond `ProfileDTO` (via `profileStore`)

**Props:** None (reads directly from `profileStore`)

**Events emitted:** `dismiss` — no payload

---

### `TripCard.vue`

**Description:** Displays a single trip as a clickable card. Navigates to the trip detail view on click. Includes a delete icon button that triggers the parent's delete confirmation flow.

**Main elements:**

- `Card` (shadcn-vue) — full card is clickable, `cursor-pointer`, `hover:shadow-md` transition
- `CardHeader`: trip `title` (CardTitle) + `Badge` for status
- `CardContent`: truncated note preview (up to 100 chars), relative "Updated" date
- Delete icon `Button` (ghost, size icon, `Trash2` lucide icon) in the top-right corner — stops click propagation to avoid navigating while deleting

**Status badge variants:**
| Status | Badge variant / classes | Label |
|-------------|-------------------------------|------------|
| `CREATED` | `secondary` (gray) | New |
| `DRAFT` | custom `bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200` | In Progress |
| `CONFIRMED` | custom `bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200` | Planned |

**Handled interactions:**

- Card click → `router.push({ name: 'trip-detail', params: { id: trip.id } })`
- Delete button click (stop propagation) → `emit('delete', trip.id)`

**Handled validation:**

- `notePreview` is already truncated — no further validation needed in this component

**Types used:**

- `DashboardTripViewModel` (prop)

**Props:**

```typescript
defineProps<{
  trip: DashboardTripViewModel
}>()
```

**Events emitted:** `delete(id: number)`

---

### `TripListPagination.vue`

**Description:** Simple previous/next pagination control rendered below the trip grid. Only rendered when `pagination.total_pages > 1`.

**Main elements:**

- Flex row with `Button` "Previous" (outline), page counter text "Page X of Y", `Button` "Next" (outline)

**Handled interactions:**

- "Previous" click → `emit('page-change', props.pagination.current_page - 1)` (disabled on page 1)
- "Next" click → `emit('page-change', props.pagination.current_page + 1)` (disabled on last page)

**Handled validation:**

- Previous button: `disabled` when `current_page === 1` or `isLoading`
- Next button: `disabled` when `current_page === total_pages` or `isLoading`

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

| Type              | Usage                                          |
| ----------------- | ---------------------------------------------- |
| `TripStatus`      | status derivation and badge rendering          |
| `PaginationDTO`   | pagination state and `TripListPagination` prop |
| `TripListItemDTO` | base shape for raw API data                    |
| `ErrorResponse`   | store error state                              |

### New ViewModel type (define in `src/views/DashboardView.vue` or `src/types.ts`)

```typescript
/**
 * View model for a trip card on the dashboard.
 * Derived from raw Supabase query result after computing status and truncating the note.
 */
interface DashboardTripViewModel {
  id: number // trip primary key
  title: string // trip title (max 255 chars)
  status: TripStatus // derived: 'CREATED' | 'DRAFT' | 'CONFIRMED'
  notePreview: string // first 100 chars of note_body, empty string if null
  updatedAt: string // ISO 8601 timestamp (used for display)
}
```

### Internal raw query type (local to store action — not exported)

```typescript
// Shape returned by Supabase .select() before transformation
interface TripListRaw {
  id: number
  user_id: string
  title: string
  note_body: string | null
  plan_json: object | null // only null-check needed for status derivation
  created_at: string
  updated_at: string
}
```

### Status derivation helper (define inside `trip.store.ts` as a module-level function)

```typescript
function deriveTripStatus(noteBody: string | null, planJson: object | null): TripStatus {
  if (planJson !== null) return 'CONFIRMED'
  if (noteBody !== null && noteBody.trim() !== '') return 'DRAFT'
  return 'CREATED'
}
```

---

## 6. State Management

### Pinia stores used

**`profileStore` (`src/stores/profile.store.ts`)** — existing, no changes needed:

- `profileStore.fetchProfile()` — called on dashboard mount
- `profileStore.isComplete` — computed boolean used to show/hide banner
- `profileStore.isLoading` — used to defer banner render until profile is loaded

**`trip.store.ts` (`src/stores/trip.store.ts`)** — **must be extended** with the following additions (current implementation only manages `currentTrip`):

```typescript
// New state refs to add
const trips = ref<DashboardTripViewModel[]>([])
const tripsPagination = ref<PaginationDTO>({
  current_page: 1,
  total_pages: 1,
  total_count: 0,
  limit: 20
})
const isLoadingTrips = ref(false)
const tripsError = ref<ErrorResponse | null>(null)

// New actions to add
async function fetchTrips(page = 1, limit = 20): Promise<void>
async function deleteTripById(tripId: number): Promise<void>
```

`fetchTrips` implementation outline:

1. Get authenticated user from `supabaseClient.auth.getUser()`
2. Compute `from/to` range from `(page - 1) * limit` / `from + limit - 1`
3. Query `supabaseClient.from('trips').select('id, user_id, title, note_body, plan_json, created_at, updated_at', { count: 'exact' }).eq('user_id', user.id).order('updated_at', { ascending: false }).range(from, to)`
4. Map raw rows to `DashboardTripViewModel` using `deriveTripStatus` and note truncation
5. Set `trips.value` and `tripsPagination.value`

`deleteTripById` implementation outline:

1. Get authenticated user
2. `supabaseClient.from('trips').delete().eq('id', tripId).eq('user_id', user.id)`
3. Remove deleted trip from `trips.value` (filter in-place)

### Local state in `DashboardView.vue`

```typescript
const currentPage = ref(1)
const showDeleteDialog = ref(false)
const deletingTripId = ref<number | null>(null)
const isDeleting = ref(false)

// Initialised from localStorage on component creation
const bannerDismissed = ref(localStorage.getItem('myaiguide-dashboard-banner-dismissed') === 'true')
```

### localStorage

| Key                                    | Value    | Purpose                              |
| -------------------------------------- | -------- | ------------------------------------ |
| `myaiguide-dashboard-banner-dismissed` | `'true'` | Suppress profile completeness banner |

---

## 7. API Integration

All database operations use the custom Supabase client at `@/db/supabase.client.ts` — no custom Edge Functions are required for the dashboard.

### Fetch trips list

**Called from:** `tripStore.fetchTrips(page)` action, triggered on mount and page change.

**Request (Supabase client):**

```typescript
supabaseClient
  .from('trips')
  .select('id, user_id, title, note_body, plan_json, created_at, updated_at', { count: 'exact' })
  .eq('user_id', authenticatedUserId)
  .order('updated_at', { ascending: false })
  .range(from, to)
```

**Response:** Array of `TripListRaw` rows + `count: number | null`.

**Transformation:** Each row is mapped to `DashboardTripViewModel`:

- `status` → `deriveTripStatus(row.note_body, row.plan_json)`
- `notePreview` → `row.note_body ? row.note_body.slice(0, 100) + (row.note_body.length > 100 ? '…' : '') : ''`
- `updatedAt` → `row.updated_at`

**Pagination metadata built from:** `count` and `page`/`limit` params.

---

### Fetch profile

**Called from:** `profileStore.fetchProfile()`, triggered in parallel with trip fetch on mount.

Uses existing implementation in `profile.store.ts` — queries `profiles` table filtered by `user_id`.

---

### Delete trip

**Called from:** `tripStore.deleteTripById(id)`, triggered after user confirms the delete dialog.

**Request (Supabase client):**

```typescript
supabaseClient.from('trips').delete().eq('id', tripId).eq('user_id', authenticatedUserId)
```

**Response:** No data; error indicates failure.

**Post-delete:** Remove the trip from `trips.value` by filtering, decrement `tripsPagination.total_count` by 1.

---

## 8. User Interactions

| Interaction               | Trigger                        | Outcome                                                                                  |
| ------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| Page load                 | `onMounted`                    | Parallel fetch of profile and trips (page 1); loading skeletons shown                    |
| Click trip card           | `@click` on `Card`             | Navigate to `/trips/:id`                                                                 |
| Click "Create New Trip"   | `@click` on header button      | Navigate to `/trips/new`                                                                 |
| Click "Complete Profile"  | `@click` in banner             | Navigate to `/profile`                                                                   |
| Click "Dismiss" in banner | `@dismiss` event               | Set `bannerDismissed = true`, write localStorage key                                     |
| Click delete icon on card | `@delete` from `TripCard`      | Store `deletingTripId`, open delete `Dialog`                                             |
| Confirm delete in dialog  | `@click` confirm button        | Call `deleteTripById`, show success toast, close dialog; on error show destructive toast |
| Cancel delete in dialog   | `@click` cancel / dialog close | Reset `deletingTripId`, close dialog                                                     |
| Click Previous / Next     | `@page-change` from pagination | Update `currentPage`, call `fetchTrips(newPage)`                                         |
| Click Retry on error      | `@click` on error state button | Call `fetchTrips(currentPage)` again                                                     |

---

## 9. Conditions and Validation

| Condition                                              | Component                   | Effect                                                         |
| ------------------------------------------------------ | --------------------------- | -------------------------------------------------------------- |
| `!profileStore.isComplete && !bannerDismissed`         | `ProfileCompletenessBanner` | Banner is rendered                                             |
| `profileStore.isLoading`                               | `DashboardView`             | Banner render deferred (show nothing instead of false flash)   |
| `tripStore.isLoadingTrips`                             | `DashboardView`             | Show skeleton cards (6 placeholders), hide grid and pagination |
| `tripStore.tripsError !== null`                        | `DashboardView`             | Show error Alert with "Retry" button                           |
| `trips.length === 0 && !isLoadingTrips && !tripsError` | `DashboardView`             | Show empty-state message + "Create first trip" CTA             |
| `pagination.total_pages > 1`                           | `TripListPagination`        | Pagination rendered                                            |
| `pagination.current_page === 1`                        | `TripListPagination`        | "Previous" button disabled                                     |
| `pagination.current_page === total_pages`              | `TripListPagination`        | "Next" button disabled                                         |
| `isDeleting === true`                                  | Delete dialog buttons       | Both buttons disabled to prevent double-submit                 |

---

## 10. Error Handling

### Profile fetch error

- Catch error in `DashboardView.onMounted`
- Show a `useToast()` warning toast: "Could not load profile preferences"
- Proceed without showing the banner (fail-open: missing profile is not a blocking error)

### Trips fetch error

- `tripsError` is set in the store
- `DashboardView` renders an error state: `Alert` (destructive) with message "Failed to load trips" and a "Try again" `Button`
- Clicking "Try again" calls `fetchTrips(currentPage)` and clears `tripsError`

### Delete trip error

- Show destructive toast: "Failed to delete trip. Please try again."
- Do **not** remove the trip from the list (no optimistic delete — consistent with the potential for partial failures)
- Close the dialog regardless of outcome

### Toast notifications (uses existing `use-toast.ts`)

```typescript
import { useToast } from '@/components/ui/toast/use-toast'
const { toast } = useToast()
```

---

## 11. Implementation Steps

1. **Install missing shadcn-vue components** (if not yet present):

   ```bash
   npx shadcn-vue@latest add skeleton
   npx shadcn-vue@latest add alert-dialog
   ```

   _Alternatively, use the existing `Dialog` component for the delete confirmation and CSS-based skeleton placeholders._

2. **Add missing routes to `src/router/index.ts`:**

   ```typescript
   { path: '/profile', name: 'profile', component: () => import('@/views/ProfileView.vue'), meta: { requiresAuth: true } },
   { path: '/trips/new', name: 'trip-create', component: () => import('@/views/TripCreateView.vue'), meta: { requiresAuth: true } },
   ```

3. **Extend `src/stores/trip.store.ts`** with:
   - `trips`, `tripsPagination`, `isLoadingTrips`, `tripsError` state refs
   - `fetchTrips(page, limit)` action with Supabase query + `DashboardTripViewModel` transformation
   - `deleteTripById(tripId)` action
   - Export new refs and actions from the store return object

4. **Add `deriveTripStatus` helper** as a module-level function in `trip.store.ts`:

   ```typescript
   function deriveTripStatus(noteBody: string | null, planJson: object | null): TripStatus { … }
   ```

5. **Create `src/components/ProfileCompletenessBanner.vue`:**
   - Uses `Alert`, `AlertTitle`, `AlertDescription`, `Button`
   - Reads `profileStore.isComplete` internally
   - Emits `dismiss` event

6. **Create `src/components/TripCard.vue`:**
   - Uses `Card`, `CardHeader`, `CardContent`, `CardTitle`, `Badge`, `Button`
   - `Trash2` icon from `lucide-vue-next`
   - Accepts `DashboardTripViewModel` prop
   - Emits `delete(id: number)`
   - Status badge logic as a computed or inline function

7. **Create `src/components/TripListPagination.vue`:**
   - Uses `Button`
   - Accepts `PaginationDTO` + `isLoading` props
   - Emits `page-change(page: number)`

8. **Implement `src/views/DashboardView.vue`:**
   - `<script setup>` with `profileStore`, `tripStore`, `router`
   - `onMounted`: parallel `Promise.all([profileStore.fetchProfile(), tripStore.fetchTrips(1)])` with individual error handling
   - Local state: `currentPage`, `bannerDismissed`, `showDeleteDialog`, `deletingTripId`, `isDeleting`
   - Template sections (in order): banner → header → loading/error/empty/grid states → pagination → delete dialog
   - Delete dialog: use `Dialog` / `DialogContent` / `DialogHeader` / `DialogFooter` with Confirm + Cancel buttons

9. **Verify Toaster is mounted** in `App.vue` or the layout — the `Toaster` component from `@/components/ui/toast/Toaster.vue` must be included once in the app tree.

10. **Manual test checklist:**
    - [ ] Empty state renders when user has no trips
    - [ ] Trip cards display correct title, status badge, note preview, date
    - [ ] Status badge colours: CREATED = gray, DRAFT = amber, CONFIRMED = green
    - [ ] Clicking a card navigates to `/trips/:id`
    - [ ] "Create New Trip" navigates to `/trips/new`
    - [ ] Delete icon opens confirmation dialog; confirming deletes and refreshes list
    - [ ] Pagination controls work and disable correctly on first/last pages
    - [ ] Profile completeness banner shows when profile is incomplete
    - [ ] Dismissing banner hides it; it does not reappear in the same session
    - [ ] Error state appears on trips fetch failure with working retry
    - [ ] Skeleton cards render during loading
    - [ ] Responsive grid: 1 column on mobile, 2 on tablet (sm), 3 on desktop (lg)
    - [ ] Dark mode: all badge variants readable, banner contrast meets WCAG AA

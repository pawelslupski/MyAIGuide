# View Implementation Plan: TripDetailView

## 1. Overview

TripDetailView is the core view of MyAIGuide application, serving as the primary workspace where users create, edit, and manage their trip plans. This view integrates trip note editing, preference configuration, AI plan generation, and plan review/editing functionality in a responsive layout.

**Purpose:**

- Display and edit trip notes (up to 10,000 characters, no minimum)
- Configure trip-specific preferences (what/speed/type/budget)
- Generate AI-powered travel plans with quota tracking
- Review, edit, and save generated plan candidates
- View saved plans with full trip details

**Key Features:**

- Responsive split-panel layout (stacked on mobile, side-by-side on desktop ≥1024px)
- Real-time character counter with validation feedback
- Generation quota visualization (X/10 used)
- Plan candidate system (temporary, lost on refresh)
- Inherited preference indicators (from global profile)
- **Auto-save** – no explicit Save button; changes persist automatically (see §4.1 for details)
- Optimistic UI updates with error handling

## 2. View Routing

**Route Path:** `/trips/:id`

**Route Name:** `trip-detail`

**Route Configuration:**

```typescript
{
  path: '/trips/:id',
  name: 'trip-detail',
  component: () => import('@/views/TripView.vue'),
  meta: {
    requiresAuth: true,
    title: 'Trip Details'
  }
}
```

**Route Parameters:**

- `id` (required): Trip identifier (positive integer)

**Navigation Guards:**

- `beforeEnter`: Validate trip ID format
- `onBeforeRouteLeave`: Warn if unsaved plan candidate exists

## 3. Component Structure

```
TripDetailView.vue (Main Container)
├── TripHeader.vue
│   ├── Trip title (editable)
│   ├── Status badge (CREATED/DRAFT/CONFIRMED)
│   └── Last updated timestamp
│
├── TripEditor.vue (Left Panel / Top on Mobile)
│   ├── TripNoteEditor.vue
│   │   ├── Textarea (max 10,000 chars, no minimum)
│   │   └── CharacterCounter.vue
│   │       └── Validation feedback (color-coded)
│   │
│   └── TripPreferences.vue
│       ├── WhatSelector.vue (multi-select)
│       ├── SpeedSelector.vue (single-select)
│       ├── TypeSelector.vue (single-select)
│       ├── BudgetSelector.vue (single-select)
│       └── InheritedValueIndicator.vue
│
└── PlanPanel.vue (Right Panel / Bottom on Mobile)
    ├── GenerationQuotaCounter.vue
    │   ├── Progress bar (X/10)
    │   ├── Color-coded status (green/yellow/red)
    │   └── Reset time (when at limit)
    │
    ├── PlanCandidateBanner.vue (conditional)
    │   ├── Warning alert (unsaved plan)
    │   └── Action buttons (Save/Discard)
    │
    ├── PlanViewer.vue
    │   ├── PlanDayList.vue
    │   │   └── PlanDayAccordion.vue (for each day)
    │   │       └── ActivityCard.vue (for each activity)
    │   │           ├── Time of day badge
    │   │           ├── Location name (editable in candidate)
    │   │           ├── Description (editable in candidate)
    │   │           └── Category tag badge
    │   │
    │   └── EmptyPlanState.vue (when no plan)
    │
    └── PlanActions.vue
        ├── Generate Plan button (with validation)
        └── Save Plan button (candidate only)
```

## 4. Component Details

### 4.1 TripDetailView.vue (Main Container)

**Description:** Root component that orchestrates the entire trip detail interface. Manages data fetching, state coordination between panels, and responsive layout.

**Main Elements:**

- `<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">` - Responsive grid container
- `<TripEditor>` - Left panel (order-1)
- `<PlanPanel>` - Right panel (order-2, lg:sticky lg:top-4)

**Handled Interactions:**

- Route parameter change (fetch new trip, cancel pending debounced save)
- **Auto-save non-note fields** – `useDebounceFn(performSave, 800)` triggered by a `watch` on
  `[title, destination, what, speed, type, budget, num_days, num_people]` in `pendingFields`
- **Auto-save note** – `handleNoteBlur()` called on `@blur:note` event from `TripEditor`;
  cancels the debounced save first to avoid double request
- Generate plan action
- Save plan action
- Discard plan candidate action

**Handled Validation:**

- Trip ID format validation (positive integer)
- Trip ownership verification (403 check)
- Trip existence check (404 handling)

**Types:**

- `TripDTO` - Full trip data with plan
- `GeneratedPlanDTO` - Plan candidate from generation
- `GenerationQuotaDTO` - Quota information
- `ProfileDTO` - User profile for inherited preferences

**Props:** None (uses route params)

**State Management:**

- Uses `useTripStore()` for trip data
- Uses `usePlanStore()` for plan candidate
- Uses `useProfileStore()` for user profile
- Uses `useQuotaStore()` for generation quota

**Events Emitted:** None (uses stores)

**Composables Used:**

- `useRoute()` - Access route params
- `useRouter()` - Navigation
- `useTripStore()` - Trip state management
- `usePlanStore()` - Plan candidate management
- `useProfileStore()` - User profile data
- `useQuotaStore()` - Generation quota tracking
- `useDebounceFn` (`@vueuse/core`) - Debounced auto-save (800 ms)

**Lifecycle Hooks:**

- `onMounted()` - Fetch trip, profile, and quota data
- `onBeforeRouteLeave()` - Warn about unsaved plan candidate
- `watch(route.params.id)` - Refetch on trip ID change

---

### 4.2 TripHeader.vue

**Description:** Displays trip metadata including title, status badge, and last updated timestamp. Title is editable inline.

**Main Elements:**

- `<Input>` (shadcn-vue) - Editable trip title
- `<Badge>` (shadcn-vue) - Status indicator (CREATED/DRAFT/CONFIRMED)
- `<span>` - Last updated timestamp (relative format)

**Props:**

```typescript
{
  title: string
  status: TripStatus
  updatedAt: string // ISO 8601
}
```

**Events:**

```typescript
{
  'update:title': (newTitle: string) => void
}
```

**Validation:**

- Title: 1-255 characters, non-empty

**Styling:**

- Status badge colors:
  - CREATED: gray
  - DRAFT: yellow
  - CONFIRMED: green

---

### 4.3 TripNoteEditor.vue / TripEditor.vue (note section)

**Description:** Textarea for trip note content with character counter and validation feedback.
The note does **not** auto-save on every keystroke – instead the `Textarea` emits a `blur` event
that bubbles up as `blur:note` from `TripEditor`, triggering a save in `TripView`.

**Main Elements:**

- `<Textarea>` (shadcn-vue) – Note input; `@blur="emit('blur:note')"` wired inside `TripEditor`
- `<CharacterCounter>` – Real-time character count with validation

**Props:**

```typescript
{
  modelValue: string | null
  disabled?: boolean
}
```

**Events:**

```typescript
{
  'update:modelValue': (value: string) => void
  'blur:note': () => void  // triggers auto-save in TripView
}
```

**Validation:**

- Length: max 10,000 characters (no minimum)
- Visual feedback:
  - 0–9,000: Normal text (muted foreground)
  - 9,001–9,999: Yellow/amber "Approaching limit"
  - ≥ 10,000: Red text "Maximum 10,000 characters exceeded"

**Accessibility:**

- `aria-label="Trip note content"`
- `aria-describedby="character-counter"`
- `aria-invalid` when validation fails

---

### 4.4 CharacterCounter.vue

**Description:** Displays character count with color-coded validation feedback.

**Main Elements:**

- `<div>` - Counter display with validation message

**Props:**

```typescript
{
  currentLength: number
  maxLength: number // 10000
}
```

**Computed:**

- `validationState`: 'too-short' | 'valid' | 'too-long'
- `validationMessage`: string
- `validationColor`: 'text-red-500' | 'text-green-600' | 'text-red-500'

**Display Format:**

- "X / 10,000 characters"
- Validation message below count

---

### 4.5 TripPreferences.vue

**Description:** Container for all preference selectors with inherited value indicators.

**Main Elements:**

- `<WhatSelector>` - Multi-select for activity types
- `<SpeedSelector>` - Single-select for pace
- `<TypeSelector>` - Single-select for trip type
- `<BudgetSelector>` - Single-select for budget level

**Props:**

```typescript
{
  what: WhatPreference[]
  speed: SpeedPreference | null
  type: TypePreference | null
  budget: BudgetPreference | null
  inheritedWhat: WhatPreference[] // from profile
  inheritedSpeed: SpeedPreference | null
  inheritedType: TypePreference | null
  inheritedBudget: BudgetPreference | null
}
```

**Events:**

```typescript
{
  'update:what': (value: WhatPreference[]) => void
  'update:speed': (value: SpeedPreference | null) => void
  'update:type': (value: TypePreference | null) => void
  'update:budget': (value: BudgetPreference | null) => void
}
```

**Logic:**

- Display inherited indicator when trip value matches profile default
- Allow override of inherited values
- Visual distinction for inherited vs. custom values
- **Profile default prepopulation:** `TripEditor` initialises local state from
  `props.defaultPreferences` when the trip field is empty (`ref()` init + a `watch` on
  `props.defaultPreferences` with `{ deep: true }` as a safety net for late-arriving profile data).
  The "From profile" `<Badge>` appears when the current local value equals the profile default.

---

### 4.6 WhatSelector.vue

**Description:** Multi-select checkbox group for activity preferences.

**Main Elements:**

- `<Checkbox>` (shadcn-vue / reka-ui) – For each WhatPreference option.
  **Important:** reka-ui `CheckboxRoot` uses `modelValue` (not `checked`) as the controlled
  reactive prop. Use `:model-value="localWhat.includes(option.value)"` and
  `@update:model-value="toggleWhat(option.value)"`. Using `:checked` is silently ignored.
- `<Label>` - Descriptive labels with icons

**Props:**

```typescript
{
  modelValue: WhatPreference[]
  inherited: WhatPreference[]
}
```

**Events:**

```typescript
{
  'update:modelValue': (value: WhatPreference[]) => void
}
```

**Options:**

- `nature` - "Nature & Hiking"
- `culture_museums` - "Culture & Museums"
- `beach_relax` - "Beach & Relaxation"
- `city_break` - "City Break"
- `foodie` - "Food & Culinary"

**Validation:**

- At least 1 option must be selected
- Maximum 5 options (all)

---

### 4.7 SpeedSelector.vue

**Description:** Single-select radio group for trip pace preference.

**Main Elements:**

- `<RadioGroup>` (shadcn-vue) - Speed options
- `<InheritedValueIndicator>` - Shows if using profile default

**Props:**

```typescript
{
  modelValue: SpeedPreference | null
  inherited: SpeedPreference | null
}
```

**Events:**

```typescript
{
  'update:modelValue': (value: SpeedPreference | null) => void
}
```

**Options:**

- `slow_chill` - "Slow & Chill"
- `balance` - "Balanced"
- `intensive` - "Intensive"

---

### 4.8 TypeSelector.vue

**Description:** Single-select radio group for trip type preference.

**Main Elements:**

- `<RadioGroup>` (shadcn-vue) - Type options
- `<InheritedValueIndicator>` - Shows if using profile default

**Props:**

```typescript
{
  modelValue: TypePreference | null
  inherited: TypePreference | null
}
```

**Events:**

```typescript
{
  'update:modelValue': (value: TypePreference | null) => void
}
```

**Options:**

- `base` - "Base"
- `base_with_trips` - "Base + Day Trips"
- `roadtrip` - "Road Trip"

---

### 4.9 BudgetSelector.vue

**Description:** Single-select radio group for budget preference.

**Main Elements:**

- `<RadioGroup>` (shadcn-vue) - Budget options
- `<InheritedValueIndicator>` - Shows if using profile default

**Props:**

```typescript
{
  modelValue: BudgetPreference | null
  inherited: BudgetPreference | null
}
```

**Events:**

```typescript
{
  'update:modelValue': (value: BudgetPreference | null) => void
}
```

**Options:**

- `budget` - "Budget"
- `moderate` - "Moderate"
- `luxury` - "Luxury"

---

### 4.10 InheritedValueIndicator.vue

**Description:** Small badge/icon indicating a preference value is inherited from user profile.

**Main Elements:**

- `<Badge>` (shadcn-vue) - "From profile" indicator
- `<Tooltip>` (shadcn-vue) - Explanation on hover

**Props:**

```typescript
{
  show: boolean
}
```

**Styling:**

- Subtle gray badge
- Icon: inheritance symbol or "↓"
- Tooltip: "This value is inherited from your profile preferences"

---

### 4.11 PlanPanel.vue

**Description:** Right panel (or bottom on mobile) containing plan generation controls, quota display, and plan viewer.

**Main Elements:**

- `<GenerationQuotaCounter>` - Quota visualization
- `<PlanCandidateBanner>` - Warning for unsaved plan (conditional)
- `<PlanViewer>` - Plan display (saved or candidate)
- `<EmptyPlanState>` - Placeholder when no plan exists
- `<PlanActions>` - Generate/Save buttons

**Props:**

```typescript
{
  trip: TripDTO
  planCandidate: GeneratedPlanDTO | null
  quota: GenerationQuotaDTO
  isGenerating: boolean
}
```

**Events:**

```typescript
{
  'generate-plan': () => void
  'save-plan': () => void
  'discard-candidate': () => void
}
```

**Conditional Rendering:**

- Show `<PlanCandidateBanner>` if `planCandidate !== null`
- Show `<PlanViewer>` if `trip.plan_json !== null || planCandidate !== null`
- Show `<EmptyPlanState>` if both are null
- Disable Generate button if quota exceeded or note invalid

---

### 4.12 GenerationQuotaCounter.vue

**Description:** Visual display of generation quota usage with progress bar.

**Main Elements:**

- `<Progress>` (shadcn-vue) - Visual progress bar
- `<span>` - Text display "X / 10 generations used"
- `<span>` - Reset time (when at limit)

**Props:**

```typescript
{
  used: number
  limit: number // always 10
  reset_at: string // ISO 8601
}
```

**Computed:**

- `percentage`: (used / limit) \* 100
- `statusColor`:
  - 0-7: green
  - 8-9: yellow
  - 10: red
- `resetTimeFormatted`: Relative time (e.g., "in 3 hours")

**Display:**

- Progress bar with color-coded fill
- "X / 10 generations used"
- If at limit: "Quota resets in X hours"

---

### 4.13 PlanCandidateBanner.vue

**Description:** Alert banner warning user about unsaved plan candidate.

**Main Elements:**

- `<Alert>` (shadcn-vue) - Warning variant
- `<Button>` - Save Plan (primary)
- `<Button>` - Discard (secondary/destructive)

**Props:**

```typescript
{
  show: boolean
}
```

**Events:**

```typescript
{
  'save': () => void
  'discard': () => void
}
```

**Content:**

- Icon: Warning triangle
- Title: "Unsaved Plan"
- Message: "You have a generated plan that hasn't been saved. It will be lost if you leave this page."
- Actions: Save Plan, Discard buttons

---

### 4.14 PlanViewer.vue

**Description:** Displays plan content (saved or candidate) with day-by-day breakdown.

**Main Elements:**

- `<PlanDayList>` - List of days with activities
- Plan metadata (language, generation date)

**Props:**

```typescript
{
  plan: PlanJson
  language: string
  generatedAt: string // ISO 8601
  isCandidate: boolean // true if unsaved
}
```

**Styling:**

- Candidate plans have subtle yellow background
- Saved plans have normal background
- Visual indicator for candidate vs. saved

---

### 4.15 PlanDayList.vue

**Description:** Accordion list of plan days, each expandable to show activities.

**Main Elements:**

- `<Accordion>` (shadcn-vue) - Collapsible day sections
- `<ActivityCard>` - For each activity in day

**Props:**

```typescript
{
  days: Day[]
  editable: boolean // true for candidates
}
```

**Events:**

```typescript
{
  'update:days': (days: Day[]) => void
}
```

**Behavior:**

- First day expanded by default
- Click day header to expand/collapse
- Show activity count in header (e.g., "Day 1 - 4 activities")

---

### 4.16 ActivityCard.vue

**Description:** Card displaying a single activity with time, location, description, and category.

**Main Elements:**

- `<Card>` (shadcn-vue) - Activity container
- `<Badge>` - Time of day indicator
- `<Badge>` - Category tag
- `<Input>` - Location name (editable in candidate mode)
- `<Textarea>` - Description (editable in candidate mode)

**Props:**

```typescript
{
  activity: Activity
  editable: boolean
}
```

**Events:**

```typescript
{
  'update:activity': (activity: Activity) => void
}
```

**Layout:**

- Time badge (top-left)
- Category badge (top-right)
- Location name (bold, larger text)
- Description (normal text)

---

### 4.17 EmptyPlanState.vue

**Description:** Placeholder shown when no plan exists (neither saved nor candidate).

**Main Elements:**

- `<div>` - Empty state container
- Icon - Map or compass illustration
- Text - Instructional message

**Content:**

- Icon: Map/compass graphic
- Title: "No Plan Yet"
- Message: "Write your trip notes and click 'Generate Plan' to create your AI-powered travel itinerary."
- Hint: "Make sure to set your preferences for the best results!"

**Styling:**

- Centered layout
- Muted colors
- Friendly, encouraging tone

---

### 4.18 PlanActions.vue

**Description:** Action buttons for plan generation and saving.

**Main Elements:**

- `<Button>` (shadcn-vue) - Generate Plan (primary)
- `<Button>` (shadcn-vue) - Save Plan (success, candidate only)

**Props:**

```typescript
{
  canGenerate: boolean
  canSave: boolean
  isGenerating: boolean
  isSaving: boolean
}
```

**Events:**

```typescript
{
  'generate': () => void
  'save': () => void
}
```

**Button States:**

- Generate Plan:
  - Disabled if: note invalid, quota exceeded, already generating
  - Loading state while generating
  - Tooltip explains why disabled
- Save Plan:
  - Only visible when plan candidate exists
  - Disabled while saving
  - Loading state while saving

---

## 5. Types

### 5.1 Core DTOs (from src/types.ts)

**TripDTO:**

```typescript
interface TripDTO extends Omit<Tables<'trips'>, 'plan_json'> {
  id: number
  user_id: string
  title: string
  note_body: string | null
  what: WhatPreference[]
  speed: SpeedPreference | null
  type: TypePreference | null
  budget: BudgetPreference | null
  plan_json: PlanJson | null
  plan_language: string | null
  status: TripStatus // CREATED | DRAFT | CONFIRMED
  created_at: string
  updated_at: string
}
```

**GeneratedPlanDTO:**

```typescript
interface GeneratedPlanDTO {
  plan: PlanJson
  language: string
  model_used: string
  generated_at: string // ISO 8601
  /** Updated quota snapshot returned alongside the plan – avoids an extra round-trip. */
  quota: GenerationQuotaDTO
}
```

**GenerationQuotaDTO:**

```typescript
interface GenerationQuotaDTO {
  used: number
  limit: number
  remaining: number
  reset_at: string // ISO 8601 – always present
}
```

**ProfileDTO:**

```typescript
interface ProfileDTO {
  user_id: string
  has_kids: boolean
  has_pets: boolean
  has_mobility_issues: boolean
  has_dietary_preferences: boolean
  default_what: WhatPreference[]
  default_speed: SpeedPreference | null
  default_type: TypePreference | null
  default_budget: BudgetPreference | null
}
```

**PlanJson:**

```typescript
interface PlanJson {
  days: Day[]
}

interface Day {
  day: number
  activities: Activity[]
}

interface Activity {
  timeOfDay: string
  locationName: string
  description: string
  categoryTag: WhatPreference
}
```

### 5.2 Preference Types

**WhatPreference:**

```typescript
type WhatPreference = 'nature' | 'culture_museums' | 'beach_relax' | 'city_break' | 'foodie'
```

**SpeedPreference:**

```typescript
type SpeedPreference = 'slow_chill' | 'balance' | 'intensive'
```

**TypePreference:**

```typescript
type TypePreference = 'base' | 'base_with_trips' | 'roadtrip'
```

**BudgetPreference:**

```typescript
type BudgetPreference = 'budget' | 'moderate' | 'luxury'
```

**TripStatus:**

```typescript
type TripStatus = 'CREATED' | 'DRAFT' | 'CONFIRMED'
```

### 5.3 View Models (to be created)

**TripEditorViewModel:**

```typescript
interface TripEditorViewModel {
  trip: TripDTO
  profile: ProfileDTO
  noteValidation: {
    isValid: boolean
    currentLength: number
    maxLength: number
    message: string
  }
  inheritedPreferences: {
    what: WhatPreference[]
    speed: SpeedPreference | null
    type: TypePreference | null
    budget: BudgetPreference | null
  }
}
```

**PlanPanelViewModel:**

```typescript
interface PlanPanelViewModel {
  displayedPlan: PlanJson | null // candidate or saved
  planSource: 'saved' | 'candidate' | null
  planLanguage: string | null
  planGeneratedAt: string | null
  quota: GenerationQuotaDTO
  canGenerate: boolean
  canSave: boolean
}
```

---

## 6. State Management

### 6.1 useTripStore (Pinia)

**State:**

```typescript
{
  currentTrip: TripDTO | null
  isLoading: boolean
  isSaving: boolean
  error: ErrorResponse | null
}
```

**Getters:**

```typescript
{
  tripStatus: (state) => state.currentTrip?.status ?? null
  hasNote: (state) => state.currentTrip?.note_body !== null
  hasPlan: (state) => state.currentTrip?.plan_json !== null
}
```

**Actions:**

```typescript
{
  async fetchTrip(tripId: number): Promise<void>
  async updateTripTitle(tripId: number, title: string): Promise<void>
  async updateTripNote(tripId: number, noteBody: string): Promise<void>
  async updateTripPreferences(tripId: number, preferences: TripPreferences): Promise<void>
  clearTrip(): void
}
```

**Implementation Notes:**

- Uses Supabase client directly (no Edge Function needed)
- Implements optimistic updates for better UX
- Rollback on error
- Debounced auto-save for note content (2 seconds)

---

### 6.2 usePlanStore (Pinia)

**State:**

```typescript
{
  planCandidate: GeneratedPlanDTO | null
  isGenerating: boolean
  isSaving: boolean
  generationError: ErrorResponse | null
}
```

**Getters:**

```typescript
{
  hasCandidate: (state) => state.planCandidate !== null
  candidatePlan: (state) => state.planCandidate?.plan ?? null
}
```

**Actions:**

```typescript
{
  async generatePlan(tripId: number): Promise<void>
  async savePlanToTrip(tripId: number): Promise<void>
  discardCandidate(): void
  updateCandidatePlan(plan: PlanJson): void
}
```

**Implementation Notes:**

- Plan candidate stored only in memory (lost on refresh)
- `generatePlan()` calls POST /api/trips/:id/generate-plan
- `savePlanToTrip()` calls PUT /api/trips/:id/plan
- After successful save, clears candidate and updates trip store

---

### 6.3 useProfileStore (Pinia)

**State:**

```typescript
{
  profile: ProfileDTO | null
  isLoading: boolean
  error: ErrorResponse | null
}
```

**Getters:**

```typescript
{
  defaultPreferences: (state) => ({
    what: state.profile?.default_what ?? [],
    speed: state.profile?.default_speed ?? null,
    type: state.profile?.default_type ?? null,
    budget: state.profile?.default_budget ?? null
  })
}
```

**Actions:**

```typescript
{
  async fetchProfile(): Promise<void>
  async updateProfile(updates: Partial<ProfileDTO>): Promise<void>
}
```

**Implementation Notes:**

- Fetched once on app load
- Cached for session duration
- Used to show inherited preference indicators

---

### 6.4 useQuotaStore (Pinia)

**State:**

```typescript
{
  quota: GenerationQuotaDTO | null
  isLoading: boolean
  error: ErrorResponse | null
}
```

**Getters:**

```typescript
{
  isQuotaExceeded: (state) => state.quota?.used >= state.quota?.limit
  remainingGenerations: (state) => (state.quota?.limit ?? 10) - (state.quota?.used ?? 0)
}
```

**Actions:**

```typescript
{
  async fetchQuota(): Promise<void>
  incrementUsed(): void // Optimistic update after generation
}
```

**Implementation Notes:**

- Fetched on TripDetailView mount
- Refreshed after each generation
- Optimistic increment for immediate UI feedback

---

## 7. API Integration

### 7.1 GET /api/trips/:id

**Purpose:** Fetch trip details including saved plan

**Service Function:** `fetchTripById(tripId: number): Promise<TripDTO>`

**Location:** `src/lib/services/trip.service.ts`

**Implementation:**

```typescript
export async function fetchTripById(tripId: number): Promise<TripDTO> {
  const { data, error } = await supabaseClient.from('trips').select('*').eq('id', tripId).single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Trip not found')

  const status = deriveTripStatus(data.note_body, data.plan_json)

  return {
    ...data,
    plan_json: data.plan_json as PlanJson | null,
    status
  }
}
```

**Error Handling:**

- 404: Trip not found → Redirect to trips list
- 403: Forbidden (RLS) → Show error message
- 500: Server error → Show error toast

---

### 7.2 POST /api/trips/:id/generate-plan

**Purpose:** Generate AI travel plan based on trip note and preferences

**Service Function:** `generatePlan(tripId: number): Promise<GeneratedPlanDTO>`

**Location:** `src/lib/services/generation.service.ts`

**Implementation:**

```typescript
export async function generatePlan(tripId: number): Promise<GeneratedPlanDTO> {
  const { data, error } = await supabaseClient.functions.invoke('api', {
    body: { tripId },
    // Edge Function route: POST /api/trips/:id/generate-plan
    headers: { 'x-route': `POST /api/trips/${tripId}/generate-plan` }
  })

  if (error) {
    const parsed = error as { code?: string; message?: string }
    throw new ApiError(parsed.code ?? 'UNKNOWN', parsed.message ?? 'Generation failed')
  }

  return data as GeneratedPlanDTO
}
```

**Error Handling:**

- 400: Validation error (note too long) → Show inline error
- 429: Quota exceeded → Show quota message with reset time
- 500: AI API error → Show retry button
- 503: Service unavailable → Show "try again later" message

**Loading State:**

- Show spinner in PlanPanel
- Disable Generate button
- Display "Generating your plan..." message
- Estimated time: 5-30 seconds

---

### 7.3 PUT /api/trips/:id/plan

**Purpose:** Save plan candidate to trip

**Service Function:** `savePlanToTrip(tripId: number, planJson: PlanJson, planLanguage: string): Promise<TripDTO>`

**Location:** `src/lib/services/trip.service.ts`

**Implementation:**

```typescript
export async function savePlanToTrip(
  tripId: number,
  planJson: PlanJson,
  planLanguage: string
): Promise<TripDTO> {
  const userId = await getCurrentUserId()

  // Validate plan structure
  validateSavePlanCommand({ plan_json: planJson, plan_language: planLanguage })

  // Fetch trip to verify ownership
  const { data: trip, error: fetchError } = await supabaseClient
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single()

  if (fetchError || !trip) throw new Error('Trip not found')
  if (trip.user_id !== userId) throw new Error('Forbidden')

  // Update plan
  const { data: updatedTrip, error: updateError } = await supabaseClient
    .from('trips')
    .update({ plan_json: planJson, plan_language: planLanguage })
    .eq('id', tripId)
    .select()
    .single()

  if (updateError || !updatedTrip) throw new Error('Failed to save plan')

  const status = deriveTripStatus(updatedTrip.note_body, updatedTrip.plan_json)

  return {
    ...updatedTrip,
    plan_json: updatedTrip.plan_json as PlanJson | null,
    status
  }
}
```

**Error Handling:**

- 400: Invalid plan structure → Show error message
- 403: Forbidden → Show error message
- 404: Trip not found → Redirect to trips list
- 500: Server error → Show retry button

**Success Flow:**

- Update trip store with saved plan
- Clear plan candidate from plan store
- Show success toast
- Update trip status to CONFIRMED

---

### 7.4 GET /api/users/me/generation-quota

**Purpose:** Fetch current generation quota status

**Service Function:** `fetchGenerationQuota(): Promise<GenerationQuotaDTO>`

**Location:** `src/lib/services/generation.service.ts`

**Implementation:**

```typescript
export async function fetchGenerationQuota(): Promise<GenerationQuotaDTO> {
  const { data, error } = await supabaseClient.functions.invoke('api', {
    headers: { 'x-route': 'GET /api/users/me/generation-quota' }
  })

  if (error) throw new Error((error as { message?: string }).message ?? 'Failed to fetch quota')

  return data as GenerationQuotaDTO
}
```

> **Note:** `quota.service.ts` does **not** exist. All quota operations live in `generation.service.ts`. The quota snapshot is also returned directly in the `GeneratedPlanDTO.quota` field after each generation, so a separate round-trip is only needed on initial TripView mount.

---

## 8. User Interactions

### 8.1 Edit Trip Note

**Trigger:** User types in note textarea

**Flow:**

1. User types in `<TripNoteEditor>`
2. Component emits `update:modelValue` event
3. Parent updates local state (immediate)
4. Debounced auto-save triggers after 2 seconds
5. `useTripStore().updateTripNote()` called
6. Optimistic UI update (no loading state)
7. On error: Rollback and show error toast

**Validation:**

- Real-time character count update
- Color-coded validation feedback
- Disable Generate button if invalid

---

### 8.2 Change Trip Preferences

**Trigger:** User selects preference option

**Flow:**

1. User clicks preference selector (what/speed/type/budget)
2. Component emits `update:*` event
3. Parent updates local state (immediate)
4. `useTripStore().updateTripPreferences()` called
5. Optimistic UI update
6. On error: Rollback and show error toast

**Visual Feedback:**

- Inherited indicator shows/hides based on match with profile
- Selected options highlighted
- Immediate UI response

---

### 8.3 Generate Plan

**Trigger:** User clicks "Generate Plan" button

**Preconditions:**

- Note body is present and does not exceed 10,000 characters (no minimum)
- Generation quota not exceeded (< 10 in 24 hours)
- Not already generating

**Flow:**

1. User clicks "Generate Plan" button
2. Validate preconditions (client-side)
3. `usePlanStore().generatePlan(tripId)` called
4. Show loading state in PlanPanel
5. Call POST /api/trips/:id/generate-plan
6. On success:
   - Store plan in `planCandidate` state
   - Show PlanCandidateBanner
   - Display plan in PlanViewer
   - Increment quota counter (optimistic)
   - Show success toast
7. On error:
   - Show error message based on error code
   - Keep existing plan (if any)
   - Don't increment quota

**Loading State:**

- Spinner in PlanPanel
- "Generating your plan..." message
- Disable Generate button
- Estimated time display (5-30 seconds)

**Error Messages:**

- 400 (note invalid): "Your trip note exceeds the maximum of 10,000 characters"
- 429 (quota exceeded): "You've reached your limit of 10 plan generations. Quota resets in X hours."
- 500 (AI error): "Failed to generate plan. Please try again."
- 503 (service unavailable): "AI service is temporarily unavailable. Please try again later."

---

### 8.4 Save Plan

**Trigger:** User clicks "Save Plan" button in PlanCandidateBanner or PlanActions

**Preconditions:**

- Plan candidate exists in state
- Not already saving

**Flow:**

1. User clicks "Save Plan" button
2. `usePlanStore().savePlanToTrip(tripId)` called
3. Show loading state on button
4. Call PUT /api/trips/:id/plan with candidate data
5. On success:
   - Update trip store with saved plan
   - Clear plan candidate
   - Hide PlanCandidateBanner
   - Update trip status to CONFIRMED
   - Show success toast: "Plan saved successfully!"
6. On error:
   - Keep candidate in state
   - Show error toast
   - Allow retry

**Loading State:**

- Button shows spinner
- Button text: "Saving..."
- Disable all plan actions

---

### 8.5 Discard Plan Candidate

**Trigger:** User clicks "Discard" button in PlanCandidateBanner

**Flow:**

1. User clicks "Discard" button
2. Show confirmation dialog: "Are you sure? This plan will be lost."
3. If confirmed:
   - `usePlanStore().discardCandidate()` called
   - Clear plan candidate from state
   - Hide PlanCandidateBanner
   - Show saved plan (if exists) or EmptyPlanState
   - Show toast: "Plan discarded"
4. If cancelled:
   - No action, keep candidate

---

### 8.6 Edit Plan Candidate

**Trigger:** User edits activity in plan candidate

**Flow:**

1. User clicks on activity location/description in candidate plan
2. Field becomes editable (inline editing)
3. User makes changes
4. On blur or Enter key:
   - `usePlanStore().updateCandidatePlan()` called
   - Update candidate in state (no API call)
   - Show visual feedback (saved indicator)
5. Changes persist in candidate until saved or discarded

**Note:** Only candidate plans are editable, saved plans are read-only

---

### 8.7 Navigate Away with Unsaved Candidate

**Trigger:** User tries to navigate away while plan candidate exists

**Flow:**

1. User clicks navigation link or back button
2. `onBeforeRouteLeave` guard triggered
3. If plan candidate exists:
   - Show confirmation dialog: "You have an unsaved plan. Leave anyway?"
   - If confirmed: Allow navigation, candidate is lost
   - If cancelled: Stay on page
4. If no candidate: Allow navigation

---

## 9. Conditions and Validation

### 9.1 Note Body Validation

**Rules:**

- **No minimum length** — any non-null note is accepted
- Maximum length: 10,000 characters
- Cannot be null when generating plan (destination must also be set)

**Validation Points:**

- Real-time in CharacterCounter component
- Before enabling Generate button (disabled when length > 10,000 or destination missing)
- Server-side in POST /api/trips/:id/generate-plan

**Error Messages:**

- > 10,000: "Maximum 10,000 characters exceeded (currently: X)"
- null / empty: "A trip note is required to generate a plan"

---

### 9.2 Generation Quota Validation

**Rules:**

- Maximum 10 generations per user in rolling 24-hour window
- Counted from `plan_generations` table
- Reset time calculated from oldest generation in window

**Validation Points:**

- Before enabling Generate button
- Server-side in POST /api/trips/:id/generate-plan

**UI Feedback:**

- Quota counter shows X/10 used
- Color-coded: green (0-7), yellow (8-9), red (10)
- When at limit: "Quota resets in X hours"
- Generate button disabled when quota exceeded

---

### 9.3 Preference Inheritance

**Rules:**

- Trip preferences default to user profile preferences
- User can override any preference
- Inherited indicator shown when trip value matches profile default

**Logic:**

```typescript
function isInherited(tripValue: any, profileValue: any): boolean {
  if (Array.isArray(tripValue) && Array.isArray(profileValue)) {
    return JSON.stringify(tripValue.sort()) === JSON.stringify(profileValue.sort())
  }
  return tripValue === profileValue
}
```

**Visual Indicators:**

- Badge or icon next to inherited preferences
- Tooltip explains inheritance
- Indicator disappears when user overrides value

---

### 9.4 Trip Status Derivation

**Rules:**

- CREATED: `note_body IS NULL AND plan_json IS NULL`
- DRAFT: `note_body IS NOT NULL AND plan_json IS NULL`
- CONFIRMED: `plan_json IS NOT NULL`

**Implementation:**

```typescript
function deriveTripStatus(noteBody: string | null, planJson: unknown): TripStatus {
  if (planJson !== null) return 'CONFIRMED'
  if (noteBody !== null && noteBody.length > 0) return 'DRAFT'
  return 'CREATED'
}
```

**UI Impact:**

- Status badge color in TripHeader
- Conditional rendering in PlanPanel
- Navigation breadcrumb styling

---

## 10. Error Handling

### 10.1 Trip Not Found (404)

**Scenario:** User navigates to `/trips/:id` with invalid or non-existent trip ID

**Handling:**

1. `fetchTripById()` throws error
2. Catch in `onMounted()` hook
3. Show error toast: "Trip not found"
4. Redirect to `/trips` (trips list view)

**Implementation:**

```typescript
try {
  await tripStore.fetchTrip(tripId)
} catch (error) {
  if (error.status === 404) {
    toast.error('Trip not found')
    router.push('/trips')
  }
}
```

---

### 10.2 Forbidden Access (403)

**Scenario:** User tries to access another user's trip (RLS blocks query)

**Handling:**

1. Supabase RLS returns empty result
2. Treat as 404 (don't leak trip existence)
3. Show error toast: "Trip not found"
4. Redirect to `/trips`

**Security Note:** Never reveal whether trip exists for other users

---

### 10.3 Note Validation Error (400)

**Scenario:** User tries to generate plan with invalid note length

**Handling:**

1. Client-side validation prevents API call
2. Disable Generate button
3. Show inline error in CharacterCounter
4. If server returns 400:
   - Show error toast with specific message
   - Highlight note editor
   - Focus on note textarea

**Error Message:**

- "Your trip note must be between 1,000 and 10,000 characters to generate a plan"

---

### 10.4 Quota Exceeded (429)

**Scenario:** User has used all 10 generations in 24-hour window

**Handling:**

1. Client-side check disables Generate button
2. Show quota counter in red
3. Display reset time: "Quota resets in X hours"
4. If server returns 429:
   - Refresh quota from server
   - Show error toast with reset time
   - Keep Generate button disabled

**Error Message:**

- "You've reached your limit of 10 plan generations. Quota resets in 3 hours."

---

### 10.5 AI Generation Error (500)

**Scenario:** AI service fails to generate plan (timeout, API error, validation error)

**Handling:**

1. Show error toast: "Failed to generate plan. Please try again."
2. Keep Generate button enabled for retry
3. Don't increment quota counter
4. Log error details for debugging
5. Offer retry button in error toast

**Error Message:**

- "Failed to generate plan. Please try again."
- Action button: "Retry"

---

### 10.6 Service Unavailable (503)

**Scenario:** AI service or Edge Function is down

**Handling:**

1. Show error toast: "AI service is temporarily unavailable"
2. Disable Generate button temporarily
3. Show retry button after 30 seconds
4. Log error for monitoring

**Error Message:**

- "AI service is temporarily unavailable. Please try again later."

---

### 10.7 Network Error

**Scenario:** No internet connection or request timeout

**Handling:**

1. Catch network errors in service layer
2. Show error toast: "Network error. Please check your connection."
3. Keep data in local state (don't lose unsaved changes)
4. Offer retry button
5. Auto-retry after connection restored (optional)

**Error Message:**

- "Network error. Please check your internet connection and try again."

---

### 10.8 Save Plan Error (500)

**Scenario:** Database error when saving plan

**Handling:**

1. Keep plan candidate in state (don't lose data)
2. Show error toast: "Failed to save plan. Please try again."
3. Offer retry button
4. Log error details
5. If persistent, suggest downloading plan as JSON (future enhancement)

**Error Message:**

- "Failed to save plan. Please try again."
- Action button: "Retry"

---

### 10.9 Optimistic Update Rollback

**Scenario:** Optimistic update fails (note edit, preference change)

**Handling:**

1. Immediately update UI (optimistic)
2. Send API request in background
3. On error:
   - Rollback UI to previous state
   - Show error toast
   - Highlight failed field
4. On success:
   - Keep optimistic update
   - No additional UI feedback

**Implementation:**

```typescript
const previousValue = trip.note_body
trip.note_body = newValue // Optimistic update

try {
  await tripStore.updateTripNote(tripId, newValue)
} catch (error) {
  trip.note_body = previousValue // Rollback
  toast.error('Failed to save changes')
}
```

---

## 11. Implementation Steps

### Phase 1: Setup and Core Structure (Days 1-2)

**Step 1.1: Create View File**

- Create `src/views/TripDetailView.vue`
- Set up basic layout with responsive grid
- Add route configuration in `src/router/index.ts`
- Test routing with placeholder content

**Step 1.2: Create Pinia Stores**

- Create `src/stores/trip.store.ts` (useTripStore)
- Create `src/stores/plan.store.ts` (usePlanStore)
- Create `src/stores/profile.store.ts` (useProfileStore)
- Create `src/stores/quota.store.ts` (useQuotaStore) — manages quota state; updated from `GeneratedPlanDTO.quota` after generation
- Define state, getters, actions for each store

**Step 1.3: Create Service Layer**

- Create `src/lib/services/trip.service.ts`
  - `fetchTripById()`
  - `updateTripNote()`
  - `updateTripPreferences()`
  - `savePlanToTrip()`
  - `deriveTripStatus()`
- Create `src/lib/services/generation.service.ts`
  - `generatePlan()` — calls Supabase Edge Function via `supabaseClient.functions.invoke()`
  - `fetchGenerationQuota()` — calls Edge Function for initial quota load on mount
    > **Note:** There is no `quota.service.ts`. All quota-related logic lives in `generation.service.ts`.

**Step 1.4: Create Validation Schemas**

- Create `src/lib/validation/plan.schemas.ts`
  - `planJsonSchema`
  - `savePlanCommandSchema`
  - `validateSavePlanCommand()`

---

### Phase 2: Trip Editor Panel (Days 3-4)

**Step 2.1: Create TripHeader Component**

- Create `src/components/TripHeader.vue`
- Implement editable title with Input (shadcn-vue)
- Add status badge with color coding
- Add last updated timestamp (use date-fns for formatting)
- Test with mock data

**Step 2.2: Create TripNoteEditor Component**

- Create `src/components/TripNoteEditor.vue`
- Implement Textarea (shadcn-vue) with v-model
- Add CharacterCounter component
- Implement real-time validation
- Test character counting and validation feedback

**Step 2.3: Create CharacterCounter Component**

- Create `src/components/CharacterCounter.vue`
- Implement color-coded validation (red/green)
- Add validation messages
- Test with various character counts

**Step 2.4: Create Preference Selectors**

- Create `src/components/WhatSelector.vue` (multi-select checkboxes)
- Create `src/components/SpeedSelector.vue` (radio group)
- Create `src/components/TypeSelector.vue` (radio group)
- Create `src/components/BudgetSelector.vue` (radio group)
- Create `src/components/InheritedValueIndicator.vue`
- Test preference selection and inheritance logic

**Step 2.5: Create TripPreferences Container**

- Create `src/components/TripPreferences.vue`
- Integrate all preference selectors
- Implement inheritance detection logic
- Test with profile data

**Step 2.6: Create TripEditor Container**

- Create `src/components/TripEditor.vue`
- Integrate TripNoteEditor and TripPreferences
- Implement debounced auto-save (2 seconds)
- Test optimistic updates and rollback

---

### Phase 3: Plan Panel (Days 5-7)

**Step 3.1: Create GenerationQuotaCounter Component**

- Create `src/components/GenerationQuotaCounter.vue`
- Implement Progress component (shadcn-vue)
- Add color-coded status (green/yellow/red)
- Add reset time display (use date-fns for relative time)
- Test with various quota values

**Step 3.2: Create PlanCandidateBanner Component**

- Create `src/components/PlanCandidateBanner.vue`
- Implement Alert component (shadcn-vue)
- Add Save/Discard buttons
- Test conditional rendering

**Step 3.3: Create Activity and Day Components**

- Create `src/components/ActivityCard.vue`
- Implement editable fields for candidate mode
- Add time and category badges
- Create `src/components/PlanDayList.vue`
- Implement Accordion (shadcn-vue) for days
- Test expand/collapse behavior

**Step 3.4: Create PlanViewer Component**

- Create `src/components/PlanViewer.vue`
- Integrate PlanDayList
- Add plan metadata display
- Implement candidate vs. saved styling
- Test with mock plan data

**Step 3.5: Create EmptyPlanState Component**

- Create `src/components/EmptyPlanState.vue`
- Add friendly illustration and message
- Test conditional rendering

**Step 3.6: Create PlanActions Component**

- Create `src/components/PlanActions.vue`
- Implement Generate Plan button with validation
- Implement Save Plan button (candidate only)
- Add loading states
- Add tooltips for disabled states
- Test button states and interactions

**Step 3.7: Create PlanPanel Container**

- Create `src/components/PlanPanel.vue`
- Integrate all plan components
- Implement conditional rendering logic
- Test all plan states (empty, candidate, saved)

---

### Phase 4: Integration and Data Flow (Days 8-9)

**Step 4.1: Integrate Stores with View**

- Connect TripDetailView to all Pinia stores
- Implement data fetching in `onMounted()`
- Add loading states
- Test data flow from stores to components

**Step 4.2: Implement Generate Plan Flow**

- Connect Generate button to `usePlanStore().generatePlan()`
- Implement loading state during generation
- Handle success: store candidate, show banner
- Handle errors: show appropriate messages
- Test with mock AI service

**Step 4.3: Implement Save Plan Flow**

- Connect Save button to `usePlanStore().savePlanToTrip()`
- Implement loading state during save
- Handle success: update trip, clear candidate
- Handle errors: keep candidate, show retry
- Test save and status update

**Step 4.4: Implement Discard Candidate Flow**

- Add confirmation dialog (use shadcn-vue Dialog)
- Connect Discard button to `usePlanStore().discardCandidate()`
- Test candidate removal and UI update

**Step 4.5: Implement Navigation Guards**

- Add `onBeforeRouteLeave` guard
- Show confirmation if unsaved candidate exists
- Test navigation prevention and confirmation

---

### Phase 5: Polish and Testing (Days 10-11)

**Step 5.1: Add Error Handling**

- Implement error toast notifications (use shadcn-vue Toast)
- Add error boundaries for components
- Test all error scenarios (404, 403, 429, 500, 503)
- Verify error messages are user-friendly

**Step 5.2: Implement Responsive Design**

- Test layout on mobile (< 1024px)
- Test layout on desktop (≥ 1024px)
- Verify sticky positioning on desktop
- Test touch interactions on mobile
- Adjust spacing and sizing for mobile

**Step 5.3: Add Accessibility Features**

- Add ARIA labels to all interactive elements
- Test keyboard navigation
- Test screen reader compatibility
- Verify color contrast (WCAG AA)
- Add focus indicators

**Step 5.4: Performance Optimization**

- Implement debounced auto-save for note
- Add loading skeletons for initial data fetch
- Optimize re-renders with computed properties
- Test with large plans (many days/activities)

**Step 5.5: End-to-End Testing**

- Test complete user journey:
  1. Navigate to trip
  2. Edit note and preferences
  3. Generate plan
  4. Edit candidate
  5. Save plan
  6. Verify status update
- Test error recovery flows
- Test navigation with unsaved candidate
- Verify quota tracking accuracy

---

### Phase 6: Documentation and Handoff (Day 12)

**Step 6.1: Code Documentation**

- Add JSDoc comments to all service functions
- Document complex logic (inheritance, status derivation)
- Add inline comments for non-obvious code

**Step 6.2: Component Documentation**

- Document props, events, and slots for each component
- Add usage examples in comments
- Create Storybook stories (optional)

**Step 6.3: Testing Documentation**

- Document test scenarios
- Create manual testing checklist
- Document known issues or limitations

**Step 6.4: Deployment Checklist**

- Verify all environment variables set
- Test with production Supabase instance
- Verify RLS policies are enabled
- Test with real user accounts
- Monitor error logs

---

## Summary

This implementation plan provides a comprehensive guide for building the TripDetailView, the core view of the MyAIGuide application. The plan covers:

✅ **Complete Component Hierarchy:** 18 components with detailed specifications
✅ **State Management:** 4 Pinia stores with clear responsibilities
✅ **API Integration:** 4 service functions with error handling
✅ **User Interactions:** 7 interaction flows with validation
✅ **Error Handling:** 9 error scenarios with recovery strategies
✅ **Implementation Steps:** 12-day phased approach with clear milestones

**Key Technical Decisions:**

- Responsive split-panel layout (mobile-first)
- Plan candidate system (temporary, in-memory)
- Optimistic UI updates with rollback
- Debounced auto-save for better UX
- Comprehensive validation (client and server)
- Inherited preference indicators
- Generation quota visualization

**Next Steps After Implementation:**

1. Implement TripsListView (view all trips)
2. Implement ProfileView (manage preferences)
3. Add plan export functionality (PDF, email)
4. Implement plan sharing features
5. Add analytics and usage tracking

**Estimated Implementation Time:** 12 days for a single developer following this plan.

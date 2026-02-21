# UI Architecture Plan – MyAIGuide MVP

## 1. Executive Summary

MyAIGuide is a Vue 3.5 SPA for AI-powered trip planning. This document defines the complete UI architecture based on product requirements, API design, and accessibility standards (WCAG AA).

### Core Concept

The application follows a simple data model: **1 note = 1 trip = 1 plan**. Each trip contains user notes (1000-10000 characters) and travel preferences, which are used to generate a single AI-powered travel plan stored in JSON format.

### Key Features

- **User Accounts** - Email/password authentication with Supabase Auth
- **Global Profile** - 4 travel characteristics (kids, pets, mobility, dietary) + default preferences
- **Trip Management** - CRUD operations for trip notes with per-trip preference overrides
- **AI Plan Generation** - OpenRouter.ai integration with 10 generations per 24-hour rolling window
- **Plan Candidate System** - Review and edit AI-generated plans before saving (temporary, lost on refresh)
- **Language Detection** - Automatic detection from note content for localized plans
- **Responsive Design** - Mobile-first with split-panel desktop layout (≥1024px)

## 2. Technology Stack

### Frontend Framework

- **Vue 3.5** - Composition API with `<script setup>` syntax
- **TypeScript 5** - Static typing
- **Vite 7** - Build tool and dev server

### UI & Styling

- **shadcn-vue** - Primary component library (accessible, customizable)
- **Tailwind CSS 3** - Utility-first styling with responsive variants
- **Lucide Vue Next** - Icon library

### State & Routing

- **Pinia** - State management (auth, profile, trips, plans)
- **Vue Router** - Client-side routing with navigation guards

### Backend Integration

- **Custom Supabase Client** - `@/db/supabase.client.ts` for all database operations
- **Supabase Auth** - Authentication (JWT implementation in later phase)
- **Supabase Edge Functions** - AI generation, complex business logic

## 3. Application Structure

### 3.1 Route Hierarchy

```
/                    → LandingView (public)
/login               → LoginView (public)
/register            → RegisterView (public)
/dashboard           → DashboardView (protected)
/profile             → ProfileView (protected)
/trips/new           → TripCreateView (protected)
/trips/:id           → TripDetailView (protected)
```

### 3.2 Layout Components

**AuthLayout** - Minimal layout for public pages

- LandingView
- LoginView
- RegisterView

**AppLayout** - Main application shell for protected pages

- Sidebar navigation (shadcn-vue Navigation Menu)
- Main content area
- User menu

### 3.3 View Components

**DashboardView**

- Profile completeness banner (conditional)
- Trip cards grid (responsive: 1/2/3 columns)
- Pagination controls
- "Create New Trip" button

**ProfileView**

- Global profile form (4 boolean toggles)
- Default preference selectors (What/Speed/Type/Budget)
- Completeness indicator
- Save/Cancel actions

**TripDetailView**

- Responsive layout (stacked mobile, split-panel desktop)
- Note editor with character counter
- Trip preferences (inherited values with light blue background)
- Plan viewer/editor
- Generation quota counter
- Generate/Save plan actions

**TripCreateView**

- Trip title input
- Initial note textarea (optional)
- Preference selectors (defaults from profile)
- Create action

## 4. Key UI Components

### 4.1 Sidebar Navigation

**Component:** `Sidebar.vue` using shadcn-vue Navigation Menu

**Structure:**

- Brand/logo header
- Navigation items:
  - Dashboard (Home icon)
  - My Trips (Map icon)
  - Profile (User icon)
- User section with Logout button

**Responsive Behavior:**

- Desktop (≥1024px): Persistent sidebar, 256px width
- Mobile/Tablet (<1024px): Collapsible overlay with hamburger toggle

**Implementation:**

```vue
<aside
  class="fixed inset-y-0 left-0 z-50 w-64 border-r bg-background transition-transform lg:translate-x-0"
  :class="isOpen ? 'translate-x-0' : '-translate-x-full'"
>
  <NavigationMenu orientation="vertical">
    <NavigationMenuItem>
      <NavigationMenuLink
        :to="{ name: 'dashboard' }"
        :aria-current="isActive('dashboard') ? 'page' : undefined"
      >
        <Home class="h-5 w-5" />
        <span>Dashboard</span>
      </NavigationMenuLink>
    </NavigationMenuItem>
  </NavigationMenu>
</aside>
```

**Accessibility:**

- `aria-label="Main navigation"` on nav element
- `aria-current="page"` for active route
- Keyboard navigation (Tab, Enter, Arrow keys)
- Skip to main content link

### 4.2 Profile Completeness Banner

**Location:** Top of DashboardView

**Display Condition:** `profile.is_complete === false`

**Implementation:**

```vue
<Alert v-if="!profile.is_complete && !isDismissed" variant="info">
  <AlertTitle>Complete Your Profile</AlertTitle>
  <AlertDescription>
    Set your travel preferences to get personalized trip plans.
  </AlertDescription>
  <Button @click="navigateToProfile">Complete Profile</Button>
  <Button variant="ghost" @click="dismissBanner">Dismiss</Button>
</Alert>
```

**Features:**

- Info/warning styling
- Clear CTA: "Complete Profile" → navigates to /profile
- Dismissible (stored in localStorage)
- Reappears if profile still incomplete

### 4.3 Trip Card

**Component:** `TripCard.vue` using shadcn-vue Card

**Display:**

- Trip title
- Status badge (CREATED/DRAFT/CONFIRMED)
- Note preview (truncated, 100 chars)
- Last modified timestamp

**Status Badge Logic (derived from trip data):**

- **CREATED** (Gray #6B7280): `note_body` is empty or null, no `plan_json`
- **DRAFT** (Orange #D97706): `note_body` exists but no `plan_json`
- **CONFIRMED** (Green #059669): Both `note_body` and `plan_json` exist

**Implementation:**

```vue
<Card @click="navigateToTrip(trip.id)" class="cursor-pointer transition-shadow hover:shadow-lg">
  <CardHeader class="p-4 md:p-6">
    <div class="flex flex-col sm:flex-row sm:justify-between gap-2">
      <CardTitle class="text-lg md:text-xl">{{ trip.title }}</CardTitle>
      <Badge :variant="getStatusVariant(trip.status)">
        {{ getStatusLabel(trip.status) }}
      </Badge>
    </div>
  </CardHeader>
  <CardContent class="p-4 md:p-6 pt-0">
    <p class="text-sm text-muted-foreground line-clamp-2">
      {{ truncateNote(trip.note_body) }}
    </p>
    <p class="text-xs text-muted-foreground mt-2">
      Updated {{ formatDate(trip.updated_at) }}
    </p>
  </CardContent>
</Card>
```

### 4.4 Note Editor with Character Counter

**Component:** `TripNoteEditor.vue`

**Features:**

- Textarea for note content (min 1000, max 10000 chars)
- Real-time character counter
- Color-coded validation feedback
- Auto-save on blur (debounced)

**Character Counter Colors (WCAG AA):**

- Red (#DC2626): <1000 or >10000 (invalid)
- Yellow (#D97706): 1000-1500 (valid but minimal)
- Green (#059669): 1500-10000 (optimal)

**Implementation:**

```vue
<Textarea
  v-model="noteBody"
  :maxlength="10000"
  placeholder="Describe your trip plans..."
  class="min-h-[300px]"
/>
<p :class="getCounterClass(noteBody.length)">
  {{ noteBody.length }} / 10,000 characters
  <span v-if="noteBody.length < 1000">(minimum 1,000 required)</span>
</p>
```

### 4.5 Trip Preferences Selector

**Component:** `TripPreferences.vue`

**Fields:**

- What? (multi-select): Nature, Culture/Museums, Beach/Relax, City Break, Foodie
- How fast? (single-select): Slow/Chill, Balance, Intensive
- What type? (single-select): Base, Roadtrip
- Budget (single-select): €, €€, €€€

**Inherited Values Indicator:**

- Light blue background (`bg-blue-50`) for values from global profile
- "Reset to profile default" button when overridden
- Tooltip: "From profile" or "Custom value"

**Implementation:**

```vue
<div class="space-y-4">
  <div>
    <Label>What interests you?</Label>
    <MultiSelect
      v-model="preferences.what"
      :options="whatOptions"
      :class="isInherited('what') ? 'bg-blue-50' : ''"
    />
    <Button
      v-if="!isInherited('what')"
      variant="ghost"
      size="sm"
      @click="resetToDefault('what')"
    >
      Reset to profile default
    </Button>
  </div>
</div>
```

### 4.6 Generation Quota Counter

**Component:** Part of `PlanViewer.vue`

**Display:**

- Persistent above "Generate Plan" button
- Format: "X/10 generations used today"
- Progress bar visualization
- Reset time when at limit

**Visual States (WCAG AA):**

- Green: 0-7 generations (plenty remaining)
- Yellow: 8-9 generations (running low)
- Red: 10 generations (limit reached)

**Implementation:**

```vue
<div class="mb-4 p-3 rounded-lg" :class="getQuotaClass(quota.used)">
  <div class="flex justify-between items-center">
    <span class="text-sm font-medium">
      {{ quota.used }}/{{ quota.limit }} generations used today
    </span>
    <span v-if="quota.remaining === 0" class="text-xs">
      Resets {{ formatResetTime(quota.reset_at) }}
    </span>
  </div>
  <Progress :value="(quota.used / quota.limit) * 100" class="mt-2" />
</div>
```

### 4.7 Plan Candidate vs Saved Plan

**Component:** `PlanViewer.vue`

**Candidate Plan (unsaved):**

- Yellow/amber Alert banner: "⚠️ Unsaved Plan - changes will be lost on refresh"
- Prominent "Save Plan" button (primary, large)
- "Discard" button (outline)
- Editable fields (description, location name)

**Saved Plan:**

- Green Alert banner: "✓ Plan saved"
- Timestamp: "Last saved [relative time]"
- "Generate New Plan" button
- Read-only by default, "Edit" button to enable editing

**Implementation:**

```vue
<!-- Candidate -->
<Alert v-if="!planIsSaved" variant="warning" class="mb-4">
  <AlertTriangle class="h-4 w-4" />
  <AlertTitle>Unsaved Plan</AlertTitle>
  <AlertDescription>
    Changes will be lost if you refresh or navigate away.
  </AlertDescription>
</Alert>
<div class="mb-4 flex gap-2">
  <Button @click="savePlan" size="lg" class="flex-1">Save Plan</Button>
  <Button @click="discardPlan" variant="outline">Discard</Button>
</div>

<!-- Saved -->
<Alert v-else variant="success" class="mb-4">
  <CheckCircle class="h-4 w-4" />
  <AlertTitle>Plan Saved</AlertTitle>
  <AlertDescription>
    Last saved {{ formatRelativeTime(trip.updated_at) }}
  </AlertDescription>
</Alert>
```

### 4.8 Plan Day List

**Component:** `PlanDayList.vue` using shadcn-vue Accordion

**Structure:**

- Accordion for each day
- Day header: "Day 1", "Day 2", etc.
- Activities grouped by time: Morning / Afternoon / Evening
- Each activity shows:
  - Time of day badge
  - Location name (editable in candidate mode)
  - Description (editable in candidate mode)
  - Category tag badge (color-coded)

**Implementation:**

```vue
<Accordion type="multiple" class="space-y-4">
  <AccordionItem v-for="day in plan.days" :key="day.day">
    <AccordionTrigger>
      <h3 class="text-lg font-semibold">Day {{ day.day }}</h3>
    </AccordionTrigger>
    <AccordionContent>
      <div class="space-y-4">
        <div
          v-for="activity in day.activities"
          :key="activity.timeOfDay"
          class="border-l-4 pl-4"
        >
          <Badge variant="outline">{{ activity.timeOfDay }}</Badge>
          <h4 class="font-medium">{{ activity.locationName }}</h4>
          <p class="text-sm text-muted-foreground">
            {{ activity.description }}
          </p>
          <Badge :variant="getCategoryVariant(activity.categoryTag)">
            {{ formatCategoryTag(activity.categoryTag) }}
          </Badge>
        </div>
      </div>
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

## 5. State Management (Pinia)

### 5.1 AuthStore

**File:** `stores/auth.store.ts`

**State:**

- `user: User | null`
- `session: Session | null`
- `isAuthenticated: computed(() => !!user.value)`

**Actions:**

```typescript
async function login(email: string, password: string) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  })
  if (error) throw error
  user.value = data.user
  session.value = data.session
}

async function register(email: string, password: string) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password
  })
  if (error) throw error
  user.value = data.user
  session.value = data.session
}

async function logout() {
  await supabaseClient.auth.signOut()
  user.value = null
  session.value = null
}

async function initialize() {
  const { data } = await supabaseClient.auth.getSession()
  if (data.session) {
    user.value = data.session.user
    session.value = data.session
  }
}
```

### 5.2 ProfileStore

**File:** `stores/profile.store.ts`

**State:**

- `profile: Profile | null`
- `isComplete: computed(() => profile.value?.is_complete ?? false)`

**Actions:**

```typescript
async function fetchProfile() {
  const { data, error } = await supabaseClient.from('profiles').select('*').single()

  if (error) throw error
  profile.value = data
}

async function updateProfile(updates: Partial<Profile>) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .update(updates)
    .eq('user_id', (await supabaseClient.auth.getUser()).data.user?.id)
    .select()
    .single()

  if (error) throw error
  profile.value = data
}
```

### 5.3 TripStore

**File:** `stores/trip.store.ts`

**State:**

- `trips: Trip[]`
- `currentTrip: Trip | null`
- `pagination: Pagination`

**Actions:**

```typescript
async function fetchTrips(page = 1, limit = 20) {
  const from = (page - 1) * limit
  const to = from + limit - 1

  const { data, error, count } = await supabaseClient
    .from('trips')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(from, to)

  if (error) throw error
  trips.value = data || []
  pagination.value = {
    current_page: page,
    total_pages: Math.ceil((count || 0) / limit),
    total_count: count || 0,
    limit
  }
}

async function createTrip(tripData: CreateTripDto) {
  const { data, error } = await supabaseClient.from('trips').insert(tripData).select().single()

  if (error) throw error
  return data
}

async function updateTrip(id: number, updates: Partial<Trip>) {
  const { data, error } = await supabaseClient
    .from('trips')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  currentTrip.value = data
}
```

### 5.4 PlanStore

**File:** `stores/plan.store.ts`

**State:**

- `candidate: PlanCandidate | null`
- `quota: GenerationQuota | null`
- `isGenerating: boolean`
- `hasUnsavedCandidate: computed(() => !!candidate.value && !candidate.value.isSaved)`

**Actions:**

```typescript
async function generatePlan(tripId: number) {
  isGenerating.value = true
  try {
    const { data, error } = await supabaseClient.functions.invoke('generate-plan', {
      body: { tripId }
    })

    if (error) throw error

    candidate.value = {
      ...data,
      isSaved: false,
      tripId
    }

    await fetchQuota()
    return data
  } finally {
    isGenerating.value = false
  }
}

async function savePlan(tripId: number) {
  if (!candidate.value) throw new Error('No candidate plan to save')

  const { data, error } = await supabaseClient
    .from('trips')
    .update({
      plan_json: candidate.value.plan,
      plan_language: candidate.value.language
    })
    .eq('id', tripId)
    .select()
    .single()

  if (error) throw error
  candidate.value = { ...candidate.value, isSaved: true }
  return data
}
```

## 6. Routing and Navigation

### 6.1 Router Configuration

**File:** `router/index.ts`

```typescript
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const routes = [
  {
    path: '/',
    name: 'landing',
    component: () => import('@/views/LandingView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/ProfileView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/trips/new',
    name: 'trip-create',
    component: () => import('@/views/TripCreateView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/trips/:id',
    name: 'trip-detail',
    component: () => import('@/views/TripDetailView.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  if (!authStore.user) {
    await authStore.initialize()
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } })
  } else {
    next()
  }
})

export default router
```

### 6.2 Navigation Guards for Unsaved Changes

**Implementation in TripDetailView.vue:**

```typescript
import { onBeforeRouteLeave } from 'vue-router'

const planStore = usePlanStore()

onBeforeRouteLeave((to, from, next) => {
  if (planStore.hasUnsavedCandidate) {
    const confirmed = window.confirm(
      'You have an unsaved plan. Your changes will be lost. Leave anyway?'
    )
    if (confirmed) {
      planStore.clearCandidate()
      next()
    } else {
      next(false)
    }
  } else {
    next()
  }
})
```

## 7. Responsive Design with Tailwind

### 7.1 Breakpoints

- **sm:** 640px - Small tablets
- **md:** 768px - Tablets
- **lg:** 1024px - Desktops (split-panel threshold)
- **xl:** 1280px - Large desktops
- **2xl:** 1536px - Extra large screens

### 7.2 Mobile-First Responsive Patterns

**Dashboard Grid:**

```vue
<div class="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:gap-6 md:p-6 lg:grid-cols-3">
  <TripCard v-for="trip in trips" :key="trip.id" :trip="trip" />
</div>
```

**Trip Detail Split Panel:**

```vue
<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
  <div class="order-1"><!-- Note Editor --></div>
  <div class="order-2 lg:sticky lg:top-4"><!-- Plan Viewer --></div>
</div>
```

**Responsive Typography:**

```vue
<h1 class="text-2xl md:text-3xl lg:text-4xl font-bold">
<p class="text-sm md:text-base">
```

**Responsive Spacing:**

```vue
<div class="p-4 md:p-6 lg:p-8">
<div class="space-y-4 md:space-y-6">
<div class="gap-2 sm:gap-4 md:gap-6">
```

**Responsive Flexbox:**

```vue
<div class="flex flex-col md:flex-row gap-4">
<div class="flex flex-col sm:flex-row sm:justify-between">
```

**Responsive Visibility:**

```vue
<Button class="lg:hidden"><!-- Mobile only --></Button>
<nav class="hidden lg:block"><!-- Desktop only --></nav>
```

## 8. Accessibility (WCAG AA)

### 8.1 Color Contrast Requirements

**Text Contrast:**

- Normal text: Minimum 4.5:1 contrast ratio
- Large text (18pt+): Minimum 3:1 contrast ratio

**Component Colors (WCAG AA compliant):**

- Status badges:
  - CREATED: `#6B7280` (gray) on white background
  - DRAFT: `#D97706` (orange) on white background
  - CONFIRMED: `#059669` (green) on white background
- Character counter:
  - Invalid: `#DC2626` (red)
  - Warning: `#D97706` (orange)
  - Valid: `#059669` (green)
- Inherited preferences: `#EFF6FF` (light blue) with `#1E293B` (dark text)
- Focus indicators: 2px outline with 3:1 contrast ratio

### 8.2 ARIA Labels and Semantic HTML

**Navigation:**

```vue
<nav aria-label="Main navigation">
  <NavigationMenuItem>
    <NavigationMenuLink
      :aria-current="isActive ? 'page' : undefined"
    >
      Dashboard
    </NavigationMenuLink>
  </NavigationMenuItem>
</nav>
```

**Forms:**

```vue
<Label for="trip-title">Trip Title</Label>
<Input id="trip-title" v-model="title" />

<!-- Or with aria-labelledby -->
<div id="budget-label">Budget</div>
<Select aria-labelledby="budget-label" v-model="budget" />
```

**Buttons:**

```vue
<Button aria-label="Toggle navigation menu">
  <Menu class="h-6 w-6" />
</Button>
```

**Alerts and Live Regions:**

```vue
<Alert role="alert">
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>Failed to save trip</AlertDescription>
</Alert>

<div aria-live="polite" aria-atomic="true">
  {{ quota.used }}/{{ quota.limit }} generations used
</div>
```

**Modals:**

```vue
<Dialog aria-modal="true">
  <DialogContent>
    <DialogTitle>Confirm Deletion</DialogTitle>
    <DialogDescription>This action cannot be undone.</DialogDescription>
  </DialogContent>
</Dialog>
```

### 8.3 Keyboard Navigation

**Requirements:**

- All interactive elements accessible via Tab key
- Modal dialogs trap focus within
- Dialogs close on Escape key
- Dropdown menus navigable with arrow keys
- Form submission on Enter key
- Skip to main content link at page top

**Focus Management:**

```vue
<!-- Visible focus indicators -->
<Button class="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">

<!-- Focus trap in modals -->
<Dialog @update:open="handleDialogOpen">
  <!-- Focus automatically managed by shadcn-vue Dialog -->
</Dialog>
```

### 8.4 Screen Reader Support

**Semantic HTML:**

```vue
<template>
  <div>
    <header><!-- App header --></header>
    <nav><!-- Sidebar navigation --></nav>
    <main>
      <article><!-- Trip detail --></article>
      <section><!-- Plan section --></section>
    </main>
  </div>
</template>
```

**Alt Text:**

```vue
<img :src="iconUrl" :alt="trip.title + ' icon'" />
<Icon aria-hidden="true" />
<!-- Decorative icons -->
```

**Announcements:**

```vue
<!-- Toast notifications with aria-live -->
<Toast aria-live="assertive" aria-atomic="true">
  Plan generated successfully
</Toast>
```

### 8.5 Additional Accessibility Features

- Minimum font size: 16px for body text
- Line height: 1.5 for body text
- Text resizable up to 200% without loss of functionality
- Clear error messages with correction suggestions
- Consistent navigation structure across all pages

## 9. Error Handling and Notifications

### 9.1 Toast Notification System

**Component:** shadcn-vue Toast

**Error Types:**

**1. Validation Errors (400):**

```typescript
toast({
  variant: 'destructive',
  title: 'Validation Error',
  description: 'Note must be between 1000 and 10000 characters',
  duration: 5000
})
```

**2. AI Generation Errors (500):**

```typescript
toast({
  variant: 'destructive',
  title: 'Generation Failed',
  description: 'Failed to generate plan. Please try again.',
  action: h(Button, { onClick: () => retryGeneration() }, 'Retry')
})
```

**3. Quota Exceeded (429):**

```typescript
toast({
  variant: 'warning',
  title: 'Generation Limit Reached',
  description: `You've used all 10 generations. Resets ${formatResetTime(resetAt)}`,
  duration: 10000
})
```

**4. Network Errors:**

```typescript
toast({
  variant: 'destructive',
  title: 'Connection Error',
  description: 'Check your internet connection.',
  action: h(Button, { onClick: () => retryRequest() }, 'Retry')
})
```

### 9.2 Optimistic Updates

**Pattern:**

```typescript
async function updateTripTitle(tripId: number, newTitle: string) {
  const tripStore = useTripStore()
  const originalTitle = tripStore.currentTrip?.title

  // Optimistic update
  if (tripStore.currentTrip) {
    tripStore.currentTrip.title = newTitle
  }

  try {
    await tripStore.updateTrip(tripId, { title: newTitle })
    toast({ title: 'Trip updated', variant: 'success' })
  } catch (error) {
    // Revert on error
    if (tripStore.currentTrip && originalTitle) {
      tripStore.currentTrip.title = originalTitle
    }
    toast({
      title: 'Update failed',
      description: 'Could not update trip title',
      variant: 'destructive'
    })
  }
}
```

## 10. Performance Optimization

### 10.1 Code Splitting

**Route-based lazy loading:**

```typescript
const routes = [
  {
    path: '/dashboard',
    component: () => import('@/views/DashboardView.vue')
  }
]
```

**Component-level splitting:**

```typescript
const PlanEditor = defineAsyncComponent(() => import('@/components/PlanEditor.vue'))
```

### 10.2 Data Fetching Strategy

**On App Mount:**

- Initialize auth state
- Fetch user profile
- Fetch generation quota

**On Dashboard Mount:**

- Fetch trips (paginated, 20 per page)

**On Trip Detail Mount:**

- Fetch specific trip data
- Load saved plan if exists

### 10.3 Caching Strategy

**Pinia State:**

- Profile data (refresh on update)
- Trip list (invalidate on CRUD operations)
- Generation quota (refresh after generation)
- Plan candidate (temporary, cleared on navigation)

**localStorage:**

- Banner dismissal state
- User preferences (theme, language - future)

## 11. User Journey Maps

### 11.1 New User Onboarding

1. **Landing Page** → Click "Get Started"
2. **Register** → Enter email/password → Submit
3. **Dashboard** (empty state) → See profile completeness banner
4. **Profile** → Fill in preferences → Save
5. **Dashboard** → Click "Create New Trip"
6. **Trip Create** → Enter title → Save
7. **Trip Detail** → Write note (1000+ chars) → Set preferences
8. **Generate Plan** → Review candidate → Save plan
9. **Dashboard** → See trip with "Planned" status

### 11.2 Returning User - Creating New Trip

1. **Login** → Enter credentials
2. **Dashboard** → See existing trips
3. **Create New Trip** → Enter title and note
4. **Trip Detail** → Adjust preferences → Generate plan
5. **Review Plan** → Edit if needed → Save
6. **Dashboard** → Trip appears with "Planned" status

### 11.3 Editing Existing Trip

1. **Dashboard** → Click trip card
2. **Trip Detail** → Edit note or preferences
3. **Generate New Plan** → Review candidate
4. **Save Plan** → Overwrites previous plan
5. **Dashboard** → Updated timestamp visible

## 12. shadcn-vue Component Usage

### 12.1 Core Components

- **Navigation Menu** - Sidebar navigation
- **Button** - All actions (primary, secondary, ghost, outline variants)
- **Card** - Trip cards, content containers
- **Alert** - Banners, notifications, warnings
- **Badge** - Status indicators, category tags
- **Dialog / AlertDialog** - Confirmations, modals
- **Toast** - Notifications, errors, success messages
- **Accordion** - Plan day expansion
- **Select** - Dropdown selectors
- **Textarea** - Note editor
- **Progress** - Quota visualization
- **Separator** - Visual dividers
- **Skeleton** - Loading states

### 12.2 Form Components

- **Label** - Form field labels
- **Input** - Text inputs
- **Checkbox** - Boolean preferences
- **RadioGroup** - Single-choice preferences
- **Form** - Form validation wrapper (with Zod schemas)

## 13. Authentication Flow

### 13.1 Current Implementation

**Supabase Auth with Session Management:**

- Email/password registration and login
- Session tokens managed by Supabase client
- Automatic token refresh
- Session persistence in browser storage

**Router Guards:**

```typescript
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  if (!authStore.user) {
    await authStore.initialize()
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } })
  } else {
    next()
  }
})
```

### 13.2 Future JWT Implementation

**Planned for later phase:**

- Session tokens in HTTP-only cookies
- JWT in `Authorization: Bearer <token>` header for API requests
- Custom middleware for additional security checks
- Token refresh logic handled by Supabase client

## 14. Implementation Checklist

### Phase 1: Foundation

- [ ] Set up Vue 3 + Vite + TypeScript project
- [ ] Install and configure shadcn-vue
- [ ] Configure Tailwind CSS with custom theme
- [ ] Set up Vue Router with route guards
- [ ] Set up Pinia stores (Auth, Profile, Trip, Plan)
- [ ] Configure custom Supabase client

### Phase 2: Layouts and Navigation

- [ ] Create AuthLayout component
- [ ] Create AppLayout component
- [ ] Implement Sidebar with Navigation Menu
- [ ] Add responsive sidebar toggle for mobile
- [ ] Implement skip to main content link

### Phase 3: Authentication Views

- [ ] Build LandingView
- [ ] Build LoginView with form validation
- [ ] Build RegisterView with form validation
- [ ] Implement auth state management
- [ ] Add error handling for auth operations

### Phase 4: Dashboard

- [ ] Build DashboardView
- [ ] Implement ProfileCompletenessBanner
- [ ] Create TripCard component with status badges
- [ ] Add pagination controls
- [ ] Implement trip list fetching and display

### Phase 5: Profile Management

- [ ] Build ProfileView
- [ ] Create ProfileForm with boolean toggles
- [ ] Implement PreferenceSelector components
- [ ] Add profile completeness logic
- [ ] Implement profile update with optimistic UI

### Phase 6: Trip Management

- [ ] Build TripCreateView
- [ ] Build TripDetailView with responsive layout
- [ ] Create TripNoteEditor with character counter
- [ ] Implement TripPreferences with inherited value indicators
- [ ] Add trip CRUD operations

### Phase 7: Plan Generation

- [ ] Create PlanViewer component
- [ ] Implement GenerationQuotaCounter
- [ ] Add plan generation logic with loading states
- [ ] Create PlanDayList with Accordion
- [ ] Implement plan candidate vs saved plan distinction
- [ ] Add navigation guards for unsaved changes

### Phase 8: Error Handling and Polish

- [ ] Implement toast notification system
- [ ] Add error handling for all API calls
- [ ] Implement optimistic updates
- [ ] Add loading skeletons
- [ ] Test all user journeys

### Phase 9: Accessibility Audit

- [ ] Verify WCAG AA color contrast
- [ ] Test keyboard navigation
- [ ] Add ARIA labels where needed
- [ ] Test with screen readers
- [ ] Verify focus management

### Phase 10: Performance Optimization

- [ ] Implement code splitting
- [ ] Optimize bundle size
- [ ] Add caching strategies
- [ ] Test on various devices and browsers

## 15. Summary

This UI architecture provides a complete, production-ready foundation for MyAIGuide MVP with:

✅ **Modern Tech Stack** - Vue 3.5, TypeScript, Vite, shadcn-vue, Tailwind CSS
✅ **Accessible Design** - WCAG AA compliant with proper contrast, ARIA, keyboard navigation
✅ **Responsive Layout** - Mobile-first with Tailwind responsive variants
✅ **Sidebar Navigation** - shadcn-vue Navigation Menu component
✅ **State Management** - Pinia stores for auth, profile, trips, and plans
✅ **Custom Supabase Integration** - Using `@/db/supabase.client.ts`
✅ **Error Handling** - Toast notifications with retry mechanisms
✅ **Optimistic Updates** - Better perceived performance
✅ **Navigation Guards** - Prevent data loss from unsaved changes
✅ **Performance Optimized** - Code splitting, caching, lazy loading

The architecture is designed to scale with future enhancements while maintaining clean, maintainable code aligned with Vue 3 best practices and MyAIGuide product requirements.

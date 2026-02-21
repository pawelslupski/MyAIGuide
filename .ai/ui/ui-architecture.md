# UI Architecture – MyAIGuide

## 1. Overview

This document defines the user interface architecture for MyAIGuide MVP, a Vue 3 SPA for AI-powered trip planning. The architecture is designed to support the product requirements, integrate seamlessly with the REST API, and provide an intuitive, accessible user experience.

## 2. Technology Stack

### Frontend Framework

- **Vue 3.5** with Composition API and `<script setup>` syntax
- **TypeScript 5** for type safety
- **Vite 7** for fast development and optimized builds

### Routing & State Management

- **Vue Router** for client-side navigation with route guards
- **Pinia** for global state management (user profile, plan candidates, generation quota)

### UI Components & Styling

- **shadcn-vue** for accessible, pre-built components
- **Tailwind CSS 3** for utility-first styling with dark mode support
- **Dark Mode** - Full theme switching with localStorage persistence
- Custom components built on shadcn-vue primitives

### API Integration

- **Custom Supabase Client** (`@/src/db/supabase.client.ts`) for all database operations
- **Supabase Edge Functions** for AI generation and complex business logic
- **JWT Authentication** - to be implemented in later phase

## 3. Application Structure

### 3.1 Route Hierarchy

```
/                           → Landing/Login page (public)
/register                   → Registration page (public)
/login                      → Login page (public)
/dashboard                  → Trip list dashboard (protected)
/profile                    → User profile settings (protected)
/trips/:tripId              → Trip detail view (protected)
/trips/new                  → Create new trip (protected)
```

### 3.2 View Components

#### Public Views

- **LandingView.vue** - Marketing page with login/register CTAs
- **LoginView.vue** - Email/password login form
- **RegisterView.vue** - Email/password registration form

#### Protected Views

- **DashboardView.vue** - Trip list with profile completeness banner
- **ProfileView.vue** - Global profile and default preferences editor
- **TripDetailView.vue** - Split/stacked layout for note and plan panels
- **TripCreateView.vue** - New trip creation form

### 3.3 Layout Components

- **AppLayout.vue** - Main application shell with sidebar navigation (shadcn-vue Navigation Menu) and user menu
- **AuthLayout.vue** - Minimal layout for login/register pages
- **Sidebar.vue** - Navigation sidebar using shadcn-vue Navigation Menu component
- **TripLayout.vue** - Specialized layout for trip detail view with panels
- **ThemeToggle.vue** - Dark/light mode toggle button component

## 4. Key UI Patterns and Components

### 4.1 Sidebar Navigation (shadcn-vue Navigation Menu)

**Location:** Sidebar.vue component, used in AppLayout.vue

**Structure:**

- Persistent sidebar on desktop (≥1024px)
- Collapsible overlay sidebar on mobile/tablet (<1024px)
- Navigation items with icons and labels
- Active state indication with `aria-current="page"`
- User profile section at bottom

**Navigation Items:**

- Dashboard (Home icon)
- My Trips (Map icon)
- Profile (User icon)
- Logout (LogOut icon)

**Implementation:**

```vue
<template>
  <aside
    class="fixed inset-y-0 left-0 z-50 w-64 border-r bg-background transition-transform lg:translate-x-0"
    :class="isOpen ? 'translate-x-0' : '-translate-x-full'"
  >
    <div class="flex h-full flex-col">
      <!-- Logo/Brand -->
      <div class="border-b p-6">
        <h1 class="text-xl font-bold">MyAIGuide</h1>
      </div>

      <!-- Navigation Menu -->
      <NavigationMenu class="flex-1 p-4" orientation="vertical">
        <NavigationMenuList class="flex-col space-y-2">
          <NavigationMenuItem>
            <NavigationMenuLink
              :to="{ name: 'dashboard' }"
              :aria-current="isActive('dashboard') ? 'page' : undefined"
              class="flex items-center gap-3 rounded-md px-4 py-2 hover:bg-accent"
              :class="isActive('dashboard') ? 'bg-accent' : ''"
            >
              <Home class="h-5 w-5" />
              <span>Dashboard</span>
            </NavigationMenuLink>
          </NavigationMenuItem>

          <NavigationMenuItem>
            <NavigationMenuLink
              :to="{ name: 'trips' }"
              :aria-current="isActive('trips') ? 'page' : undefined"
              class="flex items-center gap-3 rounded-md px-4 py-2 hover:bg-accent"
            >
              <Map class="h-5 w-5" />
              <span>My Trips</span>
            </NavigationMenuLink>
          </NavigationMenuItem>

          <NavigationMenuItem>
            <NavigationMenuLink
              :to="{ name: 'profile' }"
              :aria-current="isActive('profile') ? 'page' : undefined"
              class="flex items-center gap-3 rounded-md px-4 py-2 hover:bg-accent"
            >
              <User class="h-5 w-5" />
              <span>Profile</span>
            </NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>

      <!-- User Section -->
      <div class="border-t p-4">
        <Button variant="ghost" class="w-full justify-start gap-3" @click="handleLogout">
          <LogOut class="h-5 w-5" />
          <span>Logout</span>
        </Button>
      </div>
    </div>
  </aside>

  <!-- Mobile overlay -->
  <div v-if="isOpen" class="fixed inset-0 z-40 bg-black/50 lg:hidden" @click="closeSidebar" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { Home, Map, User, LogOut } from 'lucide-vue-next'
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink
} from '@/components/ui/navigation-menu'
import { Button } from '@/components/ui/button'

const route = useRoute()
const isOpen = ref(false)

const isActive = (name: string) => route.name === name
const closeSidebar = () => {
  isOpen.value = false
}
const handleLogout = async () => {
  // Logout logic using custom Supabase client
}
</script>
```

**Responsive Behavior:**

```vue
<!-- Mobile: Hamburger toggle button in header -->
<Button
  variant="ghost"
  size="icon"
  class="lg:hidden"
  @click="toggleSidebar"
  aria-label="Toggle navigation menu"
>
  <Menu class="h-6 w-6" />
</Button>

<!-- Desktop: Always visible, no toggle needed -->
<div class="hidden lg:block">
  <Sidebar />
</div>
```

**Tailwind Responsive Variants Usage:**

- `lg:translate-x-0` - Show sidebar on desktop
- `lg:hidden` - Hide mobile toggle on desktop
- `sm:w-64 md:w-72 lg:w-64` - Responsive sidebar width
- `hidden lg:block` - Show/hide based on breakpoint

### 4.2 Dark Mode Theme Switching

**Location:** ThemeToggle.vue component, typically placed in header/sidebar

**Features:**

- Toggle between light and dark themes
- Persists user preference in localStorage (key: `myaiguide-theme`)
- Supports system preference detection
- Smooth transitions between themes
- Accessible with proper ARIA labels
- Icons change based on current theme (Sun for dark mode, Moon for light mode)

**Implementation:**

```vue
<!-- ThemeToggle.vue -->
<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/composables/useTheme'

const { resolvedTheme, toggleTheme } = useTheme()
</script>

<template>
  <Button
    variant="ghost"
    size="icon"
    @click="toggleTheme"
    :aria-label="resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
    title="Toggle theme"
  >
    <Sun v-if="resolvedTheme === 'dark'" class="h-5 w-5 transition-all" />
    <Moon v-else class="h-5 w-5 transition-all" />
  </Button>
</template>
```

**Composable API (useTheme):**

```typescript
// src/composables/useTheme.ts
import { useTheme } from '@/composables/useTheme'

const {
  themeMode, // 'light' | 'dark' | 'system'
  resolvedTheme, // 'light' | 'dark' (actual applied theme)
  setTheme, // (mode: ThemeMode) => void
  toggleTheme, // () => void (toggles between light/dark)
  initTheme // () => void (initialize on app mount)
} = useTheme()
```

**Usage in App.vue:**

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useTheme } from '@/composables/useTheme'

const { initTheme } = useTheme()

onMounted(() => {
  initTheme() // Initialize theme from localStorage or system preference
})
</script>
```

**Theme Configuration:**

All theme colors are defined in `src/style.css` using CSS variables:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 14.902%;
    --primary: 37.6923 92.126% 50.1961%;
    /* ... more light theme variables */
  }

  .dark {
    --background: 0 0% 9.0196%;
    --foreground: 0 0% 89.8039%;
    --primary: 167.8846 86.6667% 47.0588%;
    /* ... more dark theme variables */
  }
}
```

**Tailwind Dark Mode Variants:**

Use the `dark:` variant for dark mode specific styles:

```vue
<div class="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
  <h1 class="text-primary dark:text-primary">Title</h1>
  <Button class="bg-secondary hover:bg-secondary/80 dark:bg-secondary dark:hover:bg-secondary/80">
    Click me
  </Button>
</div>
```

**Best Practices:**

- Always use CSS variables for colors (e.g., `bg-background`, `text-foreground`)
- Avoid hardcoded color values (e.g., `bg-white`, `text-black`)
- Test all components in both light and dark modes
- Ensure sufficient contrast in both themes (WCAG AA: 4.5:1 for text)
- Use `dark:` variants sparingly - CSS variables handle most cases automatically

### 4.3 Profile Completeness Banner

**Location:** DashboardView.vue (top of page)

**Behavior:**

- Display when `profile.is_complete === false`
- Prominent banner with warning/info styling
- Clear message: "Complete your profile to get better trip recommendations"
- CTA button: "Complete Profile" → navigates to /profile
- Dismissible (stores dismissal in localStorage, shows again if profile still incomplete)

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

### 4.4 Trip List Dashboard

**Location:** DashboardView.vue

**Features:**

- Grid/list of trip cards sorted by `updated_at` DESC
- Each card displays:
  - Trip title
  - Status badge (CREATED/DRAFT/CONFIRMED)
  - Last modified date
  - Truncated note preview (first 100 chars)
- Status badge styling:
  - CREATED: gray badge, "New"
  - DRAFT: yellow/orange badge, "Draft"
  - CONFIRMED: green badge, "Planned"
- "Create New Trip" button (prominent, top-right)
- Pagination controls (20 trips per page)

**Card Component with Responsive Variants:**

```vue
<Card @click="navigateToTrip(trip.id)" class="cursor-pointer transition-shadow hover:shadow-lg">
  <CardHeader class="p-4 md:p-6">
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
      <CardTitle class="text-lg md:text-xl">{{ trip.title }}</CardTitle>
      <Badge
        :variant="getStatusVariant(trip.status)"
        class="self-start sm:self-auto"
      >
        {{ getStatusLabel(trip.status) }}
      </Badge>
    </div>
  </CardHeader>
  <CardContent class="p-4 md:p-6 pt-0">
    <p class="text-sm md:text-base text-muted-foreground line-clamp-2 md:line-clamp-3">
      {{ truncateNote(trip.note_body) }}
    </p>
    <p class="text-xs md:text-sm text-muted-foreground mt-2 md:mt-3">
      Updated {{ formatDate(trip.updated_at) }}
    </p>
  </CardContent>
</Card>
```

**Responsive Variants Used:**

- `p-4 md:p-6` - Responsive padding
- `flex-col sm:flex-row` - Stack on mobile, row on tablet+
- `text-lg md:text-xl` - Responsive font sizes
- `line-clamp-2 md:line-clamp-3` - More lines visible on larger screens

### 4.5 Trip Detail View - Layout

**Location:** TripDetailView.vue

**Responsive Layout:**

- **Desktop (≥1024px):** Split-panel layout (50/50)
  - Left panel: Note editor with preferences
  - Right panel: Plan viewer/editor
- **Tablet/Mobile (<1024px):** Stacked layout
  - Note section on top
  - Plan section below

**Implementation with Tailwind Responsive Variants:**

```vue
<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
  <!-- Note Panel -->
  <div class="space-y-4 order-1 lg:order-1">
    <Card class="p-4 md:p-6">
      <TripNoteEditor />
    </Card>
    <Card class="p-4 md:p-6">
      <TripPreferences />
    </Card>
  </div>

  <!-- Plan Panel -->
  <div class="space-y-4 order-2 lg:order-2">
    <Card class="p-4 md:p-6 lg:sticky lg:top-4">
      <PlanViewer />
    </Card>
  </div>
</div>
```

**Responsive Variants Used:**

- `grid-cols-1 lg:grid-cols-2` - Single column on mobile, two columns on desktop
- `gap-4 md:gap-6` - Smaller gap on mobile, larger on tablet+
- `p-4 md:p-6` - Responsive padding
- `lg:sticky lg:top-4` - Sticky plan panel on desktop only

- "Reset to profile defaults" button for each field
- Inline editing with immediate visual feedback

**Implementation:**

```vue
<div class="space-y-4">
  <!-- What (multi-select) -->
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

  <!-- Speed (single-select) -->
  <div>
    <Label>Travel pace?</Label>
    <Select
      v-model="preferences.speed"
      :options="speedOptions"
      :class="isInherited('speed') ? 'bg-blue-50' : ''"
    />
  </div>

  <!-- Type (single-select) -->
  <div>
    <Label>Trip type?</Label>
    <Select
      v-model="preferences.type"
      :options="typeOptions"
      :class="isInherited('type') ? 'bg-blue-50' : ''"
    />
  </div>

  <!-- Budget (single-select) -->
  <div>
    <Label>Budget level?</Label>
    <Select
      v-model="preferences.budget"
      :options="budgetOptions"
      :class="isInherited('budget') ? 'bg-blue-50' : ''"
    />
  </div>
</div>
```

### 4.7 Generation Quota Counter

**Location:** PlanViewer.vue component (above "Generate Plan" button)

**Features:**

- Persistent display: "X/10 generations used today"
- Real-time updates after each generation
- Visual states:
  - Green: 0-7 generations (plenty remaining)
  - Yellow: 8-9 generations (running low)
  - Red: 10 generations (limit reached)
- Shows reset time when at limit: "Resets at HH:MM"
- Fetched from `GET /api/users/me/generation-quota`

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

**Location:** PlanViewer.vue component

**Candidate Plan (unsaved):**

- Yellow/amber banner at top: "⚠️ Unsaved Plan - changes will be lost on refresh"
- Prominent "Save Plan" button (primary variant, large)
- "Discard" button (secondary variant)
- Editable fields (description, location name)

**Saved Plan:**

- Green checkmark banner: "✓ Plan saved"
- Timestamp: "Last saved: [relative time]"
- "Generate New Plan" button (replaces "Save Plan")
- Read-only by default, "Edit" button to enable editing

**Implementation:**

```vue
<!-- Candidate Plan -->
<Alert v-if="!planIsSaved" variant="warning" class="mb-4">
  <AlertTriangle class="h-4 w-4" />
  <AlertTitle>Unsaved Plan</AlertTitle>
  <AlertDescription>
    Changes will be lost if you refresh or navigate away.
  </AlertDescription>
</Alert>
<div class="mb-4 flex gap-2">
  <Button @click="savePlan" size="lg" class="flex-1">
    Save Plan
  </Button>
  <Button @click="discardPlan" variant="outline">
    Discard
  </Button>
</div>

<!-- Saved Plan -->
<Alert v-else variant="success" class="mb-4">
  <CheckCircle class="h-4 w-4" />
  <AlertTitle>Plan Saved</AlertTitle>
  <AlertDescription>
    Last saved {{ formatRelativeTime(trip.updated_at) }}
  </AlertDescription>
</Alert>
```

### 4.8 Plan Structure Display

**Location:** PlanDayList.vue component

**Structure:**

- Accordion or card-based layout for each day
- Day header: "Day 1", "Day 2", etc.
- Activities grouped by time of day: Morning / Afternoon / Evening
- Each activity shows:
  - Time of day badge
  - Location name (editable in candidate mode)
  - Description (editable in candidate mode)
  - Category tag badge (color-coded)

**Implementation:**

```vue
<Accordion type="multiple" class="space-y-4">
  <AccordionItem v-for="day in plan.days" :key="day.day" :value="`day-${day.day}`">
    <AccordionTrigger>
      <h3 class="text-lg font-semibold">Day {{ day.day }}</h3>
    </AccordionTrigger>
    <AccordionContent>
      <div class="space-y-4">
        <div v-for="activity in day.activities" :key="activity.timeOfDay" class="border-l-4 pl-4" :class="getTimeOfDayColor(activity.timeOfDay)">
          <Badge variant="outline" class="mb-2">{{ activity.timeOfDay }}</Badge>
          <h4 class="font-medium">{{ activity.locationName }}</h4>
          <p class="text-sm text-muted-foreground mt-1">{{ activity.description }}</p>
          <Badge :variant="getCategoryVariant(activity.categoryTag)" class="mt-2">
            {{ formatCategoryTag(activity.categoryTag) }}
          </Badge>
        </div>
      </div>
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

### 4.9 Error Handling and Notifications

**Location:** Global toast notification system (using shadcn-vue Toast)

**Error Types:**

1. **Validation Errors (400)**
   - Toast with error icon, red variant
   - Display field-specific errors
   - Auto-dismiss after 5 seconds

2. **AI Generation Errors (500)**
   - Toast with error icon, red variant
   - Message: "Failed to generate plan. Please try again."
   - "Retry" button embedded in toast
   - Manual dismiss only

3. **Quota Exceeded (429)**
   - Toast with warning icon, yellow variant
   - Message: "Generation limit reached (10/10)"
   - Shows reset time
   - No retry button (disabled state)
   - Auto-dismiss after 10 seconds

4. **Network Errors**
   - Toast with error icon, red variant
   - Message: "Connection error. Check your internet."
   - "Retry" button
   - Manual dismiss only

**Implementation:**

```typescript
// In generation.service.ts
import { supabaseClient } from '@/db/supabase.client'

async function generatePlan(tripId: number) {
  try {
    const response = await supabaseClient.functions.invoke('generate-plan', {
      body: { tripId }
    })

    if (response.error) {
      handleGenerationError(response.error)
      return null
    }

    return response.data
  } catch (error) {
    toast({
      variant: 'destructive',
      title: 'Generation Failed',
      description: 'Failed to generate plan. Please try again.',
      action: h(Button, { onClick: () => generatePlan(tripId) }, 'Retry')
    })
    return null
  }
}

function handleGenerationError(error: any) {
  if (error.code === 'QUOTA_EXCEEDED') {
    toast({
      variant: 'warning',
      title: 'Generation Limit Reached',
      description: `You've used all 10 generations. Resets ${formatResetTime(error.details.reset_at)}`,
      duration: 10000
    })
  } else {
    toast({
      variant: 'destructive',
      title: 'Error',
      description: error.message || 'An unexpected error occurred',
      action: h(Button, { onClick: () => retryGeneration() }, 'Retry')
    })
  }
}
```

### 4.10 Navigation Guards and Unsaved Changes

**Location:** Vue Router configuration and TripDetailView.vue

**Purpose:** Prevent accidental loss of unsaved plan candidates

**Implementation:**

```typescript
// In TripDetailView.vue
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

**Alternative with Dialog Component:**

```vue
<AlertDialog v-model:open="showLeaveDialog">
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
      <AlertDialogDescription>
        You have an unsaved plan. Your changes will be lost if you leave this page.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel @click="cancelNavigation">Stay</AlertDialogCancel>
      <AlertDialogAction @click="confirmNavigation">Leave Anyway</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

## 5. State Management with Pinia

### 5.1 Store Structure

#### AuthStore (`stores/auth.store.ts`)

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabaseClient } from '@/db/supabase.client'
import type { User, Session } from '@supabase/supabase-js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const isAuthenticated = computed(() => !!user.value)

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

  async function deleteAccount() {
    // Call custom Edge Function for account deletion
    const { error } = await supabaseClient.functions.invoke('delete-account')
    if (error) throw error
    await logout()
  }

  // Initialize auth state on app load
  async function initialize() {
    const { data } = await supabaseClient.auth.getSession()
    if (data.session) {
      user.value = data.session.user
      session.value = data.session
    }
  }

  return {
    user,
    session,
    isAuthenticated,
    login,
    register,
    logout,
    deleteAccount,
    initialize
  }
})
```

#### ProfileStore (`stores/profile.store.ts`)

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabaseClient } from '@/db/supabase.client'
import type { Profile } from '@/types'

export const useProfileStore = defineStore('profile', () => {
  const profile = ref<Profile | null>(null)
  const isComplete = computed(() => profile.value?.is_complete ?? false)

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

  return { profile, isComplete, fetchProfile, updateProfile }
})
```

#### TripStore (`stores/trip.store.ts`)

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabaseClient } from '@/db/supabase.client'
import type { Trip, CreateTripDto, Pagination } from '@/types'

export const useTripStore = defineStore('trip', () => {
  const trips = ref<Trip[]>([])
  const currentTrip = ref<Trip | null>(null)
  const pagination = ref<Pagination>({
    current_page: 1,
    total_pages: 1,
    total_count: 0,
    limit: 20
  })

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

  async function fetchTrip(id: number) {
    const { data, error } = await supabaseClient.from('trips').select('*').eq('id', id).single()

    if (error) throw error
    currentTrip.value = data
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

  async function deleteTrip(id: number) {
    const { error } = await supabaseClient.from('trips').delete().eq('id', id)

    if (error) throw error
    trips.value = trips.value.filter((t) => t.id !== id)
  }

  return {
    trips,
    currentTrip,
    pagination,
    fetchTrips,
    fetchTrip,
    createTrip,
    updateTrip,
    deleteTrip
  }
})
```

#### PlanStore (`stores/plan.store.ts`)

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabaseClient } from '@/db/supabase.client'
import type { PlanCandidate, GenerationQuota, PlanJson } from '@/types'

export const usePlanStore = defineStore('plan', () => {
  const candidate = ref<PlanCandidate | null>(null)
  const quota = ref<GenerationQuota | null>(null)
  const isGenerating = ref(false)
  const hasUnsavedCandidate = computed(() => !!candidate.value && !candidate.value.isSaved)

  async function fetchQuota() {
    const { data, error } = await supabaseClient.functions.invoke('get-generation-quota')
    if (error) throw error
    quota.value = data
  }

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

      // Refresh quota after generation
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

    candidate.value = {
      ...candidate.value,
      isSaved: true
    }

    return data
  }

  function clearCandidate() {
    candidate.value = null
  }

  function editCandidate(updates: Partial<PlanJson>) {
    if (!candidate.value) return
    candidate.value = {
      ...candidate.value,
      plan: {
        ...candidate.value.plan,
        ...updates
      }
    }
  }

  return {
    candidate,
    quota,
    isGenerating,
    hasUnsavedCandidate,
    fetchQuota,
    generatePlan,
    savePlan,
    clearCandidate,
    editCandidate
  }
})
```

### 5.2 Optimistic Updates

**Pattern:** Update UI immediately, revert on error

**Example - Updating Trip Title:**

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

## 6. Routing and Navigation

### 6.1 Route Configuration

```typescript
// router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { supabaseClient } from '@/db/supabase.client'

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

// Global navigation guard
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  // Initialize auth state if not already done
  if (!authStore.user) {
    await authStore.initialize()
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } })
  } else if (!to.meta.requiresAuth && authStore.isAuthenticated && to.name !== 'landing') {
    next({ name: 'dashboard' })
  } else {
    next()
  }
})

export default router
```

**Note on JWT Authentication:**
JWT-based authentication will be implemented in a later phase. Currently, the application uses Supabase's built-in session management. When JWT is implemented:

- Session tokens will be stored in HTTP-only cookies
- JWT will be included in `Authorization: Bearer <token>` header for API requests
- Token refresh logic will be handled automatically by Supabase client
- Custom middleware may be added for additional security checks

### 6.2 Navigation Patterns

**From Dashboard to Trip:**

- Click trip card → navigate to `/trips/:id`
- Load trip data and plan (if exists) on mount

**From Trip back to Dashboard:**

- Back button in header → navigate to `/dashboard`
- Check for unsaved changes before leaving

**Profile Completion Flow:**

- Banner on dashboard → click "Complete Profile" → navigate to `/profile`
- After saving profile → navigate back to `/dashboard`

## 7. Accessibility Considerations (WCAG AA Compliance)

### 7.1 ARIA Labels and Roles

- **Navigation:** Use `<nav>` with `aria-label="Main navigation"` for sidebar
- **Forms:** Associate labels with inputs using `for` attribute or `aria-labelledby`
- **Buttons:** Use descriptive `aria-label` for icon-only buttons
- **Alerts:** Use `role="alert"` for error messages and notifications
- **Modals:** Use `aria-modal="true"` and trap focus within dialogs
- **Navigation Menu:** Implement proper `aria-expanded`, `aria-current` for sidebar items

### 7.2 Keyboard Navigation

- All interactive elements accessible via Tab key
- Modal dialogs trap focus and close on Escape
- Dropdown menus navigable with arrow keys
- Form submission on Enter key
- Sidebar navigation accessible via keyboard (Tab, Enter, Arrow keys)
- Skip to main content link for keyboard users

### 7.3 Screen Reader Support

- Use semantic HTML (`<main>`, `<article>`, `<section>`, `<nav>`)
- Provide alt text for all images and icons
- Use `aria-live` regions for dynamic content updates (quota counter, generation status)
- Announce toast notifications to screen readers with appropriate `aria-live` politeness
- Provide descriptive labels for all form inputs

### 7.4 Color Contrast (WCAG AA)

- **Text contrast:** Minimum 4.5:1 for normal text, 3:1 for large text
- **Status badges:**
  - CREATED (gray): Ensure sufficient contrast on white background
  - DRAFT (yellow/orange): Use darker shades for text readability
  - CONFIRMED (green): Use accessible green shades (#059669 or darker)
- **Character counter colors:**
  - Red (invalid): Use #DC2626 or darker
  - Yellow (warning): Use #D97706 or darker
  - Green (valid): Use #059669 or darker
- **Inherited preference background:** Light blue (#EFF6FF) with dark text (#1E293B)
- **Focus indicators:** Visible 2px outline with 3:1 contrast ratio

### 7.5 Focus Management

- Visible focus indicators on all interactive elements
- Focus trap in modals and dialogs
- Logical focus order following visual layout
- Return focus to trigger element when closing modals
- Skip navigation link at the top of the page

### 7.6 Text and Content

- Minimum font size: 16px for body text
- Line height: 1.5 for body text
- Paragraph width: Max 80 characters for readability
- Resizable text up to 200% without loss of functionality
- Clear error messages with suggestions for correction

## 8. Responsive Design Strategy

### 8.1 Breakpoints (Tailwind defaults)

- **sm:** 640px - Small tablets
- **md:** 768px - Tablets
- **lg:** 1024px - Desktops (split-panel threshold)
- **xl:** 1280px - Large desktops
- **2xl:** 1536px - Extra large screens

### 8.2 Tailwind Responsive Variants Usage

**Mobile-First Approach:**
All styles are mobile-first by default. Use responsive variants to override for larger screens.

**Common Patterns:**

```vue
<!-- Layout -->
<div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
  <!-- Responsive grid: 1 col mobile, 2 cols tablet, 3 cols desktop -->
</div>

<!-- Spacing -->
<div class="p-4 md:p-6 lg:p-8">
  <!-- Responsive padding: 16px mobile, 24px tablet, 32px desktop -->
</div>

<!-- Typography -->
<h1 class="text-2xl font-bold md:text-3xl lg:text-4xl">
  <!-- Responsive font size -->
</h1>

<!-- Visibility -->
<button class="block lg:hidden">
  <!-- Show on mobile/tablet, hide on desktop -->
</button>
<nav class="hidden lg:block">
  <!-- Hide on mobile/tablet, show on desktop -->
</nav>

<!-- Flexbox -->
<div class="flex flex-col gap-4 md:flex-row">
  <!-- Stack on mobile, row on tablet+ -->
</div>

<!-- Width -->
<div class="w-full md:w-1/2 lg:w-1/3">
  <!-- Responsive width -->
</div>

<!-- Position -->
<div class="relative lg:sticky lg:top-4">
  <!-- Sticky only on desktop -->
</div>
```

### 8.3 Layout Adaptations

**Dashboard:**

```vue
<div class="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:gap-6 md:p-6 lg:grid-cols-3 lg:p-8">
  <TripCard v-for="trip in trips" :key="trip.id" :trip="trip" />
</div>
```

- Mobile: Single column trip cards
- Small tablet: 2-column grid
- Desktop: 3-column grid

**Trip Detail:**

```vue
<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
  <div class="order-1"><!-- Note --></div>
  <div class="order-2 lg:sticky lg:top-4"><!-- Plan --></div>
</div>
```

- Mobile/Tablet: Stacked (note above plan)
- Desktop (≥1024px): Split-panel (50/50) with sticky plan

**Navigation:**

```vue
<!-- Sidebar -->
<aside
  class="fixed inset-y-0 left-0 w-64 transition-transform lg:translate-x-0"
  :class="isOpen ? 'translate-x-0' : '-translate-x-full'"
>
  <!-- Sidebar content -->
</aside>

<!-- Mobile toggle -->
<Button class="lg:hidden" @click="toggleSidebar">
  <Menu />
</Button>
```

- Mobile: Collapsible sidebar (overlay)
- Desktop: Persistent sidebar

**Forms:**

```vue
<form class="space-y-4 md:space-y-6">
  <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
    <Label class="md:w-1/3">Trip Title</Label>
    <Input class="md:w-2/3" />
  </div>

  <div class="flex flex-col sm:flex-row gap-2 sm:gap-4">
    <Button class="w-full sm:w-auto">Save</Button>
    <Button variant="outline" class="w-full sm:w-auto">Cancel</Button>
  </div>
</form>
```

- Mobile: Full-width inputs, stacked buttons
- Tablet+: Inline labels, side-by-side buttons

## 9. Performance Optimization

### 9.1 Code Splitting

- Route-based code splitting (lazy loading views)
- Component-level splitting for heavy components (plan editor, rich text editor)

### 9.2 Data Fetching

- Fetch profile and quota on app mount (store in Pinia)
- Fetch trips on dashboard mount with pagination
- Fetch individual trip on detail view mount
- Use Supabase real-time subscriptions for live updates (future enhancement)

### 9.3 Caching Strategy

- Cache profile data in Pinia (refresh on profile update)
- Cache trip list in Pinia (invalidate on create/update/delete)
- Cache quota in Pinia (refresh after generation)
- Use browser localStorage for:
  - Banner dismissal state
  - User preferences (theme, language)

## 10. Component Library Usage (shadcn-vue)

### 10.1 Core Components (shadcn-vue)

All UI components should use shadcn-vue primitives as the foundation:

- **Navigation Menu:** Sidebar navigation (primary navigation component)
- **Button:** Primary actions, secondary actions, ghost variants
- **Card:** Trip cards, plan day cards
- **Alert:** Banners, notifications, warnings
- **Badge:** Status indicators, category tags
- **Dialog/AlertDialog:** Confirmations, modals
- **Toast:** Notifications, errors
- **Accordion:** Plan day expansion
- **Select:** Dropdown selectors for preferences
- **Textarea:** Note editor
- **Progress:** Quota visualization
- **Tabs:** Future use for trip sections
- **Separator:** Visual dividers between sections
- **Skeleton:** Loading states

### 10.2 Form Components

- **Label:** Form field labels
- **Input:** Text inputs (trip title, etc.)
- **Textarea:** Note content
- **Checkbox:** Boolean preferences (profile flags)
- **RadioGroup:** Single-choice preferences (speed, type, budget)
- **Form:** Form validation wrapper (with Zod schemas)

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

## 12. Summary

This UI architecture provides:

✅ **Clear view hierarchy** aligned with API structure
✅ **Intuitive user flows** for trip planning workflow
✅ **Responsive layouts** using Tailwind responsive variants (sm:, md:, lg:, xl:, 2xl:)
✅ **WCAG AA compliance** with proper color contrast, ARIA labels, and keyboard navigation
✅ **shadcn-vue components** as the foundation for all UI elements
✅ **Sidebar navigation** using shadcn-vue Navigation Menu component
✅ **Custom Supabase client** integration (`@/db/supabase.client.ts`)
✅ **Robust error handling** with user-friendly notifications and retry mechanisms
✅ **Optimistic updates** for better perceived performance
✅ **State management** with Pinia stores for auth, profile, trips, and plans
✅ **Navigation guards** to prevent data loss from unsaved changes
✅ **Performance optimization** through code splitting and caching
✅ **JWT authentication** ready for future implementation

### Key Technical Decisions:

1. **Custom Supabase Client:** All database operations use `@/db/supabase.client.ts`
2. **shadcn-vue First:** Prioritize shadcn-vue components for consistency and accessibility
3. **Mobile-First Responsive:** Use Tailwind responsive variants with mobile-first approach
4. **Sidebar Navigation:** shadcn-vue Navigation Menu in sidebar layout (not horizontal nav)
5. **WCAG AA:** Minimum 4.5:1 contrast ratio, keyboard navigation, screen reader support
6. **JWT Auth:** Planned for later phase, currently using Supabase session management

### Component Hierarchy:

```
App.vue
├── Router View
│   ├── AuthLayout (public routes)
│   │   ├── LandingView
│   │   ├── LoginView
│   │   └── RegisterView
│   └── AppLayout (protected routes)
│       ├── Sidebar (Navigation Menu)
│       ├── DashboardView
│       │   ├── ProfileCompletenessBanner
│       │   ├── TripCard (multiple)
│       │   └── Pagination
│       ├── ProfileView
│       │   ├── ProfileForm
│       │   └── PreferenceSelector
│       ├── TripDetailView
│       │   ├── TripNoteEditor
│       │   │   └── CharacterCounter
│       │   ├── TripPreferences
│       │   └── PlanViewer
│       │       ├── GenerationQuotaCounter
│       │       ├── PlanCandidateBanner
│       │       └── PlanDayList
│       │           ├── PlanDayAccordion
│       │           └── ActivityCard
│       └── TripCreateView
```

The architecture is production-ready, fully accessible (WCAG AA), and designed to scale with future enhancements while maintaining a clean, maintainable codebase aligned with Vue 3 best practices and the MyAIGuide product requirements.
**Features:**

- Textarea for note content
- Real-time character counter below textarea
- Counter format: "X / 10,000 characters (minimum 1,000 required)"
- Color coding:
  - Red: <1000 or >10,000 (invalid)
  - Yellow: 1000-1500 (valid but minimal)
  - Green: 1500-10,000 (optimal)
- Auto-save on blur (debounced)
- Visual feedback during save

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

**Location:** TripPreferences.vue component

**Features:**

- Four preference fields: What / Speed / Type / Budget
- Values inherited from global profile shown with light blue background
- Visual indicator: light blue background (`bg-blue-50` in Tailwind)
- Tooltip on hover: "From profile" or "Custom value"

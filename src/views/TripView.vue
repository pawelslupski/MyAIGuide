<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useTripStore } from '@/stores/trip.store'
import { usePlanStore } from '@/stores/plan.store'
import { useProfileStore } from '@/stores/profile.store'
import { useQuotaStore } from '@/stores/quota.store'
import { useToast } from '@/components/ui/toast/use-toast'
import TripEditor from '@/components/TripEditor.vue'
import PlanPanel from '@/components/PlanPanel.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import type { TripPreferencesDto } from '@/types'

/**
 * TripDetailView
 * Main container for trip editing and plan generation
 * Implements responsive split-panel layout
 */

const route = useRoute()
const router = useRouter()
const { toast } = useToast()

// Stores
const tripStore = useTripStore()
const planStore = usePlanStore()
const profileStore = useProfileStore()
const quotaStore = useQuotaStore()

// Local state
const isInitializing = ref(true)

/**
 * Initialize view data
 * Fetches trip, profile, and quota information
 */
async function initializeView() {
  isInitializing.value = true

  try {
    const tripId = parseInt(route.params.id as string, 10)

    // Fetch all required data in parallel
    await Promise.all([
      tripStore.fetchTrip(tripId),
      profileStore.fetchProfile(),
      quotaStore.fetchQuota()
    ])
  } catch (error: any) {
    console.error('Failed to initialize view:', error)

    // Handle specific errors
    if (error.message?.includes('not found') || error.code === 'PGRST116') {
      toast({
        title: 'Trip not found',
        description: 'The trip you are looking for does not exist.',
        variant: 'destructive'
      })
      router.push('/')
    } else {
      toast({
        title: 'Error loading trip',
        description: error.message || 'Failed to load trip data',
        variant: 'destructive'
      })
    }
  } finally {
    isInitializing.value = false
  }
}

/**
 * Navigation guard - warn about unsaved plan candidate
 */
onBeforeRouteLeave((_to, _from, next) => {
  if (planStore.hasCandidate) {
    const confirmed = window.confirm(
      'You have an unsaved plan. Are you sure you want to leave? Your changes will be lost.'
    )
    if (confirmed) {
      planStore.discardCandidate()
      next()
    } else {
      next(false)
    }
  } else {
    next()
  }
})

/**
 * Watch for route parameter changes
 */
watch(
  () => route.params.id,
  (newId, oldId) => {
    if (newId !== oldId) {
      tripStore.clearTrip()
      planStore.discardCandidate()
      initializeView()
    }
  }
)

// Initialize on mount
onMounted(() => {
  initializeView()
})

/**
 * Handle trip title update
 */
async function handleTitleUpdate(title: string) {
  try {
    const tripId = parseInt(route.params.id as string, 10)
    await tripStore.updateTripTitle(tripId, title)
  } catch (error: any) {
    toast({
      title: 'Failed to update title',
      description: error.message || 'An error occurred',
      variant: 'destructive'
    })
  }
}

/**
 * Handle trip destination update
 */
async function handleDestinationUpdate(destination: string) {
  try {
    const tripId = parseInt(route.params.id as string, 10)
    await tripStore.updateTripDestination(tripId, destination)
  } catch (error: any) {
    toast({
      title: 'Failed to update destination',
      description: error.message || 'An error occurred',
      variant: 'destructive'
    })
  }
}

/**
 * Handle trip note update
 */
async function handleNoteUpdate(note: string) {
  try {
    const tripId = parseInt(route.params.id as string, 10)
    await tripStore.updateTripNote(tripId, note)
  } catch (error: any) {
    toast({
      title: 'Failed to save note',
      description: error.message || 'An error occurred',
      variant: 'destructive'
    })
  }
}

/**
 * Handle trip preferences update
 */
async function handlePreferencesUpdate(preferences: TripPreferencesDto) {
  try {
    const tripId = parseInt(route.params.id as string, 10)
    await tripStore.updateTripPreferences(tripId, preferences)
  } catch (error: any) {
    toast({
      title: 'Failed to update preferences',
      description: error.message || 'An error occurred',
      variant: 'destructive'
    })
  }
}
</script>

<template>
  <div class="container mx-auto px-4 py-6 md:py-8">
    <!-- Loading State -->
    <div v-if="isInitializing" class="flex min-h-[400px] items-center justify-center">
      <div class="text-center">
        <div
          class="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"
        ></div>
        <p class="text-muted-foreground">Loading trip...</p>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else-if="tripStore.currentTrip" class="space-y-6">
      <!-- Trip Header with Theme Toggle -->
      <div class="rounded-lg border bg-card p-4">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <h1 class="text-2xl font-bold">{{ tripStore.currentTrip.title }}</h1>
            <p class="mt-1 text-sm text-muted-foreground">
              Status: {{ tripStore.currentTrip.status }}
            </p>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <!-- Responsive Grid Layout -->
      <div class="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        <!-- Left Panel: Trip Editor (order-1) -->
        <div class="order-1 space-y-4">
          <TripEditor
            :trip="tripStore.currentTrip"
            :default-preferences="profileStore.defaultPreferences"
            @update:title="handleTitleUpdate"
            @update:destination="handleDestinationUpdate"
            @update:note="handleNoteUpdate"
            @update:preferences="handlePreferencesUpdate"
          />
        </div>

        <!-- Right Panel: Plan Panel (order-2, sticky on desktop) -->
        <div class="order-2 space-y-4 lg:sticky lg:top-4 lg:self-start">
          <PlanPanel :trip="tripStore.currentTrip" />
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else class="flex min-h-[400px] items-center justify-center">
      <div class="text-center">
        <p class="text-lg font-semibold text-destructive">Failed to load trip</p>
        <p class="mt-2 text-sm text-muted-foreground">Please try again later</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useDebounceFn } from '@vueuse/core'
import { useTripStore } from '@/stores/trip.store'
import { usePlanStore } from '@/stores/plan.store'
import { useProfileStore } from '@/stores/profile.store'
import { useQuotaStore } from '@/stores/quota.store'
import { useToast } from '@/components/ui/toast/use-toast'
import TripEditor from '@/components/TripEditor.vue'
import TripHeader from '@/components/TripHeader.vue'
import PlanPanel from '@/components/PlanPanel.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import type { WhatPreference, SpeedPreference, TypePreference, BudgetPreference } from '@/types'

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

// Pending (unsaved) edit fields tracked from TripEditor
type PendingFields = {
  title: string
  destination: string | null
  note_body: string | null
  what: WhatPreference[]
  speed: SpeedPreference | null
  type: TypePreference | null
  budget: BudgetPreference | null
  num_days: number | null
  num_people: number | null
}
const pendingFields = ref<PendingFields | null>(null)

// Initialise pendingFields once the trip is loaded
watch(
  () => tripStore.currentTrip,
  (trip) => {
    if (trip && !pendingFields.value) {
      pendingFields.value = {
        title: trip.title,
        destination: trip.destination ?? null,
        note_body: trip.note_body ?? null,
        what: [...(trip.what ?? [])] as WhatPreference[],
        speed: trip.speed as SpeedPreference | null,
        type: trip.type as TypePreference | null,
        budget: trip.budget as BudgetPreference | null,
        num_days: trip.num_days ?? null,
        num_people: trip.num_people ?? null
      }
    }
  },
  { immediate: true }
)

function handleFieldsChange(fields: Omit<PendingFields, 'title'>) {
  pendingFields.value = {
    title: pendingFields.value?.title ?? tripStore.currentTrip?.title ?? '',
    ...fields
  }
}

function handleTitleChange(newTitle: string) {
  if (pendingFields.value) {
    pendingFields.value = { ...pendingFields.value, title: newTitle }
  }
}

const isNoteOverLimit = computed(() => (pendingFields.value?.note_body?.length ?? 0) > 10000)

const isDirty = computed(() => {
  const t = tripStore.currentTrip
  const p = pendingFields.value
  if (!t || !p) return false
  return (
    p.title !== t.title ||
    p.destination !== (t.destination ?? null) ||
    p.note_body !== (t.note_body ?? null) ||
    JSON.stringify(p.what) !== JSON.stringify(t.what ?? []) ||
    p.speed !== (t.speed ?? null) ||
    p.type !== (t.type ?? null) ||
    p.budget !== (t.budget ?? null) ||
    p.num_days !== (t.num_days ?? null) ||
    p.num_people !== (t.num_people ?? null)
  )
})

/**
 * Initialize view data
 * Fetches trip, profile, and quota information
 */
async function initializeView() {
  isInitializing.value = true

  try {
    const rawId = route.params.id as string

    // Guard: skip fetch if the same trip is already loaded (e.g. soft re-mount)
    const tripFetchPromise =
      !tripStore.currentTrip || String(tripStore.currentTrip.id) !== rawId
        ? tripStore.fetchTrip(rawId)
        : Promise.resolve()

    // Fetch all required data in parallel
    await Promise.all([tripFetchPromise, profileStore.fetchProfile(), quotaStore.fetchQuota()])
  } catch (error: any) {
    console.error('Failed to initialize view:', error)

    // Handle specific errors by code (set by createNotFoundError / createInvalidTripIdError)
    if (error.code === 'NOT_FOUND' || error.code === 'INVALID_TRIP_ID') {
      toast({
        title: 'Trip not found',
        description: 'The trip you are looking for does not exist.',
        variant: 'destructive'
      })
      router.push('/')
    } else if (error.code === 'UNAUTHORIZED') {
      router.push('/login')
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
 * Navigation guard - warn about unsaved trip edits or unsaved plan candidate
 */
onBeforeRouteLeave((_to, _from, next) => {
  const hasUnsaved = isDirty.value || planStore.hasCandidate
  if (hasUnsaved) {
    const confirmed = window.confirm(
      'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.'
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
      debouncedSave.cancel()
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
 * Core save – persists all pending fields and syncs local state.
 * Called directly (on note blur) or via the debounced wrapper.
 */
async function performSave() {
  if (!pendingFields.value || !isDirty.value) return
  try {
    const tripId = parseInt(route.params.id as string, 10)
    await tripStore.saveAllFields(tripId, pendingFields.value)
    const t = tripStore.currentTrip!
    pendingFields.value = {
      title: t.title,
      destination: t.destination ?? null,
      note_body: t.note_body ?? null,
      what: [...(t.what ?? [])] as WhatPreference[],
      speed: t.speed as SpeedPreference | null,
      type: t.type as TypePreference | null,
      budget: t.budget as BudgetPreference | null,
      num_days: t.num_days ?? null,
      num_people: t.num_people ?? null
    }
  } catch (error: any) {
    toast({
      title: 'Failed to save trip',
      description: error.message || 'An error occurred',
      variant: 'destructive'
    })
  }
}

/**
 * Debounced auto-save for every field except note_body.
 * Fires 800 ms after the last change so rapid typing doesn't flood the API.
 */
const debouncedSave = useDebounceFn(performSave, 800)

// Trigger debounced save whenever any non-note field changes.
watch(
  () => [
    pendingFields.value?.title,
    pendingFields.value?.destination,
    JSON.stringify(pendingFields.value?.what),
    pendingFields.value?.speed,
    pendingFields.value?.type,
    pendingFields.value?.budget,
    pendingFields.value?.num_days,
    pendingFields.value?.num_people
  ],
  () => {
    if (!pendingFields.value || !isDirty.value) return
    debouncedSave()
  }
)

/**
 * Called when the note textarea is blurred.
 * Cancels any pending debounced save to avoid a double request,
 * then immediately persists everything including the note.
 */
async function handleNoteBlur() {
  debouncedSave.cancel()
  await performSave()
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
      <!-- Trip Header -->
      <TripHeader
        :title="pendingFields?.title ?? tripStore.currentTrip.title"
        :status="tripStore.currentTrip.status"
        :updated-at="tripStore.currentTrip.updated_at"
        :is-saving="tripStore.isSaving"
        @update:title="handleTitleChange"
      >
        <template #actions>
          <ThemeToggle />
        </template>
      </TripHeader>

      <!-- Responsive Grid Layout -->
      <div class="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        <!-- Left Panel: Trip Editor (order-1) -->
        <div class="order-1 space-y-4">
          <TripEditor
            :trip="tripStore.currentTrip"
            :default-preferences="profileStore.defaultPreferences"
            :profile="profileStore.profile"
            @update:fields="handleFieldsChange"
            @blur:note="handleNoteBlur"
          />
        </div>

        <!-- Right Panel: Plan Panel (order-2, sticky on desktop) -->
        <div class="order-2 space-y-4 lg:sticky lg:top-4 lg:self-start">
          <PlanPanel
            :trip="tripStore.currentTrip"
            :destination="pendingFields?.destination ?? null"
            :is-note-over-limit="isNoteOverLimit"
          />
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

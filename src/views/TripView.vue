<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useDebounceFn } from '@vueuse/core'
import { useTripStore } from '@/stores/trip.store'
import { usePlanStore } from '@/stores/plan.store'
import { useProfileStore } from '@/stores/profile.store'
import { useQuotaStore } from '@/stores/quota.store'
import { useToast } from '@/components/ui/toast/use-toast'
import AppLayout from '@/layouts/AppLayout.vue'
import TripEditor from '@/components/TripEditor.vue'
import TripHeader from '@/components/TripHeader.vue'
import PlanPanel from '@/components/PlanPanel.vue'
import type { WhatPreference, SpeedPreference, TypePreference, BudgetPreference } from '@/types'
import { isFeatureEnabled } from '@/lib/features/flags'
import { detectLanguage } from '@/lib/services/generation.service'

/**
 * TripDetailView
 * Main container for trip editing and plan generation
 * Implements responsive split-panel layout
 */

const route = useRoute()
const router = useRouter()
const { toast } = useToast()
const { t, locale } = useI18n()

// Stores
const tripStore = useTripStore()
const planStore = usePlanStore()
const profileStore = useProfileStore()
const quotaStore = useQuotaStore()

const isPlanGenerationEnabled = isFeatureEnabled('plan-generation')

// Local state
const isInitializing = ref(true)
const noteLanguageMismatch = ref(false)
const isGenerating = computed(() => planStore.isGenerating)

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
  const current = pendingFields.value
  if (
    current &&
    current.destination === fields.destination &&
    current.note_body === fields.note_body &&
    current.speed === fields.speed &&
    current.type === fields.type &&
    current.budget === fields.budget &&
    current.num_days === fields.num_days &&
    current.num_people === fields.num_people &&
    JSON.stringify(current.what) === JSON.stringify(fields.what)
  )
    return
  pendingFields.value = {
    title: current?.title ?? tripStore.currentTrip?.title ?? '',
    ...fields
  }
}

function handleTitleChange(newTitle: string) {
  if (pendingFields.value) {
    pendingFields.value = { ...pendingFields.value, title: newTitle }
  }
}

async function handleTitleBlur(newTitle: string) {
  handleTitleChange(newTitle)
  debouncedSave.cancel()
  await performSave()
}

async function handleDestinationBlur() {
  debouncedSave.cancel()
  await performSave()
}

const isNoteOverLimit = computed(() => (pendingFields.value?.note_body?.length ?? 0) > 10000)

const isDirty = computed(() => {
  const t = tripStore.currentTrip
  const p = pendingFields.value
  const d = profileStore.defaultPreferences
  if (!t || !p) return false
  // For preference fields, fall back to profile defaults when the trip has no saved value
  // so that profile-inherited values don't trigger an unsolicited auto-save.
  const effectiveWhat = (t.what?.length ? t.what : d?.what) ?? []
  const effectiveSpeed = t.speed ?? d?.speed ?? null
  const effectiveType = t.type ?? d?.type ?? null
  const effectiveBudget = t.budget ?? d?.budget ?? null
  return (
    p.title !== t.title ||
    p.destination !== (t.destination ?? null) ||
    p.note_body !== (t.note_body ?? null) ||
    p.what.length !== effectiveWhat.length ||
    JSON.stringify(p.what) !== JSON.stringify(effectiveWhat) ||
    p.speed !== effectiveSpeed ||
    p.type !== effectiveType ||
    p.budget !== effectiveBudget ||
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
        title: t('tripView.notFoundTitle'),
        description: t('tripView.notFoundDesc'),
        variant: 'destructive'
      })
      router.push('/')
    } else if (error.code === 'UNAUTHORIZED') {
      router.push('/login')
    } else {
      toast({
        title: t('tripView.loadFailed'),
        description: error.message || t('tripView.loadFailedDesc'),
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
const showLeaveDialog = ref(false)
const leaveDialogIsGenerating = ref(false)
let leaveResolve: ((confirmed: boolean) => void) | null = null

function confirmLeave() {
  showLeaveDialog.value = false
  leaveResolve?.(true)
}

function cancelLeave() {
  showLeaveDialog.value = false
  leaveResolve?.(false)
}

onBeforeRouteLeave(async (_to, _from, next) => {
  const hasUnsaved = isDirty.value || planStore.hasCandidate || planStore.isGenerating
  if (!hasUnsaved) {
    next()
    return
  }

  leaveDialogIsGenerating.value = planStore.isGenerating

  const confirmed = await new Promise<boolean>((resolve) => {
    leaveResolve = resolve
    showLeaveDialog.value = true
  })

  if (confirmed) {
    planStore.cancelGeneration()
    planStore.discardCandidate()
    next()
  } else {
    next(false)
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
      pendingFields.value = null
      initializeView()
    }
  }
)

// Initialize on mount — clear any stale trip data left from a previous visit
onMounted(() => {
  tripStore.clearTrip()
  pendingFields.value = null
  initializeView()
})

/**
 * Core save – persists all pending fields and syncs local state.
 * Called directly (on note blur) or via the debounced wrapper.
 */
async function performSave() {
  if (!pendingFields.value || !isDirty.value) return
  if (tripStore.isSaving) {
    debouncedSave()
    return
  }
  try {
    const tripId = parseInt(route.params.id as string, 10)
    await tripStore.saveAllFields(tripId, pendingFields.value)
    const tr = tripStore.currentTrip!
    pendingFields.value = {
      title: tr.title,
      destination: tr.destination ?? null,
      note_body: tr.note_body ?? null,
      what: [...(tr.what ?? [])] as WhatPreference[],
      speed: tr.speed as SpeedPreference | null,
      type: tr.type as TypePreference | null,
      budget: tr.budget as BudgetPreference | null,
      num_days: tr.num_days ?? null,
      num_people: tr.num_people ?? null
    }
  } catch (error: any) {
    toast({
      title: t('tripView.saveFailedTitle'),
      description: error.message || 'An error occurred',
      variant: 'destructive'
    })
  }
}

/**
 * Debounced auto-save for select/checkbox fields.
 * Title and destination are saved immediately on blur instead.
 */
const debouncedSave = useDebounceFn(performSave, 800) as typeof performSave & { cancel(): void }

// Trigger debounced save for select/number fields (title and destination handled on blur).
watch(
  () => [
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

  const noteBody = pendingFields.value?.note_body ?? ''
  if (noteBody.trim().length > 0) {
    const detectedLang = detectLanguage(noteBody)
    noteLanguageMismatch.value = detectedLang !== locale.value
  } else {
    noteLanguageMismatch.value = false
  }
}
</script>

<template>
  <AppLayout>
    <!-- Loading State -->
    <div v-if="isInitializing" class="flex min-h-[400px] items-center justify-center">
      <div class="text-center">
        <div
          class="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"
        ></div>
        <p class="text-muted-foreground">{{ t('tripView.loading') }}</p>
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
        :is-generating="isGenerating"
        @update:title="handleTitleChange"
        @blur:title="handleTitleBlur"
      />

      <!-- Responsive Grid Layout -->
      <div class="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        <!-- Left Panel: Trip Editor (order-1) -->
        <div class="order-1 space-y-4">
          <TripEditor
            :trip="tripStore.currentTrip"
            :default-preferences="profileStore.defaultPreferences"
            :profile="profileStore.profile"
            :note-language-mismatch="noteLanguageMismatch"
            :is-generating="isGenerating"
            @update:fields="handleFieldsChange"
            @blur:note="handleNoteBlur"
            @blur:destination="handleDestinationBlur"
          />
        </div>

        <!-- Right Panel: Plan Panel (order-2, sticky on desktop) -->
        <div class="order-2 space-y-4 lg:sticky lg:top-4 lg:self-start">
          <PlanPanel
            v-if="isPlanGenerationEnabled"
            :trip="tripStore.currentTrip"
            :destination="pendingFields?.destination ?? null"
            :is-note-over-limit="isNoteOverLimit"
          />
          <div
            v-else
            class="flex flex-col items-center justify-center rounded-xl border p-12 text-center text-muted-foreground"
          >
            {{ t('tripView.featureDisabled') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else class="flex min-h-[400px] items-center justify-center">
      <div class="text-center">
        <p class="text-lg font-semibold text-destructive">{{ t('tripView.loadFailed') }}</p>
        <p class="mt-2 text-sm text-muted-foreground">{{ t('tripView.loadFailedDesc') }}</p>
      </div>
    </div>
  </AppLayout>

  <!-- Unsaved changes navigation guard dialog -->
  <Dialog
    :open="showLeaveDialog"
    @update:open="
      (val) => {
        if (!val) cancelLeave()
      }
    "
  >
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{{
          leaveDialogIsGenerating
            ? t('tripView.leaveDialog.titleGenerating')
            : t('tripView.leaveDialog.title')
        }}</DialogTitle>
        <DialogDescription>{{
          leaveDialogIsGenerating
            ? t('tripView.leaveDialog.descriptionGenerating')
            : t('tripView.leaveDialog.description')
        }}</DialogDescription>
      </DialogHeader>
      <DialogFooter class="gap-3">
        <Button variant="outline" @click="cancelLeave">{{ t('tripView.leaveDialog.stay') }}</Button>
        <Button
          :variant="leaveDialogIsGenerating ? 'destructive' : 'default'"
          @click="confirmLeave"
          >{{
            leaveDialogIsGenerating
              ? t('tripView.leaveDialog.leaveGenerating')
              : t('tripView.leaveDialog.leave')
          }}</Button
        >
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

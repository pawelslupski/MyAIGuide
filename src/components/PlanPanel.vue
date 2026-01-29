<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { usePlanStore } from '@/stores/plan.store'
import { useQuotaStore } from '@/stores/quota.store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Loader2, Sparkles, Check, X, AlertCircle, Calendar } from 'lucide-vue-next'
import type { TripDTO, PlanJson } from '@/types'

/**
 * PlanPanel Component
 * Displays plan generation UI with three states:
 * 1. Empty state (no plan yet)
 * 2. Candidate state (unsaved generated plan)
 * 3. Saved plan state (confirmed plan)
 */

interface Props {
  trip: TripDTO
}

const props = defineProps<Props>()

const planStore = usePlanStore()
const quotaStore = useQuotaStore()

// Computed states
const hasSavedPlan = computed(() => props.trip.plan_json !== null)
const hasCandidate = computed(() => planStore.hasCandidate)
const isGenerating = computed(() => planStore.isGenerating)
const isSaving = computed(() => planStore.isSaving)
const generationError = computed(() => planStore.generationError)

// Quota information
const quotaExceeded = computed(() => quotaStore.isQuotaExceeded)
const remainingGenerations = computed(() => quotaStore.remainingGenerations)
const quota = computed(() => quotaStore.quota)

// Note validation
const MIN_NOTE_LENGTH = 1000
const noteValid = computed(() => {
  const noteLength = props.trip.note_body?.length ?? 0
  return noteLength >= MIN_NOTE_LENGTH
})

// Can generate check
const canGenerate = computed(() => {
  return noteValid.value && !quotaExceeded.value && !isGenerating.value
})

// Display plan (candidate or saved)
const displayPlan = computed<PlanJson | null>(() => {
  if (hasCandidate.value && planStore.candidatePlan) {
    return planStore.candidatePlan
  }
  return props.trip.plan_json
})

// Load quota on mount
onMounted(async () => {
  try {
    await quotaStore.fetchQuota()
  } catch (error) {
    console.error('Failed to load quota:', error)
  }
})

// Actions
async function handleGenerate() {
  try {
    await planStore.generatePlan(props.trip.id)
    await quotaStore.fetchQuota() // Refresh quota after generation
  } catch (error) {
    console.error('Failed to generate plan:', error)
  }
}

async function handleSave() {
  try {
    await planStore.savePlanToTrip(props.trip.id)
  } catch (error) {
    console.error('Failed to save plan:', error)
  }
}

function handleDiscard() {
  planStore.discardCandidate()
}

// Format date for display
function formatResetDate(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60))

  if (diffHours < 1) return 'less than 1 hour'
  if (diffHours === 1) return '1 hour'
  return `${diffHours} hours`
}
</script>

<template>
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between">
        <div>
          <CardTitle>Travel Plan</CardTitle>
          <CardDescription>AI-generated day-by-day itinerary</CardDescription>
        </div>
        <Badge v-if="quota" variant="outline" class="text-xs">
          {{ remainingGenerations }} / {{ quota.limit }} remaining
        </Badge>
      </div>
    </CardHeader>
    <CardContent class="space-y-4">
      <!-- Quota Exceeded Warning -->
      <Alert v-if="quotaExceeded" variant="destructive">
        <AlertCircle class="h-4 w-4" />
        <AlertTitle>Generation Limit Reached</AlertTitle>
        <AlertDescription>
          You've used all {{ quota?.limit }} generations. Quota resets in
          {{ quota ? formatResetDate(quota.reset_at) : 'N/A' }}.
        </AlertDescription>
      </Alert>

      <!-- Note Validation Warning -->
      <Alert v-if="!noteValid && !hasSavedPlan">
        <AlertCircle class="h-4 w-4" />
        <AlertTitle>Trip Notes Required</AlertTitle>
        <AlertDescription>
          Please add at least {{ MIN_NOTE_LENGTH }} characters to your trip notes before generating
          a plan.
        </AlertDescription>
      </Alert>

      <!-- Generation Error -->
      <Alert v-if="generationError" variant="destructive">
        <AlertCircle class="h-4 w-4" />
        <AlertTitle>Generation Failed</AlertTitle>
        <AlertDescription>
          {{ generationError.error.message }}
        </AlertDescription>
      </Alert>

      <!-- Generate Button (Empty State) -->
      <div
        v-if="!hasSavedPlan && !hasCandidate"
        class="flex flex-col items-center justify-center py-12"
      >
        <Sparkles class="mb-4 h-12 w-12 text-muted-foreground" />
        <p class="mb-6 text-center text-muted-foreground">
          No plan generated yet. Click below to create your personalized travel itinerary.
        </p>
        <Button :disabled="!canGenerate" size="lg" @click="handleGenerate">
          <Sparkles v-if="!isGenerating" class="mr-2 h-4 w-4" />
          <Loader2 v-else class="mr-2 h-4 w-4 animate-spin" />
          {{ isGenerating ? 'Generating...' : 'Generate Plan' }}
        </Button>
      </div>

      <!-- Candidate State (Unsaved Plan) -->
      <div v-if="hasCandidate && !hasSavedPlan">
        <Alert class="mb-4">
          <Sparkles class="h-4 w-4" />
          <AlertTitle>New Plan Generated</AlertTitle>
          <AlertDescription>
            Review your plan below. Save to confirm or discard to generate a new one.
          </AlertDescription>
        </Alert>

        <!-- Candidate Actions -->
        <div class="mb-4 flex gap-2">
          <Button :disabled="isSaving" class="flex-1" @click="handleSave">
            <Check v-if="!isSaving" class="mr-2 h-4 w-4" />
            <Loader2 v-else class="mr-2 h-4 w-4 animate-spin" />
            {{ isSaving ? 'Saving...' : 'Save Plan' }}
          </Button>
          <Button variant="outline" :disabled="isSaving" class="flex-1" @click="handleDiscard">
            <X class="mr-2 h-4 w-4" />
            Discard
          </Button>
        </div>

        <Separator class="my-4" />
      </div>

      <!-- Plan Display (Candidate or Saved) -->
      <div v-if="displayPlan" class="space-y-4">
        <!-- Saved Plan Header -->
        <div v-if="hasSavedPlan && !hasCandidate" class="mb-4 flex items-center justify-between">
          <Badge variant="default">
            <Check class="mr-1 h-3 w-3" />
            Confirmed Plan
          </Badge>
          <Button :disabled="!canGenerate" variant="outline" size="sm" @click="handleGenerate">
            <Sparkles class="mr-2 h-4 w-4" />
            Regenerate
          </Button>
        </div>

        <!-- Days and Activities -->
        <div class="space-y-6">
          <div v-for="day in displayPlan.days" :key="day.day" class="rounded-lg border p-4">
            <div class="mb-3 flex items-center gap-2">
              <Calendar class="h-5 w-5 text-primary" />
              <h3 class="text-lg font-semibold">Day {{ day.day }}</h3>
            </div>

            <div class="space-y-3">
              <div
                v-for="(activity, index) in day.activities"
                :key="index"
                class="border-l-2 border-muted pl-4"
              >
                <div class="flex items-start gap-3">
                  <Badge variant="outline" class="mt-1 text-xs">
                    {{ activity.timeOfDay }}
                  </Badge>
                  <div class="flex-1">
                    <h4 class="font-medium">{{ activity.locationName }}</h4>
                    <p class="mt-1 text-sm text-muted-foreground">
                      {{ activity.description }}
                    </p>
                    <Badge variant="secondary" class="mt-2 text-xs">
                      {{ activity.categoryTag.replace('_', ' ') }}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

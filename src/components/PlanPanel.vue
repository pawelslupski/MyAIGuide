<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePlanStore } from '@/stores/plan.store'
import { useQuotaStore } from '@/stores/quota.store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion'
import { Loader2, Sparkles, Check, X, AlertCircle, AlertTriangle, Calendar } from 'lucide-vue-next'
import { useToast } from '@/components/ui/toast/use-toast'
import type { TripDTO, PlanJson, Activity } from '@/types'

/**
 * PlanPanel Component
 * Displays plan generation UI with three states:
 * 1. Empty state (no plan yet)
 * 2. Candidate state (unsaved generated plan)
 * 3. Saved plan state (confirmed plan)
 */

interface Props {
  trip: TripDTO
  destination: string | null
  isNoteOverLimit: boolean
}

const props = defineProps<Props>()

const planStore = usePlanStore()
const quotaStore = useQuotaStore()
const { toast } = useToast()

// Local editable copy of the candidate plan (in-memory, not yet saved)
const localPlan = ref<PlanJson | null>(null)

// Sync localPlan when a new candidate arrives or is cleared
watch(
  () => planStore.planCandidate,
  (candidate, prevCandidate) => {
    if (candidate && !prevCandidate) {
      // New candidate – take a deep copy so local edits don't mutate the store directly
      localPlan.value = JSON.parse(JSON.stringify(candidate.plan))
    } else if (!candidate) {
      localPlan.value = null
    }
  },
  { immediate: true }
)

// Computed states
const hasSavedPlan = computed(() => props.trip.plan_json !== null)
const hasCandidate = computed(() => planStore.hasCandidate)
const isGenerating = computed(() => planStore.isGenerating)
const isSaving = computed(() => planStore.isSaving)
const generationError = computed(() => planStore.generationError)
const saveError = computed(() => planStore.saveError)

// Quota information
const quotaExceeded = computed(() => quotaStore.isQuotaExceeded)
const quota = computed(() => quotaStore.quota)

// Can generate check
const canGenerate = computed(
  () => !quotaExceeded.value && !isGenerating.value && !props.isNoteOverLimit
)

// Days to display (local editable copy for candidate, saved plan otherwise)
const planDays = computed(() => {
  if (hasCandidate.value && localPlan.value) return localPlan.value.days
  return props.trip.plan_json?.days ?? []
})

const hasPlan = computed(() => hasSavedPlan.value || hasCandidate.value)

// Color class for the quota progress bar fill
const quotaBarColor = computed(() => {
  const used = quota.value?.used ?? 0
  const limit = quota.value?.limit ?? 10
  if (used >= limit) return 'bg-destructive'
  if (used >= 8) return 'bg-amber-500'
  return 'bg-green-500'
})

const quotaPercentage = computed(() => {
  if (!quota.value) return 0
  return Math.min(100, (quota.value.used / quota.value.limit) * 100)
})

// Actions
async function handleGenerate() {
  try {
    await planStore.generatePlan(props.trip.id)
    await quotaStore.fetchQuota() // Refresh quota counter after generation
  } catch (error) {
    console.error('Failed to generate plan:', error)
  }
}

async function handleSave() {
  try {
    await planStore.savePlanToTrip(props.trip.id)
    toast({ title: 'Plan saved', description: 'Your itinerary has been confirmed.' })
  } catch {
    // saveError reactive state is set by the store; no extra handling needed here
  }
}

function handleDiscard() {
  if (window.confirm('Are you sure? This plan will be lost.')) {
    planStore.discardCandidate()
  }
}

// Update a single field on a candidate activity and sync to the store
function updateActivityField(
  dayIndex: number,
  actIndex: number,
  field: keyof Pick<Activity, 'locationName' | 'description'>,
  value: string
) {
  if (!localPlan.value) return
  localPlan.value.days[dayIndex].activities[actIndex][field] = value
  planStore.updateCandidatePlan(JSON.parse(JSON.stringify(localPlan.value)))
}

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  if (diffSeconds < 60) return 'just now'
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

// Format reset date as relative time
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
      <div class="flex items-start justify-between gap-4">
        <div>
          <CardTitle>Travel Plan</CardTitle>
          <CardDescription>AI-generated day-by-day itinerary</CardDescription>
        </div>
        <!-- Generation Quota Counter -->
        <div v-if="quota" class="w-40 space-y-1" aria-live="polite">
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span>{{ quota.used }} / {{ quota.limit }} used</span>
            <span v-if="quotaExceeded" class="text-destructive">
              Resets in {{ formatResetDate(quota.reset_at) }}
            </span>
          </div>
          <div class="relative h-2 w-full overflow-hidden rounded-full bg-primary/20">
            <div
              class="h-full transition-all"
              :class="quotaBarColor"
              :style="`width: ${quotaPercentage}%`"
            />
          </div>
        </div>
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

      <!-- Generation Error -->
      <Alert v-if="generationError" variant="destructive">
        <AlertCircle class="h-4 w-4" />
        <AlertTitle>Generation Failed</AlertTitle>
        <AlertDescription>
          {{ generationError.error.message }}
        </AlertDescription>
      </Alert>

      <!-- Save Error -->
      <Alert v-if="saveError" variant="destructive">
        <AlertCircle class="h-4 w-4" />
        <AlertTitle>Save Failed</AlertTitle>
        <AlertDescription>
          {{ saveError.error.message }}
        </AlertDescription>
      </Alert>

      <!-- Empty state: no plan and no candidate -->
      <div v-if="!hasPlan" class="flex flex-col items-center justify-center py-12">
        <Sparkles class="mb-4 h-12 w-12 text-muted-foreground" />
        <p class="mb-4 text-center text-muted-foreground">
          No plan generated yet. Click below to create your personalized travel itinerary.
        </p>
        <!-- Pre-generation checklist when destination is missing -->
        <div
          v-if="!destination"
          class="mb-6 w-full rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30"
        >
          <p class="mb-1 font-medium text-amber-800 dark:text-amber-300">Before generating:</p>
          <ul class="space-y-1 text-amber-700 dark:text-amber-400">
            <li class="flex items-center gap-2">
              <span class="text-destructive">✗</span> Add a destination (required)
            </li>
          </ul>
        </div>
        <Button :disabled="!canGenerate" size="lg" @click="handleGenerate">
          <Sparkles v-if="!isGenerating" class="mr-2 h-4 w-4" />
          <Loader2 v-else class="mr-2 h-4 w-4 animate-spin" />
          {{ isGenerating ? 'Generating...' : 'Generate Plan' }}
        </Button>
      </div>

      <!-- Unsaved Plan Candidate Banner -->
      <Alert
        v-if="hasCandidate"
        variant="destructive"
        class="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400"
      >
        <AlertTriangle class="h-4 w-4" />
        <AlertTitle>Unsaved Plan</AlertTitle>
        <AlertDescription>
          You have a generated plan that hasn't been saved. It will be lost if you leave this page.
        </AlertDescription>
      </Alert>

      <!-- Candidate Actions -->
      <div v-if="hasCandidate" class="flex gap-2">
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

      <!-- Plan Display (Candidate or Saved) -->
      <div v-if="hasPlan" class="space-y-4">
        <Separator v-if="hasCandidate" />

        <!-- Saved Plan Banner + Regenerate -->
        <div v-if="hasSavedPlan && !hasCandidate" class="space-y-2">
          <Alert
            class="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300 [&>svg]:text-green-600 dark:[&>svg]:text-green-400"
          >
            <Check class="h-4 w-4" />
            <AlertTitle>Plan saved</AlertTitle>
            <AlertDescription>
              Last updated {{ formatRelativeTime(trip.updated_at) }}
            </AlertDescription>
          </Alert>
          <div class="flex justify-end">
            <Button :disabled="!canGenerate" variant="outline" size="sm" @click="handleGenerate">
              <Sparkles v-if="!isGenerating" class="mr-2 h-4 w-4" />
              <Loader2 v-else class="mr-2 h-4 w-4 animate-spin" />
              {{ isGenerating ? 'Generating...' : 'Regenerate' }}
            </Button>
          </div>
        </div>

        <!-- Generating Loading State -->
        <div v-if="isGenerating" class="flex items-center justify-center py-8">
          <Loader2 class="mr-2 h-6 w-6 animate-spin text-muted-foreground" />
          <span class="text-muted-foreground">Generating your plan…</span>
        </div>

        <!-- Days Accordion -->
        <Accordion v-else-if="planDays.length" type="single" collapsible default-value="day-1">
          <AccordionItem
            v-for="(day, dayIndex) in planDays"
            :key="day.day"
            :value="`day-${day.day}`"
          >
            <AccordionTrigger>
              <span class="flex items-center gap-2">
                <Calendar class="h-4 w-4 text-primary" />
                Day {{ day.day }}
                <span class="text-xs font-normal text-muted-foreground">
                  — {{ day.activities.length }}
                  {{ day.activities.length === 1 ? 'activity' : 'activities' }}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div class="space-y-3">
                <div
                  v-for="(activity, actIndex) in day.activities"
                  :key="actIndex"
                  class="border-l-2 pl-4"
                  :class="hasCandidate ? 'border-amber-300' : 'border-muted'"
                >
                  <div class="flex items-start gap-3">
                    <Badge variant="outline" class="mt-1 shrink-0 text-xs">
                      {{ activity.timeOfDay }}
                    </Badge>
                    <div class="min-w-0 flex-1 space-y-2">
                      <!-- Editable fields in candidate mode -->
                      <template v-if="hasCandidate">
                        <Input
                          :value="activity.locationName"
                          class="font-medium"
                          placeholder="Location name"
                          @change="
                            updateActivityField(
                              dayIndex,
                              actIndex,
                              'locationName',
                              ($event.target as HTMLInputElement).value
                            )
                          "
                        />
                        <Textarea
                          :value="activity.description"
                          class="min-h-[60px] resize-none text-sm text-muted-foreground"
                          placeholder="Activity description"
                          @change="
                            updateActivityField(
                              dayIndex,
                              actIndex,
                              'description',
                              ($event.target as HTMLTextAreaElement).value
                            )
                          "
                        />
                      </template>
                      <!-- Read-only in saved mode -->
                      <template v-else>
                        <h4 class="font-medium">{{ activity.locationName }}</h4>
                        <p class="text-sm text-muted-foreground">{{ activity.description }}</p>
                      </template>
                      <Badge variant="secondary" class="text-xs">
                        {{ activity.categoryTag.replace('_', ' ') }}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </CardContent>
  </Card>
</template>

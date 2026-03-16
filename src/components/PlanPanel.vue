<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlanStore } from '@/stores/plan.store'
import { useQuotaStore } from '@/stores/quota.store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Loader2,
  Sparkles,
  Check,
  X,
  AlertCircle,
  AlertTriangle,
  Clock,
  Calendar,
  Sunrise,
  Sun,
  Moon
} from 'lucide-vue-next'
import { useToast } from '@/components/ui/toast/use-toast'
import type { TripDTO, PlanJson, Activity } from '@/types'
import { isFeatureEnabled } from '@/lib/features/flags'

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
const { t } = useI18n()

const isPlanGenerationEnabled = isFeatureEnabled('plan-generation')

// Local editable copy of the candidate plan (in-memory, not yet saved)
const localPlan = ref<PlanJson | null>(null)

// Sync localPlan when a new candidate arrives or is cleared
watch(
  () => planStore.planCandidate,
  (candidate, prevCandidate) => {
    if (candidate && !prevCandidate) {
      // New candidate – take a deep copy so local edits don't mutate the store directly
      localPlan.value = JSON.parse(JSON.stringify(candidate.plan))
      // Auto-resize all textareas after the DOM updates
      nextTick(() => {
        document
          .querySelectorAll<HTMLTextAreaElement>('.plan-description-textarea')
          .forEach(fitTextarea)
      })
    } else if (!candidate) {
      localPlan.value = null
    }
  },
  { immediate: true }
)

function fitTextarea(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

function handleDescriptionInput(event: Event, dayIndex: number, actIndex: number) {
  const el = event.target as HTMLTextAreaElement
  fitTextarea(el)
  updateActivityField(dayIndex, actIndex, 'description', el.value)
}

// Computed states
const hasSavedPlan = computed(() => props.trip.plan_json !== null)
const hasCandidate = computed(() => planStore.hasCandidate)
const isGenerating = computed(() => planStore.isGenerating)
const isSaving = computed(() => planStore.isSaving)
const generationError = computed(() => planStore.generationError)
const saveError = computed(() => planStore.saveError)

const generationErrorMessage = computed(() => {
  const err = generationError.value
  if (!err) return ''
  if (err.error.code === 'AI_API_ERROR') return t('plan.errors.aiApiError')
  if (err.error.code === 'VALIDATION_ERROR') {
    const field = (err.error.details as Record<string, unknown> | undefined)?.field
    if (field === 'destination') return t('plan.errors.destinationRequired')
    if (field === 'note_body') return t('plan.errors.noteTooLong')
  }
  return t('plan.errors.generic')
})

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
    toast({ title: t('plan.toast.saved'), description: t('plan.toast.savedDesc') })
  } catch {
    // saveError reactive state is set by the store; no extra handling needed here
  }
}

function handleDiscard() {
  planStore.discardCandidate()
}

// Update a single field on a candidate activity and sync to the store
function updateActivityField(
  dayIndex: number,
  actIndex: number,
  field: keyof Pick<Activity, 'locationName' | 'description'>,
  value: string
) {
  if (!localPlan.value) return
  localPlan.value.days[dayIndex]!.activities[actIndex]![field] = value
  planStore.updateCandidatePlan(JSON.parse(JSON.stringify(localPlan.value)))
}

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  if (diffSeconds < 60) return t('relativeTime.justNow')
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return t('relativeTime.minutesAgo', { n: diffMinutes })
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return t('relativeTime.hoursAgo', { n: diffHours })
  const diffDays = Math.floor(diffHours / 24)
  return t('relativeTime.daysAgoShort', { n: diffDays })
}

// Format reset date as relative time
function formatResetDate(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60))

  if (diffHours < 1) return t('plan.resetLessThanHour')
  if (diffHours === 1) return t('plan.resetOneHour')
  return t('plan.resetHours', { n: diffHours })
}
</script>

<template>
  <Card>
    <!-- Feature disabled state -->
    <CardContent
      v-if="!isPlanGenerationEnabled"
      class="flex flex-col items-center justify-center py-12"
    >
      <Sparkles class="mb-4 h-12 w-12 text-muted-foreground" />
      <p class="text-center text-muted-foreground">{{ t('plan.featureDisabled') }}</p>
    </CardContent>

    <template v-else>
      <CardHeader>
        <div class="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{{ t('plan.title') }}</CardTitle>
            <CardDescription>{{ t('plan.description') }}</CardDescription>
          </div>
          <!-- Generation Quota Counter -->
          <div v-if="quota" class="w-40 space-y-1" aria-live="polite">
            <span class="text-xs text-muted-foreground">
              {{
                t('plan.quotaUsed', { used: Math.min(quota.used, quota.limit), limit: quota.limit })
              }}
            </span>
            <div class="relative h-2 w-full overflow-hidden rounded-full bg-primary/20">
              <div class="h-full bg-primary transition-all" :style="`width: ${quotaPercentage}%`" />
            </div>
            <div v-if="quotaExceeded" class="flex justify-end">
              <span class="text-xs text-destructive">
                {{ t('plan.resetsIn', { time: formatResetDate(quota.reset_at) }) }}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent class="space-y-4">
        <!-- Quota Exceeded Warning -->
        <Alert v-if="quotaExceeded" variant="destructive">
          <AlertCircle class="h-4 w-4" />
          <AlertTitle>{{ t('plan.quotaExceededTitle') }}</AlertTitle>
          <AlertDescription>
            {{
              t('plan.quotaExceededDesc', {
                limit: quota?.limit,
                time: quota ? formatResetDate(quota.reset_at) : 'N/A'
              })
            }}
          </AlertDescription>
        </Alert>

        <!-- Generation Error -->
        <Alert v-if="generationError" variant="destructive">
          <AlertCircle class="h-4 w-4" />
          <AlertTitle>{{ t('plan.generationFailedTitle') }}</AlertTitle>
          <AlertDescription>{{ generationErrorMessage }}</AlertDescription>
        </Alert>

        <!-- Save Error -->
        <Alert v-if="saveError" variant="destructive">
          <AlertCircle class="h-4 w-4" />
          <AlertTitle>{{ t('plan.saveFailedTitle') }}</AlertTitle>
          <AlertDescription>{{ saveError.error.message }}</AlertDescription>
        </Alert>

        <!-- Empty state: no plan and no candidate -->
        <div v-if="!hasPlan" class="flex flex-col items-center justify-center py-12">
          <Sparkles class="mb-4 h-12 w-12 text-muted-foreground" />
          <p class="mb-4 text-center text-muted-foreground">{{ t('plan.noPlanText') }}</p>
          <!-- Pre-generation checklist when destination is missing -->
          <div
            v-if="!destination"
            class="mb-6 w-full rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30"
          >
            <p class="mb-1 font-medium text-amber-800 dark:text-amber-300">
              {{ t('plan.beforeGenerating') }}
            </p>
            <ul class="space-y-1 text-amber-700 dark:text-amber-400">
              <li class="flex items-center gap-2">
                <span class="text-destructive">✗</span> {{ t('plan.addDestination') }}
              </li>
            </ul>
          </div>
          <Button
            data-testid="generate-plan-btn"
            :disabled="!canGenerate"
            size="lg"
            @click="handleGenerate"
          >
            <Sparkles v-if="!isGenerating" class="mr-2 h-4 w-4" />
            <Loader2 v-else class="mr-2 h-4 w-4 animate-spin" />
            {{ isGenerating ? t('plan.generating') : t('plan.generate') }}
          </Button>
        </div>

        <!-- Unsaved Plan Candidate Banner -->
        <Alert
          v-if="hasCandidate"
          class="border-primary/30 bg-primary/10 text-foreground [&>svg]:text-primary"
        >
          <AlertTriangle class="h-4 w-4" />
          <AlertTitle>{{ t('plan.unsavedTitle') }}</AlertTitle>
          <AlertDescription>{{ t('plan.unsavedDesc') }}</AlertDescription>
        </Alert>

        <!-- Candidate Actions -->
        <div v-if="hasCandidate" class="flex gap-2">
          <Button
            data-testid="save-plan-btn"
            :disabled="isSaving || isGenerating"
            class="flex-1"
            @click="handleSave"
          >
            <Check v-if="!isSaving" class="mr-2 h-4 w-4" />
            <Loader2 v-else class="mr-2 h-4 w-4 animate-spin" />
            {{ isSaving ? t('plan.saving') : t('plan.save') }}
          </Button>
          <Button
            data-testid="discard-plan-btn"
            variant="outline"
            :disabled="isSaving || isGenerating"
            class="flex-1"
            @click="handleDiscard"
          >
            <X class="mr-2 h-4 w-4" />
            {{ t('plan.discard') }}
          </Button>
        </div>

        <!-- Plan Display (Candidate or Saved) -->
        <div v-if="hasPlan" class="space-y-4">
          <Separator v-if="hasCandidate" />

          <!-- Saved Plan Banner + Regenerate -->
          <div v-if="hasSavedPlan && !hasCandidate" class="space-y-2">
            <Alert class="border-primary/30 bg-primary/10 text-foreground [&>svg]:text-primary">
              <Check class="h-4 w-4" />
              <AlertTitle class="text-primary">{{ t('plan.savedTitle') }}</AlertTitle>
              <AlertDescription>
                {{ t('plan.savedUpdatedAt', { time: formatRelativeTime(trip.updated_at) }) }}
              </AlertDescription>
            </Alert>
            <div class="flex justify-end">
              <Button
                data-testid="regenerate-plan-btn"
                :disabled="!canGenerate"
                variant="outline"
                size="sm"
                @click="handleGenerate"
              >
                <Sparkles v-if="!isGenerating" class="mr-2 h-4 w-4" />
                <Loader2 v-else class="mr-2 h-4 w-4 animate-spin" />
                {{ isGenerating ? t('plan.regenerating') : t('plan.regenerate') }}
              </Button>
            </div>
          </div>

          <!-- Generating Loading State -->
          <div v-if="isGenerating" class="space-y-4">
            <div class="flex items-center justify-center py-8">
              <Loader2 class="mr-2 h-6 w-6 animate-spin text-muted-foreground" />
              <span class="text-muted-foreground">{{ t('plan.generatingSpinner') }}</span>
            </div>
            <Alert
              class="border-amber-200 bg-amber-50 text-foreground dark:border-amber-800 dark:bg-amber-950/30 [&>svg]:text-amber-600"
            >
              <Clock class="h-4 w-4" />
              <AlertTitle class="text-amber-800 dark:text-amber-300">{{
                t('plan.patienceTitle')
              }}</AlertTitle>
              <AlertDescription class="text-amber-700 dark:text-amber-400">{{
                t('plan.patienceDesc')
              }}</AlertDescription>
            </Alert>
          </div>

          <!-- Days Cards -->
          <div v-else-if="planDays.length" class="space-y-6">
            <div
              v-for="(day, dayIndex) in planDays"
              :key="day.day"
              class="overflow-hidden rounded-xl border bg-card shadow-sm"
            >
              <!-- Day header -->
              <div class="flex items-center gap-3 border-b bg-muted/40 px-5 py-3">
                <Calendar class="h-4 w-4 text-primary" />
                <span class="font-semibold">{{ t('plan.day', { n: day.day }) }}</span>
                <span class="text-xs text-muted-foreground">
                  {{ t('plan.activities', { count: day.activities.length }) }}
                </span>
              </div>

              <!-- Activities -->
              <div class="divide-y">
                <div
                  v-for="(activity, actIndex) in day.activities"
                  :key="actIndex"
                  class="px-5 py-4"
                >
                  <!-- Time of day label -->
                  <div class="mb-3 flex items-center gap-2">
                    <Sunrise v-if="activity.timeOfDay === 'morning'" class="h-4 w-4 text-primary" />
                    <Sun
                      v-else-if="activity.timeOfDay === 'afternoon'"
                      class="h-4 w-4 text-primary"
                    />
                    <Moon v-else class="h-4 w-4 text-primary" />
                    <span class="text-xs font-semibold uppercase tracking-widest text-primary">
                      {{ t(`plan.timeOfDay.${activity.timeOfDay}`) }}
                    </span>
                  </div>

                  <!-- Editable fields in candidate mode -->
                  <template v-if="hasCandidate">
                    <Input
                      :model-value="activity.locationName"
                      :disabled="isGenerating"
                      class="mb-2 border-0 bg-transparent p-0 font-semibold shadow-none focus-visible:ring-0"
                      :placeholder="t('plan.locationPlaceholder')"
                      @update:model-value="
                        updateActivityField(dayIndex, actIndex, 'locationName', String($event))
                      "
                    />
                    <textarea
                      :value="activity.description"
                      :disabled="isGenerating"
                      class="plan-description-textarea mb-3 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-sm leading-relaxed text-muted-foreground outline-none focus:outline-none"
                      :placeholder="t('plan.descriptionPlaceholder')"
                      rows="1"
                      @input="handleDescriptionInput($event, dayIndex, actIndex)"
                    />
                  </template>
                  <!-- Read-only in saved mode -->
                  <template v-else>
                    <h4 class="mb-1 font-semibold leading-snug">{{ activity.locationName }}</h4>
                    <p class="mb-3 text-sm leading-relaxed text-muted-foreground">
                      {{ activity.description }}
                    </p>
                  </template>

                  <Badge
                    variant="secondary"
                    class="border-primary/30 bg-primary/10 text-xs capitalize"
                  >
                    {{ activity.categoryTag.replace('_', ' ') }}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </template>
  </Card>
</template>

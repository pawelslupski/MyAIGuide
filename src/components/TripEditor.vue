<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type {
  TripDTO,
  ProfileDTO,
  TripPreferencesDto,
  WhatPreference,
  SpeedPreference,
  TypePreference,
  BudgetPreference
} from '@/types'

interface Props {
  trip: TripDTO
  defaultPreferences?: TripPreferencesDto
  profile?: ProfileDTO | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:fields': [
    fields: {
      destination: string | null
      note_body: string | null
      what: WhatPreference[]
      speed: SpeedPreference | null
      type: TypePreference | null
      budget: BudgetPreference | null
      num_days: number | null
      num_people: number | null
    }
  ]
  'blur:note': []
}>()

// Local state for immediate UI updates
// For preference fields, fall back to profile defaults when the trip has no value
const localDestination = ref(props.trip.destination ?? '')
const localNote = ref(props.trip.note_body ?? '')
const localWhat = ref<WhatPreference[]>(
  ((props.trip.what?.length ? props.trip.what : props.defaultPreferences?.what) ??
    []) as WhatPreference[]
)
const localSpeed = ref<SpeedPreference | null>(
  (props.trip.speed ?? props.defaultPreferences?.speed ?? null) as SpeedPreference | null
)
const localType = ref<TypePreference | null>(
  (props.trip.type ?? props.defaultPreferences?.type ?? null) as TypePreference | null
)
const localBudget = ref<BudgetPreference | null>(
  (props.trip.budget ?? props.defaultPreferences?.budget ?? null) as BudgetPreference | null
)
const localNumDays = ref<number | null>(props.trip.num_days ?? null)
const localNumPeople = ref<number | null>(props.trip.num_people ?? null)

// Character count validation
const MAX_NOTE_LENGTH = 10000
const WARN_NOTE_LENGTH = 9000

const noteLength = computed(() => localNote.value.length)

const noteValidationMessage = computed(() => {
  if (noteLength.value > MAX_NOTE_LENGTH) {
    return `Maximum ${MAX_NOTE_LENGTH.toLocaleString()} characters exceeded`
  }
  if (noteLength.value > WARN_NOTE_LENGTH) {
    return 'Approaching character limit'
  }
  return null
})

const noteValidationClass = computed(() => {
  if (noteLength.value > MAX_NOTE_LENGTH) return 'text-destructive'
  if (noteLength.value > WARN_NOTE_LENGTH) return 'text-amber-600 dark:text-amber-400'
  return 'text-muted-foreground'
})

const noteCounterClass = computed(() => {
  if (noteLength.value > MAX_NOTE_LENGTH) return 'text-destructive'
  if (noteLength.value > WARN_NOTE_LENGTH) return 'text-amber-600 dark:text-amber-400'
  return 'text-muted-foreground'
})

// Preference options
const whatOptions: { value: WhatPreference; label: string }[] = [
  { value: 'nature', label: 'Nature & Outdoors' },
  { value: 'beach_relax', label: 'Beach & Relaxation' },
  { value: 'culture_museums', label: 'Culture & Museums' },
  { value: 'city_break', label: 'City Break' },
  { value: 'foodie', label: 'Foodie Experience' }
]

const speedOptions: { value: SpeedPreference; label: string; description: string }[] = [
  {
    value: 'slow_chill',
    label: 'Slow & Chill',
    description: 'Relaxed pace with plenty of downtime'
  },
  { value: 'balance', label: 'Balanced', description: 'Mix of activities and relaxation' },
  { value: 'intensive', label: 'Intensive', description: 'Packed schedule with many activities' }
]

const typeOptions: { value: TypePreference; label: string; description: string }[] = [
  { value: 'base', label: 'Base', description: 'Stay in one location' },
  {
    value: 'base_with_trips',
    label: 'Base with optional trips',
    description: 'Stay in one location with day trips'
  },
  { value: 'roadtrip', label: 'Road trip', description: 'Travel between multiple locations' }
]

const budgetOptions: { value: BudgetPreference; label: string; description: string }[] = [
  { value: 'budget', label: 'Budget', description: 'Cost-effective options' },
  { value: 'moderate', label: 'Moderate', description: 'Balanced comfort and cost' },
  { value: 'luxury', label: 'Luxury', description: 'Premium experiences' }
]

// Emit current local state to parent whenever anything changes
function emitFields() {
  emit('update:fields', {
    destination: localDestination.value.trim() || null,
    note_body: localNote.value.trim() || null,
    what: localWhat.value,
    speed: localSpeed.value,
    type: localType.value,
    budget: localBudget.value,
    num_days: localNumDays.value,
    num_people: localNumPeople.value
  })
}

watch(
  [
    localDestination,
    localNote,
    localWhat,
    localSpeed,
    localType,
    localBudget,
    localNumDays,
    localNumPeople
  ],
  emitFields,
  { deep: true }
)

// Emit initial state to parent so pendingFields reflects profile-prepopulated values from the start
onMounted(() => {
  emitFields()
})

// Toggle what preference (multi-select)
function toggleWhat(value: WhatPreference) {
  const index = localWhat.value.indexOf(value)
  if (index > -1) {
    localWhat.value = localWhat.value.filter((v) => v !== value)
  } else {
    localWhat.value = [...localWhat.value, value]
  }
}

// Check if the current (local) preference value still matches the profile default.
// Compares local state so the badge disappears immediately when the user changes the selection.
function isInherited(field: 'speed' | 'type' | 'budget'): boolean {
  if (!props.defaultPreferences) return false
  const profileValue = props.defaultPreferences[field]
  if (!profileValue) return false
  const localValue =
    field === 'speed' ? localSpeed.value : field === 'type' ? localType.value : localBudget.value
  return localValue === profileValue
}

// True when the current what selection matches the profile default (order-independent).
const isWhatInherited = computed(() => {
  const profileWhat = props.defaultPreferences?.what
  if (!profileWhat?.length) return false
  if (localWhat.value.length !== profileWhat.length) return false
  const sorted = (arr: WhatPreference[]) => [...arr].sort().join(',')
  return sorted(localWhat.value) === sorted(profileWhat)
})

// Handlers for number inputs (convert NaN from empty field → null)
function handleNumDaysChange(e: any) {
  const val = e.target.valueAsNumber
  localNumDays.value = Number.isNaN(val) ? null : val
}

function handleNumPeopleChange(e: any) {
  const val = e.target.valueAsNumber
  localNumPeople.value = Number.isNaN(val) ? null : val
}

// Apply profile defaults when defaultPreferences arrives or changes (e.g. profile loaded after mount)
watch(
  () => props.defaultPreferences,
  (newDefaults) => {
    if (!newDefaults) return
    if (!props.trip.what?.length) {
      localWhat.value = [...(newDefaults.what ?? [])] as WhatPreference[]
    }
    if (!props.trip.speed) {
      localSpeed.value = (newDefaults.speed ?? null) as SpeedPreference | null
    }
    if (!props.trip.type) {
      localType.value = (newDefaults.type ?? null) as TypePreference | null
    }
    if (!props.trip.budget) {
      localBudget.value = (newDefaults.budget ?? null) as BudgetPreference | null
    }
  },
  { deep: true }
)

// Sync local state when the saved trip changes externally (e.g. after successful save)
watch(
  () => props.trip,
  (newTrip) => {
    localDestination.value = newTrip.destination ?? ''
    localNote.value = newTrip.note_body ?? ''
    localWhat.value = ((newTrip.what?.length ? newTrip.what : props.defaultPreferences?.what) ??
      []) as WhatPreference[]
    localSpeed.value = (newTrip.speed ??
      props.defaultPreferences?.speed ??
      null) as SpeedPreference | null
    localType.value = (newTrip.type ??
      props.defaultPreferences?.type ??
      null) as TypePreference | null
    localBudget.value = (newTrip.budget ??
      props.defaultPreferences?.budget ??
      null) as BudgetPreference | null
    localNumDays.value = newTrip.num_days ?? null
    localNumPeople.value = newTrip.num_people ?? null
  },
  { deep: true }
)
</script>

<template>
  <TooltipProvider>
    <div class="space-y-6">
      <!-- Destination -->
      <div class="space-y-2">
        <Label for="trip-destination">Destination</Label>
        <Input
          id="trip-destination"
          v-model="localDestination"
          placeholder="e.g. Paris, France"
          maxlength="50"
        />
      </div>

      <!-- Trip Preferences -->
      <Card>
        <CardHeader>
          <CardTitle>Trip Preferences</CardTitle>
          <CardDescription
            >Customize your trip preferences or use defaults from your profile</CardDescription
          >
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Trip Duration -->
          <div class="space-y-2">
            <Label for="num-days">Trip Duration (days)</Label>
            <Input
              id="num-days"
              :value="localNumDays ?? undefined"
              type="number"
              min="1"
              max="30"
              placeholder="e.g. 7"
              class="w-32"
              @change="handleNumDaysChange"
            />
          </div>

          <!-- Number of People -->
          <div class="space-y-2">
            <Label for="num-people">Number of People</Label>
            <Input
              id="num-people"
              :value="localNumPeople ?? undefined"
              type="number"
              min="1"
              max="20"
              placeholder="e.g. 2"
              class="w-32"
              @change="handleNumPeopleChange"
            />
          </div>

          <!-- What Preferences (Multi-select) -->
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <Label>What interests you?</Label>
              <Tooltip v-if="isWhatInherited">
                <TooltipTrigger as-child>
                  <Badge variant="outline" class="cursor-default text-xs">From profile</Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This value is inherited from your profile preferences</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div class="space-y-2">
              <div
                v-for="option in whatOptions"
                :key="option.value"
                class="flex items-center space-x-2"
              >
                <Checkbox
                  :id="`what-${option.value}`"
                  :model-value="localWhat.includes(option.value)"
                  @update:model-value="toggleWhat(option.value)"
                />
                <Label :for="`what-${option.value}`" class="cursor-pointer text-sm font-normal">
                  {{ option.label }}
                </Label>
              </div>
            </div>
          </div>

          <!-- Speed Preference (Radio) -->
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <Label>Travel Speed</Label>
              <Tooltip v-if="isInherited('speed')">
                <TooltipTrigger as-child>
                  <Badge variant="outline" class="cursor-default text-xs">From profile</Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This value is inherited from your profile preferences</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <RadioGroup v-model="localSpeed">
              <div
                v-for="option in speedOptions"
                :key="option.value"
                class="flex items-center space-x-2"
              >
                <RadioGroupItem :id="`speed-${option.value}`" :value="option.value" />
                <Label :for="`speed-${option.value}`" class="cursor-pointer font-normal">
                  <div>
                    <div class="font-medium">{{ option.label }}</div>
                    <div class="text-xs text-muted-foreground">{{ option.description }}</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <!-- Type Preference (Radio) -->
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <Label>Trip Type</Label>
              <Tooltip v-if="isInherited('type')">
                <TooltipTrigger as-child>
                  <Badge variant="outline" class="cursor-default text-xs">From profile</Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This value is inherited from your profile preferences</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <RadioGroup v-model="localType">
              <div
                v-for="option in typeOptions"
                :key="option.value"
                class="flex items-center space-x-2"
              >
                <RadioGroupItem :id="`type-${option.value}`" :value="option.value" />
                <Label :for="`type-${option.value}`" class="cursor-pointer font-normal">
                  <div>
                    <div class="font-medium">{{ option.label }}</div>
                    <div class="text-xs text-muted-foreground">{{ option.description }}</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <!-- Budget Preference (Radio) -->
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <Label>Budget</Label>
              <Tooltip v-if="isInherited('budget')">
                <TooltipTrigger as-child>
                  <Badge variant="outline" class="cursor-default text-xs">From profile</Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This value is inherited from your profile preferences</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <RadioGroup v-model="localBudget">
              <div
                v-for="option in budgetOptions"
                :key="option.value"
                class="flex items-center space-x-2"
              >
                <RadioGroupItem :id="`budget-${option.value}`" :value="option.value" />
                <Label :for="`budget-${option.value}`" class="cursor-pointer font-normal">
                  <div>
                    <div class="font-medium">{{ option.label }}</div>
                    <div class="text-xs text-muted-foreground">{{ option.description }}</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>
          <!-- Traveler Profile Flags (read-only, from global profile) -->
          <div v-if="profile" class="space-y-2">
            <Label class="text-muted-foreground"
              >Traveler profile (from your profile settings)</Label
            >
            <div class="flex flex-wrap gap-2 text-sm">
              <Badge v-if="profile.has_kids" variant="outline">Traveling with kids</Badge>
              <Badge v-if="profile.has_pets" variant="outline">Traveling with pets</Badge>
              <Badge v-if="profile.has_mobility_issues" variant="outline"
                >Mobility considerations</Badge
              >
              <Badge v-if="profile.has_dietary_preferences" variant="outline"
                >Dietary preferences</Badge
              >
              <span
                v-if="
                  !profile.has_kids &&
                  !profile.has_pets &&
                  !profile.has_mobility_issues &&
                  !profile.has_dietary_preferences
                "
                class="text-muted-foreground"
                >No special traveler flags set</span
              >
            </div>
            <p
              v-if="profile.has_dietary_preferences && profile.dietary_preferences_description"
              class="text-xs text-muted-foreground"
            >
              Dietary: {{ profile.dietary_preferences_description }}
            </p>
          </div>
        </CardContent>
      </Card>

      <!-- Trip Note -->
      <Card>
        <CardHeader>
          <CardTitle>Trip Notes</CardTitle>
          <CardDescription
            >Describe your trip plans, preferences, and any special requirements</CardDescription
          >
        </CardHeader>
        <CardContent class="space-y-2">
          <Textarea
            v-model="localNote"
            placeholder="Write your trip notes here... (optional)"
            class="min-h-[200px] resize-y"
            aria-label="Trip note content"
            :aria-invalid="noteLength > MAX_NOTE_LENGTH"
            @blur="emit('blur:note')"
          />
          <div class="flex items-center justify-between text-sm">
            <span v-if="noteValidationMessage" :class="noteValidationClass">
              {{ noteValidationMessage }}
            </span>
            <span v-else />
            <span :class="noteCounterClass">
              {{ noteLength.toLocaleString() }} / {{ MAX_NOTE_LENGTH.toLocaleString() }}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  </TooltipProvider>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type {
  TripDTO,
  TripPreferencesDto,
  WhatPreference,
  SpeedPreference,
  TypePreference,
  BudgetPreference
} from '@/types'

/**
 * TripEditor Component
 * Integrated trip editing interface with title, note, and preferences
 * Implements debounced auto-save for note and immediate save for preferences
 */

interface Props {
  trip: TripDTO
  defaultPreferences?: TripPreferencesDto
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:title': [title: string]
  'update:note': [note: string]
  'update:preferences': [preferences: TripPreferencesDto]
}>()

// Local state for immediate UI updates
const localTitle = ref(props.trip.title)
const localNote = ref(props.trip.note_body ?? '')
const localWhat = ref<WhatPreference[]>((props.trip.what ?? []) as WhatPreference[])
const localSpeed = ref<SpeedPreference | null>(props.trip.speed as SpeedPreference | null)
const localType = ref<TypePreference | null>(props.trip.type as TypePreference | null)
const localBudget = ref<BudgetPreference | null>(props.trip.budget as BudgetPreference | null)
const localNumDays = ref<number | null>(props.trip.num_days ?? null)
const localNumPeople = ref<number | null>(props.trip.num_people ?? null)

// Character count validation
const MAX_NOTE_LENGTH = 10000

const noteLength = computed(() => localNote.value.length)
const noteValidationMessage = computed(() => {
  if (noteLength.value > MAX_NOTE_LENGTH) {
    return `Maximum ${MAX_NOTE_LENGTH} characters exceeded (${noteLength.value - MAX_NOTE_LENGTH} over limit)`
  }
  return null
})

const noteValidationClass = computed(() => {
  if (noteLength.value > MAX_NOTE_LENGTH) return 'text-destructive'
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

// Debounced auto-save for note (2 seconds)
const debouncedNoteSave = useDebounceFn(() => {
  emit('update:note', localNote.value)
}, 2000)

// Watch for note changes
watch(localNote, () => {
  debouncedNoteSave()
})

// Immediate save for title
function handleTitleBlur() {
  if (localTitle.value !== props.trip.title) {
    emit('update:title', localTitle.value)
  }
}

// Immediate save for preferences
function handlePreferencesChange() {
  emit('update:preferences', {
    what: localWhat.value,
    speed: localSpeed.value,
    type: localType.value,
    budget: localBudget.value,
    num_days: localNumDays.value,
    num_people: localNumPeople.value
  })
}

// Toggle what preference (multi-select)
function toggleWhat(value: WhatPreference) {
  const index = localWhat.value.indexOf(value)
  if (index > -1) {
    localWhat.value = localWhat.value.filter((v) => v !== value)
  } else {
    localWhat.value = [...localWhat.value, value]
  }
  handlePreferencesChange()
}

// Check if preference is inherited from profile
function isInherited(field: 'speed' | 'type' | 'budget'): boolean {
  if (!props.defaultPreferences) return false
  return props.trip[field] === props.defaultPreferences[field]
}

// Handlers for number inputs (convert NaN from empty field → null)
function handleNumDaysChange(e: any) {
  const val = e.target.valueAsNumber
  localNumDays.value = Number.isNaN(val) ? null : val
  handlePreferencesChange()
}

function handleNumPeopleChange(e: any) {
  const val = e.target.valueAsNumber
  localNumPeople.value = Number.isNaN(val) ? null : val
  handlePreferencesChange()
}

// Sync props changes to local state
watch(
  () => props.trip,
  (newTrip) => {
    localTitle.value = newTrip.title
    localNote.value = newTrip.note_body ?? ''
    localWhat.value = (newTrip.what ?? []) as WhatPreference[]
    localSpeed.value = newTrip.speed as SpeedPreference | null
    localType.value = newTrip.type as TypePreference | null
    localBudget.value = newTrip.budget as BudgetPreference | null
    localNumDays.value = newTrip.num_days ?? null
    localNumPeople.value = newTrip.num_people ?? null
  },
  { deep: true }
)
</script>

<template>
  <div class="space-y-6">
    <!-- Trip Title -->
    <div class="space-y-2">
      <Label for="trip-title">Trip Title</Label>
      <div class="flex items-center gap-2">
        <Input
          id="trip-title"
          v-model="localTitle"
          placeholder="Enter trip title"
          class="flex-1"
          @blur="handleTitleBlur"
        />
        <Badge
          :variant="
            trip.status === 'CONFIRMED'
              ? 'default'
              : trip.status === 'DRAFT'
                ? 'secondary'
                : 'outline'
          "
        >
          {{ trip.status }}
        </Badge>
      </div>
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
          <Label>What interests you?</Label>
          <div class="space-y-2">
            <div
              v-for="option in whatOptions"
              :key="option.value"
              class="flex items-center space-x-2"
            >
              <Checkbox
                :id="`what-${option.value}`"
                :checked="localWhat.includes(option.value)"
                @update:checked="toggleWhat(option.value)"
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
            <Badge v-if="isInherited('speed')" variant="outline" class="text-xs">
              From profile
            </Badge>
          </div>
          <RadioGroup v-model="localSpeed" @update:model-value="handlePreferencesChange">
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
            <Badge v-if="isInherited('type')" variant="outline" class="text-xs">
              From profile
            </Badge>
          </div>
          <RadioGroup v-model="localType" @update:model-value="handlePreferencesChange">
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
            <Badge v-if="isInherited('budget')" variant="outline" class="text-xs">
              From profile
            </Badge>
          </div>
          <RadioGroup v-model="localBudget" @update:model-value="handlePreferencesChange">
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
          :maxlength="MAX_NOTE_LENGTH"
        />
        <div class="flex items-center justify-between text-sm">
          <span v-if="noteValidationMessage" :class="noteValidationClass">
            {{ noteValidationMessage }}
          </span>
          <span v-else />
          <span class="text-muted-foreground">
            {{ noteLength.toLocaleString() }} / {{ MAX_NOTE_LENGTH.toLocaleString() }}
          </span>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
>

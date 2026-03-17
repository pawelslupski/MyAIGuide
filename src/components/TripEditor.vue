<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
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
import {
  useTripEditorFields,
  type TripEditorFields,
  WARN_NOTE_LENGTH
} from '@/composables/useTripEditorFields'

interface Props {
  trip: TripDTO
  defaultPreferences?: TripPreferencesDto
  profile?: ProfileDTO | null
  noteLanguageMismatch?: boolean
  isGenerating?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:fields': [fields: TripEditorFields]
  'blur:note': []
  'blur:destination': []
}>()

const { t } = useI18n()

const {
  localDestination,
  localNote,
  localWhat,
  localSpeed,
  localType,
  localBudget,
  localNumDays,
  localNumPeople,
  noteLength,
  noteValidationClass,
  noteCounterClass,
  MAX_NOTE_LENGTH,
  NUM_DAYS_MAX,
  NUM_PEOPLE_MAX,
  toggleWhat,
  isInherited,
  isWhatInherited,
  handleNumDaysInput,
  handleNumDaysBlur,
  handleNumPeopleInput,
  handleNumPeopleBlur,
  handleDestinationBlur,
  numDaysError,
  numPeopleError
} = useTripEditorFields(
  () => props.trip,
  () => props.defaultPreferences,
  (fields) => emit('update:fields', fields)
)

function onDestinationBlur() {
  handleDestinationBlur()
  emit('blur:destination')
}

// Translated note validation message (replaces composable's hardcoded English)
const noteValidationMessage = computed(() => {
  if (noteLength.value > MAX_NOTE_LENGTH)
    return t('tripEditor.noteOverLimit', { limit: MAX_NOTE_LENGTH.toLocaleString() })
  if (noteLength.value > WARN_NOTE_LENGTH) return t('tripEditor.noteApproachingLimit')
  return null
})

// Preference options as computed so they react to locale changes
const whatOptions = computed<{ value: WhatPreference; label: string }[]>(() => [
  { value: 'nature', label: t('tripEditor.what.nature') },
  { value: 'beach_relax', label: t('tripEditor.what.beach_relax') },
  { value: 'culture_museums', label: t('tripEditor.what.culture_museums') },
  { value: 'city_break', label: t('tripEditor.what.city_break') },
  { value: 'foodie', label: t('tripEditor.what.foodie') }
])

const speedOptions = computed<{ value: SpeedPreference; label: string; description: string }[]>(
  () => [
    {
      value: 'slow_chill',
      label: t('tripEditor.speed.slow_chill.label'),
      description: t('tripEditor.speed.slow_chill.desc')
    },
    {
      value: 'balance',
      label: t('tripEditor.speed.balance.label'),
      description: t('tripEditor.speed.balance.desc')
    },
    {
      value: 'intensive',
      label: t('tripEditor.speed.intensive.label'),
      description: t('tripEditor.speed.intensive.desc')
    }
  ]
)

const typeOptions = computed<{ value: TypePreference; label: string; description: string }[]>(
  () => [
    {
      value: 'base',
      label: t('tripEditor.type.base.label'),
      description: t('tripEditor.type.base.desc')
    },
    {
      value: 'base_with_trips',
      label: t('tripEditor.type.base_with_trips.label'),
      description: t('tripEditor.type.base_with_trips.desc')
    },
    {
      value: 'roadtrip',
      label: t('tripEditor.type.roadtrip.label'),
      description: t('tripEditor.type.roadtrip.desc')
    }
  ]
)

const budgetOptions = computed<{ value: BudgetPreference; label: string; description: string }[]>(
  () => [
    {
      value: 'budget',
      label: t('tripEditor.budget.budget.label'),
      description: t('tripEditor.budget.budget.desc')
    },
    {
      value: 'moderate',
      label: t('tripEditor.budget.moderate.label'),
      description: t('tripEditor.budget.moderate.desc')
    },
    {
      value: 'luxury',
      label: t('tripEditor.budget.luxury.label'),
      description: t('tripEditor.budget.luxury.desc')
    }
  ]
)
</script>

<template>
  <TooltipProvider>
    <div class="space-y-6">
      <!-- Destination -->
      <div class="space-y-2">
        <Label for="trip-destination">{{ t('tripEditor.destinationLabel') }}</Label>
        <Input
          id="trip-destination"
          v-model="localDestination"
          data-testid="trip-destination-input"
          :placeholder="t('tripEditor.destinationPlaceholder')"
          :disabled="props.isGenerating"
          maxlength="50"
          @blur="onDestinationBlur"
        />
      </div>

      <!-- Trip Preferences -->
      <Card>
        <CardHeader>
          <CardTitle>{{ t('tripEditor.preferencesTitle') }}</CardTitle>
          <CardDescription>{{ t('tripEditor.preferencesDesc') }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Trip Duration -->
          <div class="space-y-2">
            <Label for="num-days">{{ t('tripEditor.durationLabel') }}</Label>
            <Input
              id="num-days"
              data-testid="trip-num-days-input"
              :model-value="localNumDays ?? undefined"
              type="number"
              min="1"
              :max="NUM_DAYS_MAX"
              :placeholder="t('tripEditor.durationPlaceholder')"
              :disabled="props.isGenerating"
              :aria-invalid="numDaysError"
              class="w-32"
              @update:model-value="handleNumDaysInput"
              @blur="handleNumDaysBlur"
            />
            <p v-if="numDaysError" data-testid="num-days-error" class="text-xs text-destructive">
              {{ t('tripEditor.durationError', { max: NUM_DAYS_MAX }) }}
            </p>
            <p v-else class="text-xs text-muted-foreground">{{ t('tripEditor.durationHint') }}</p>
          </div>

          <!-- Number of People -->
          <div class="space-y-2">
            <Label for="num-people">{{ t('tripEditor.peopleLabel') }}</Label>
            <Input
              id="num-people"
              data-testid="trip-num-people-input"
              :model-value="localNumPeople ?? undefined"
              type="number"
              min="1"
              :max="NUM_PEOPLE_MAX"
              :placeholder="t('tripEditor.peoplePlaceholder')"
              :disabled="props.isGenerating"
              :aria-invalid="numPeopleError"
              class="w-32"
              @update:model-value="handleNumPeopleInput"
              @blur="handleNumPeopleBlur"
            />
            <p
              v-if="numPeopleError"
              data-testid="num-people-error"
              class="text-xs text-destructive"
            >
              {{ t('tripEditor.peopleError', { max: NUM_PEOPLE_MAX }) }}
            </p>
            <p v-else class="text-xs text-muted-foreground">{{ t('tripEditor.peopleHint') }}</p>
          </div>

          <!-- What Preferences (Multi-select) -->
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <Label>{{ t('tripEditor.interestsLabel') }}</Label>
              <Tooltip v-if="isWhatInherited">
                <TooltipTrigger as-child>
                  <Badge variant="outline" class="cursor-default text-xs">{{
                    t('tripEditor.fromProfile')
                  }}</Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{{ t('tripEditor.fromProfileTooltip') }}</p>
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
                  :data-testid="`trip-what-checkbox-${option.value}`"
                  :model-value="localWhat.includes(option.value)"
                  :disabled="props.isGenerating"
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
              <Label>{{ t('tripEditor.travelSpeedLabel') }}</Label>
              <Tooltip v-if="isInherited('speed')">
                <TooltipTrigger as-child>
                  <Badge variant="outline" class="cursor-default text-xs">{{
                    t('tripEditor.fromProfile')
                  }}</Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{{ t('tripEditor.fromProfileTooltip') }}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <RadioGroup v-model="localSpeed" :disabled="props.isGenerating">
              <div
                v-for="option in speedOptions"
                :key="option.value"
                class="flex items-center space-x-2"
              >
                <RadioGroupItem
                  :id="`speed-${option.value}`"
                  :value="option.value"
                  :data-testid="`trip-speed-radio-${option.value}`"
                />
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
              <Label>{{ t('tripEditor.tripTypeLabel') }}</Label>
              <Tooltip v-if="isInherited('type')">
                <TooltipTrigger as-child>
                  <Badge variant="outline" class="cursor-default text-xs">{{
                    t('tripEditor.fromProfile')
                  }}</Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{{ t('tripEditor.fromProfileTooltip') }}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <RadioGroup v-model="localType" :disabled="props.isGenerating">
              <div
                v-for="option in typeOptions"
                :key="option.value"
                class="flex items-center space-x-2"
              >
                <RadioGroupItem
                  :id="`type-${option.value}`"
                  :value="option.value"
                  :data-testid="`trip-type-radio-${option.value}`"
                />
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
              <Label>{{ t('tripEditor.budgetLabel') }}</Label>
              <Tooltip v-if="isInherited('budget')">
                <TooltipTrigger as-child>
                  <Badge variant="outline" class="cursor-default text-xs">{{
                    t('tripEditor.fromProfile')
                  }}</Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{{ t('tripEditor.fromProfileTooltip') }}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <RadioGroup v-model="localBudget" :disabled="props.isGenerating">
              <div
                v-for="option in budgetOptions"
                :key="option.value"
                class="flex items-center space-x-2"
              >
                <RadioGroupItem
                  :id="`budget-${option.value}`"
                  :value="option.value"
                  :data-testid="`trip-budget-radio-${option.value}`"
                />
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
            <Label class="text-muted-foreground">{{ t('tripEditor.travelerProfileLabel') }}</Label>
            <div class="flex flex-wrap gap-2 text-sm">
              <Badge v-if="profile.has_kids" variant="outline">{{
                t('tripEditor.travelerFlags.has_kids')
              }}</Badge>
              <Badge v-if="profile.has_pets" variant="outline">{{
                t('tripEditor.travelerFlags.has_pets')
              }}</Badge>
              <Badge v-if="profile.has_mobility_issues" variant="outline">{{
                t('tripEditor.travelerFlags.has_mobility_issues')
              }}</Badge>
              <Badge v-if="profile.has_dietary_preferences" variant="outline">{{
                t('tripEditor.travelerFlags.has_dietary_preferences')
              }}</Badge>
              <span
                v-if="
                  !profile.has_kids &&
                  !profile.has_pets &&
                  !profile.has_mobility_issues &&
                  !profile.has_dietary_preferences
                "
                class="text-muted-foreground"
              >
                {{ t('tripEditor.noFlags') }}
              </span>
            </div>
            <p
              v-if="profile.has_dietary_preferences && profile.dietary_preferences_description"
              class="text-xs text-muted-foreground"
            >
              {{
                t('tripEditor.dietaryNote', {
                  description: profile.dietary_preferences_description
                })
              }}
            </p>
          </div>
        </CardContent>
      </Card>

      <!-- Trip Note -->
      <Card>
        <CardHeader>
          <CardTitle>{{ t('tripEditor.notesTitle') }}</CardTitle>
          <CardDescription>{{ t('tripEditor.notesDesc') }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-2">
          <Textarea
            v-model="localNote"
            data-testid="trip-note-textarea"
            :placeholder="t('tripEditor.notesPlaceholder')"
            :disabled="props.isGenerating"
            class="min-h-[200px] resize-y"
            aria-label="Trip note content"
            :aria-invalid="noteLength > MAX_NOTE_LENGTH"
            @blur="emit('blur:note')"
          />
          <p
            v-if="props.noteLanguageMismatch"
            data-testid="note-language-mismatch-warning"
            class="text-sm text-amber-600 dark:text-amber-400"
          >
            {{ t('tripEditor.noteLanguageMismatch') }}
          </p>
          <div class="flex items-center justify-between text-sm">
            <span
              v-if="noteValidationMessage"
              data-testid="note-validation-message"
              :class="noteValidationClass"
            >
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

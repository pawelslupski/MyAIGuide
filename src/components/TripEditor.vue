<script setup lang="ts">
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
import { useTripEditorFields, type TripEditorFields } from '@/composables/useTripEditorFields'

interface Props {
  trip: TripDTO
  defaultPreferences?: TripPreferencesDto
  profile?: ProfileDTO | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:fields': [fields: TripEditorFields]
  'blur:note': []
}>()

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
  noteValidationMessage,
  noteValidationClass,
  noteCounterClass,
  MAX_NOTE_LENGTH,
  toggleWhat,
  isInherited,
  isWhatInherited,
  handleNumDaysInput,
  handleNumPeopleInput
} = useTripEditorFields(
  () => props.trip,
  () => props.defaultPreferences,
  (fields) => emit('update:fields', fields)
)

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
          data-testid="trip-destination-input"
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
              data-testid="trip-num-days-input"
              :model-value="localNumDays ?? undefined"
              type="number"
              min="1"
              max="30"
              placeholder="e.g. 7"
              class="w-32"
              @update:model-value="handleNumDaysInput"
            />
          </div>

          <!-- Number of People -->
          <div class="space-y-2">
            <Label for="num-people">Number of People</Label>
            <Input
              id="num-people"
              data-testid="trip-num-people-input"
              :model-value="localNumPeople ?? undefined"
              type="number"
              min="1"
              max="20"
              placeholder="e.g. 2"
              class="w-32"
              @update:model-value="handleNumPeopleInput"
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
                  :data-testid="`trip-what-checkbox-${option.value}`"
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
            data-testid="trip-note-textarea"
            placeholder="Write your trip notes here... (optional)"
            class="min-h-[200px] resize-y"
            aria-label="Trip note content"
            :aria-invalid="noteLength > MAX_NOTE_LENGTH"
            @blur="emit('blur:note')"
          />
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

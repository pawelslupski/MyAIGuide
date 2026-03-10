<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useForm } from 'vee-validate'
import { z } from 'zod'
import {
  AlertCircle,
  Baby,
  PawPrint,
  Accessibility,
  Utensils,
  TreePine,
  Landmark,
  Waves,
  Building2,
  UtensilsCrossed,
  Snail,
  Scale,
  Zap,
  MapPin,
  Map,
  Car,
  PiggyBank,
  Wallet,
  Gem
} from 'lucide-vue-next'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast/use-toast'
import { useProfileStore } from '@/stores/profile.store'
import { WhatPreferenceSchema } from '@/lib/validation/plan.schemas'
import { toTypedSchema } from '@/lib/validation/zod-adapter'
import type { WhatPreference, SpeedPreference, TypePreference, BudgetPreference } from '@/types'

const profileStore = useProfileStore()
const { toast } = useToast()

// Form schema — mirrors UpdateProfileCommandSchema but allows null for
// single-select fields so "no selection" is a valid UI state.
const profileFormSchema = z
  .object({
    has_kids: z.boolean().optional(),
    has_pets: z.boolean().optional(),
    has_mobility_issues: z.boolean().optional(),
    has_dietary_preferences: z.boolean().optional(),
    dietary_preferences_description: z.string().nullable().optional(),
    default_what: z.array(WhatPreferenceSchema).optional(),
    default_speed: z.enum(['slow_chill', 'balance', 'intensive']).nullable().optional(),
    default_type: z.enum(['base', 'base_with_trips', 'roadtrip']).nullable().optional(),
    default_budget: z.enum(['budget', 'moderate', 'luxury']).nullable().optional()
  })
  .superRefine((data, ctx) => {
    if (data.has_dietary_preferences === true && !data.dietary_preferences_description?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dietary_preferences_description'],
        message: 'Please describe your dietary preferences before saving.'
      })
    }
  })

const { handleSubmit, errors, isSubmitting, meta, resetForm, setFieldValue, values, defineField } =
  useForm({
    validationSchema: toTypedSchema(profileFormSchema)
  })

const [dietaryDescription, dietaryDescriptionAttrs] = defineField('dietary_preferences_description')

const profile = computed(() => profileStore.profile)
const isInitialised = ref(false)

function profileToFormValues(p: NonNullable<typeof profile.value>) {
  return {
    has_kids: p.has_kids ?? false,
    has_pets: p.has_pets ?? false,
    has_mobility_issues: p.has_mobility_issues ?? false,
    has_dietary_preferences: p.has_dietary_preferences ?? false,
    dietary_preferences_description: p.dietary_preferences_description ?? '',
    default_what: [...(p.default_what ?? [])],
    default_speed: p.default_speed ?? null,
    default_type: p.default_type ?? null,
    default_budget: p.default_budget ?? null
  }
}

// Initialise form once the profile arrives from the store
watch(
  profile,
  (p) => {
    if (p && !isInitialised.value) {
      resetForm({ values: profileToFormValues(p) })
      isInitialised.value = true
    }
  },
  { immediate: true }
)

// ── Traveler flag toggles ──────────────────────────────────────────────────

type BoolFlag = 'has_kids' | 'has_pets' | 'has_mobility_issues'

const flags = [
  { key: 'has_kids' as BoolFlag, label: 'Traveling with kids', icon: Baby },
  { key: 'has_pets' as BoolFlag, label: 'Traveling with pets', icon: PawPrint },
  { key: 'has_mobility_issues' as BoolFlag, label: 'Mobility considerations', icon: Accessibility }
]

function toggleFlag(key: BoolFlag) {
  setFieldValue(key, !values[key])
}

// ── Dietary preferences ───────────────────────────────────────────────────

function onDietaryToggle() {
  if (values.has_dietary_preferences) {
    setFieldValue('has_dietary_preferences', false)
    setFieldValue('dietary_preferences_description', '')
  } else {
    setFieldValue('has_dietary_preferences', true)
  }
}

// ── What preferences ──────────────────────────────────────────────────────

const whatOptions: { value: WhatPreference; label: string; icon: any }[] = [
  { value: 'nature', label: 'Nature', icon: TreePine },
  { value: 'culture_museums', label: 'Culture & Museums', icon: Landmark },
  { value: 'beach_relax', label: 'Beach & Relax', icon: Waves },
  { value: 'city_break', label: 'City Break', icon: Building2 },
  { value: 'foodie', label: 'Foodie', icon: UtensilsCrossed }
]

function toggleWhat(value: WhatPreference) {
  const current = (values.default_what ?? []) as WhatPreference[]
  setFieldValue(
    'default_what',
    current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
  )
}

// ── Speed / Type / Budget (single-select) ─────────────────────────────────

const speedOptions: { value: SpeedPreference; label: string; icon: any }[] = [
  { value: 'slow_chill', label: 'Slow & Chill', icon: Snail },
  { value: 'balance', label: 'Balanced', icon: Scale },
  { value: 'intensive', label: 'Intensive', icon: Zap }
]

const typeOptions: { value: TypePreference; label: string; icon: any }[] = [
  { value: 'base', label: 'Base', icon: MapPin },
  { value: 'base_with_trips', label: 'Base + Day Trips', icon: Map },
  { value: 'roadtrip', label: 'Road Trip', icon: Car }
]

const budgetOptions: { value: BudgetPreference; label: string; icon: any }[] = [
  { value: 'budget', label: 'Budget', icon: PiggyBank },
  { value: 'moderate', label: 'Moderate', icon: Wallet },
  { value: 'luxury', label: 'Luxury', icon: Gem }
]

function selectSpeed(value: SpeedPreference) {
  setFieldValue('default_speed', value)
}

function selectType(value: TypePreference) {
  setFieldValue('default_type', value)
}

function selectBudget(value: BudgetPreference) {
  setFieldValue('default_budget', value)
}

// ── Save / Reset ──────────────────────────────────────────────────────────

function resetProfile() {
  if (profile.value) resetForm({ values: profileToFormValues(profile.value) })
}

const onSave = handleSubmit(async (formValues) => {
  try {
    await profileStore.updateProfile({
      ...formValues,
      dietary_preferences_description: formValues.has_dietary_preferences
        ? formValues.dietary_preferences_description?.trim() || null
        : null
    })
    // Sync form baseline to newly saved profile so meta.dirty resets to false
    if (profile.value) resetForm({ values: profileToFormValues(profile.value) })
    toast({
      title: 'Profile saved',
      description: 'Your travel profile has been updated.',
      duration: 3000
    })
  } catch {
    toast({
      title: 'Save failed',
      description: 'Could not update profile. Please try again.',
      variant: 'destructive',
      duration: 5000
    })
  }
})
</script>

<template>
  <Card>
    <CardHeader class="flex flex-row items-center justify-between pb-4">
      <CardTitle>Your Travel Profile</CardTitle>
      <div v-if="profile" class="flex gap-2">
        <Button
          data-testid="profile-reset-btn"
          variant="outline"
          size="sm"
          :disabled="!meta.dirty || isSubmitting"
          @click="resetProfile"
        >
          Reset
        </Button>
        <Button
          data-testid="profile-save-btn"
          size="sm"
          :disabled="!meta.dirty || isSubmitting"
          @click="onSave"
        >
          {{ isSubmitting ? 'Saving…' : 'Save' }}
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      <!-- Loading skeleton -->
      <template v-if="profileStore.isLoading && !profile">
        <div class="space-y-3">
          <Skeleton class="h-4 w-1/3" />
          <div class="flex gap-2">
            <Skeleton v-for="n in 4" :key="n" class="h-9 w-28 rounded-full" />
          </div>
          <Skeleton class="mt-4 h-4 w-1/3" />
          <div class="flex gap-2">
            <Skeleton v-for="n in 5" :key="n" class="h-9 w-28 rounded-full" />
          </div>
        </div>
      </template>

      <!-- Profile error state -->
      <template v-else-if="profileStore.error">
        <Alert variant="destructive">
          <AlertCircle class="h-4 w-4" />
          <AlertTitle>Could not load profile</AlertTitle>
          <AlertDescription>{{ profileStore.error.error.message }}</AlertDescription>
        </Alert>
      </template>

      <template v-else-if="profile">
        <!-- Section A: About you -->
        <div class="mb-6">
          <p class="mb-3 text-sm font-medium text-muted-foreground">About you</p>
          <div class="flex flex-wrap gap-2">
            <!-- Boolean flags -->
            <button
              v-for="flag in flags"
              :key="flag.key"
              :data-testid="`profile-flag-${flag.key}`"
              :disabled="isSubmitting"
              :class="[
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
                values[flag.key]
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground'
              ]"
              @click="toggleFlag(flag.key)"
            >
              <component :is="flag.icon" class="h-4 w-4" />
              {{ flag.label }}
            </button>

            <!-- Dietary preferences pill -->
            <button
              data-testid="profile-flag-has_dietary_preferences"
              :disabled="isSubmitting"
              :class="[
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
                values.has_dietary_preferences
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground'
              ]"
              @click="onDietaryToggle"
            >
              <Utensils class="h-4 w-4" />
              Dietary preferences
            </button>
          </div>

          <!-- Dietary description textarea -->
          <div v-if="values.has_dietary_preferences" class="mt-3">
            <Textarea
              v-model="dietaryDescription"
              v-bind="dietaryDescriptionAttrs"
              data-testid="profile-dietary-textarea"
              :disabled="isSubmitting"
              placeholder="Describe your dietary preferences (e.g. vegetarian, gluten-free, nut allergy)…"
              class="min-h-[80px] resize-none"
            />
            <p v-if="errors.dietary_preferences_description" class="mt-1 text-xs text-destructive">
              {{ errors.dietary_preferences_description }}
            </p>
          </div>
        </div>

        <Separator class="my-6" />

        <!-- Section B: Default travel style -->
        <div class="space-y-5">
          <p class="text-sm font-medium text-muted-foreground">Default travel style</p>

          <!-- Interests (multi-select) -->
          <div>
            <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Interests
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="opt in whatOptions"
                :key="opt.value"
                :data-testid="`profile-what-${opt.value}`"
                :disabled="isSubmitting"
                :class="[
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  (values.default_what ?? []).includes(opt.value)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground'
                ]"
                @click="toggleWhat(opt.value)"
              >
                <component :is="opt.icon" class="h-4 w-4" />
                {{ opt.label }}
              </button>
            </div>
          </div>

          <!-- Pace (single-select) -->
          <div>
            <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pace
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="opt in speedOptions"
                :key="opt.value"
                :data-testid="`profile-speed-${opt.value}`"
                :disabled="isSubmitting"
                :class="[
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  values.default_speed === opt.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground'
                ]"
                @click="selectSpeed(opt.value)"
              >
                <component :is="opt.icon" class="h-4 w-4" />
                {{ opt.label }}
              </button>
            </div>
          </div>

          <!-- Trip type (single-select) -->
          <div>
            <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Trip type
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="opt in typeOptions"
                :key="opt.value"
                :data-testid="`profile-type-${opt.value}`"
                :disabled="isSubmitting"
                :class="[
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  values.default_type === opt.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground'
                ]"
                @click="selectType(opt.value)"
              >
                <component :is="opt.icon" class="h-4 w-4" />
                {{ opt.label }}
              </button>
            </div>
          </div>

          <!-- Budget (single-select) -->
          <div>
            <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Budget
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="opt in budgetOptions"
                :key="opt.value"
                :data-testid="`profile-budget-${opt.value}`"
                :disabled="isSubmitting"
                :class="[
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  values.default_budget === opt.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground'
                ]"
                @click="selectBudget(opt.value)"
              >
                <component :is="opt.icon" class="h-4 w-4" />
                {{ opt.label }}
              </button>
            </div>
          </div>
        </div>
      </template>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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
import type { WhatPreference, SpeedPreference, TypePreference, BudgetPreference } from '@/types'

const profileStore = useProfileStore()
const { toast } = useToast()

const isSaving = ref(false)

// Local draft – all edits stay here until the user explicitly saves
const local = ref({
  has_kids: false,
  has_pets: false,
  has_mobility_issues: false,
  has_dietary_preferences: false,
  dietary_preferences_description: '',
  default_what: [] as WhatPreference[],
  default_speed: null as SpeedPreference | null,
  default_type: null as TypePreference | null,
  default_budget: null as BudgetPreference | null
})

const profile = computed(() => profileStore.profile)
const isInitialised = ref(false)

function initLocal(p: NonNullable<typeof profile.value>) {
  local.value = {
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

// Initialise local draft once the profile arrives from the store
watch(
  profile,
  (p) => {
    if (p && !isInitialised.value) {
      initLocal(p)
      isInitialised.value = true
    }
  },
  { immediate: true }
)

const isDirty = computed(() => {
  const p = profile.value
  if (!p) return false
  return (
    local.value.has_kids !== (p.has_kids ?? false) ||
    local.value.has_pets !== (p.has_pets ?? false) ||
    local.value.has_mobility_issues !== (p.has_mobility_issues ?? false) ||
    local.value.has_dietary_preferences !== (p.has_dietary_preferences ?? false) ||
    local.value.dietary_preferences_description !== (p.dietary_preferences_description ?? '') ||
    JSON.stringify(local.value.default_what) !== JSON.stringify(p.default_what ?? []) ||
    local.value.default_speed !== (p.default_speed ?? null) ||
    local.value.default_type !== (p.default_type ?? null) ||
    local.value.default_budget !== (p.default_budget ?? null)
  )
})

// ── Traveler flag toggles ──────────────────────────────────────────────────

type BoolFlag = 'has_kids' | 'has_pets' | 'has_mobility_issues'

const flags = [
  { key: 'has_kids' as BoolFlag, label: 'Traveling with kids', icon: Baby },
  { key: 'has_pets' as BoolFlag, label: 'Traveling with pets', icon: PawPrint },
  { key: 'has_mobility_issues' as BoolFlag, label: 'Mobility considerations', icon: Accessibility }
]

function toggleFlag(key: BoolFlag) {
  local.value[key] = !local.value[key]
}

// ── Dietary preferences ───────────────────────────────────────────────────

function onDietaryToggle() {
  if (local.value.has_dietary_preferences) {
    local.value.has_dietary_preferences = false
    local.value.dietary_preferences_description = ''
  } else {
    local.value.has_dietary_preferences = true
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
  const current = local.value.default_what
  local.value.default_what = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value]
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
  local.value.default_speed = value
}

function selectType(value: TypePreference) {
  local.value.default_type = value
}

function selectBudget(value: BudgetPreference) {
  local.value.default_budget = value
}

// ── Save / Reset ──────────────────────────────────────────────────────────

function resetProfile() {
  if (profile.value) initLocal(profile.value)
}

async function saveProfile() {
  if (local.value.has_dietary_preferences && !local.value.dietary_preferences_description.trim()) {
    toast({
      title: 'Description required',
      description: 'Please describe your dietary preferences before saving.',
      variant: 'destructive',
      duration: 5000
    })
    return
  }
  isSaving.value = true
  try {
    await profileStore.updateProfile({
      ...local.value,
      dietary_preferences_description: local.value.has_dietary_preferences
        ? local.value.dietary_preferences_description.trim()
        : null
    })
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
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Card>
    <CardHeader class="flex flex-row items-center justify-between pb-4">
      <CardTitle>Your Travel Profile</CardTitle>
      <div v-if="profile" class="flex gap-2">
        <Button variant="outline" size="sm" :disabled="!isDirty || isSaving" @click="resetProfile">
          Reset
        </Button>
        <Button size="sm" :disabled="!isDirty || isSaving" @click="saveProfile">
          {{ isSaving ? 'Saving…' : 'Save' }}
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
              :disabled="isSaving"
              :class="[
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
                local[flag.key]
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
              :disabled="isSaving"
              :class="[
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
                local.has_dietary_preferences
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
          <div v-if="local.has_dietary_preferences" class="mt-3">
            <Textarea
              v-model="local.dietary_preferences_description"
              :disabled="isSaving"
              placeholder="Describe your dietary preferences (e.g. vegetarian, gluten-free, nut allergy)…"
              class="min-h-[80px] resize-none"
            />
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
                :disabled="isSaving"
                :class="[
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  local.default_what.includes(opt.value)
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
                :disabled="isSaving"
                :class="[
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  local.default_speed === opt.value
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
                :disabled="isSaving"
                :class="[
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  local.default_type === opt.value
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
                :disabled="isSaving"
                :class="[
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  local.default_budget === opt.value
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

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
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
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast/use-toast'
import { useProfileStore } from '@/stores/profile.store'
import type { WhatPreference, SpeedPreference, TypePreference, BudgetPreference } from '@/types'

const profileStore = useProfileStore()
const { toast } = useToast()

const isUpdating = ref(false)

// Dietary preferences local state for the edge case
const localDietaryEnabled = ref(false)
const dietaryTextarea = ref('')

// Sync localDietaryEnabled from store when profile loads
const profile = computed(() => profileStore.profile)

const isDietaryInitialised = ref(false)

// Sync localDietaryEnabled from store once profile is available
watch(
  profile,
  (p) => {
    if (p && !isDietaryInitialised.value) {
      localDietaryEnabled.value = p.has_dietary_preferences ?? false
      dietaryTextarea.value = p.dietary_preferences_description ?? ''
      isDietaryInitialised.value = true
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

async function toggleFlag(key: BoolFlag) {
  if (!profile.value || isUpdating.value) return
  const newValue = !profile.value[key]
  isUpdating.value = true
  try {
    await profileStore.updateProfile({ [key]: newValue })
  } catch {
    toast({
      title: 'Save failed',
      description: 'Could not update profile. Please try again.',
      variant: 'destructive'
    })
  } finally {
    isUpdating.value = false
  }
}

// ── Dietary preferences ───────────────────────────────────────────────────

function onDietaryToggle() {
  if (!profile.value || isUpdating.value) return

  if (profile.value.has_dietary_preferences) {
    // Turn OFF: save immediately
    void saveDietaryOff()
  } else {
    // Turn ON: optimistically show textarea, wait for description
    localDietaryEnabled.value = true
    dietaryTextarea.value = ''
  }
}

async function saveDietaryOff() {
  isUpdating.value = true
  try {
    await profileStore.updateProfile({
      has_dietary_preferences: false,
      dietary_preferences_description: null
    })
    localDietaryEnabled.value = false
    dietaryTextarea.value = ''
  } catch {
    toast({
      title: 'Save failed',
      description: 'Could not update profile. Please try again.',
      variant: 'destructive'
    })
    localDietaryEnabled.value = true
  } finally {
    isUpdating.value = false
  }
}

async function onDietaryBlur() {
  if (!localDietaryEnabled.value) return
  const desc = dietaryTextarea.value.trim()
  if (!desc) {
    toast({
      title: 'Description required',
      description: 'Please describe your dietary preferences before saving.',
      variant: 'destructive'
    })
    localDietaryEnabled.value = false
    dietaryTextarea.value = ''
    return
  }
  isUpdating.value = true
  try {
    await profileStore.updateProfile({
      has_dietary_preferences: true,
      dietary_preferences_description: desc
    })
  } catch {
    toast({
      title: 'Save failed',
      description: 'Could not update profile. Please try again.',
      variant: 'destructive'
    })
    localDietaryEnabled.value = false
    dietaryTextarea.value = ''
  } finally {
    isUpdating.value = false
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

async function toggleWhat(value: WhatPreference) {
  if (!profile.value || isUpdating.value) return
  const current = profile.value.default_what ?? []
  const updated = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
  isUpdating.value = true
  try {
    await profileStore.updateProfile({ default_what: updated })
  } catch {
    toast({
      title: 'Save failed',
      description: 'Could not update profile. Please try again.',
      variant: 'destructive'
    })
  } finally {
    isUpdating.value = false
  }
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

async function selectSpeed(value: SpeedPreference) {
  if (!profile.value || isUpdating.value || profile.value.default_speed === value) return
  isUpdating.value = true
  try {
    await profileStore.updateProfile({ default_speed: value })
  } catch {
    toast({
      title: 'Save failed',
      description: 'Could not update profile. Please try again.',
      variant: 'destructive'
    })
  } finally {
    isUpdating.value = false
  }
}

async function selectType(value: TypePreference) {
  if (!profile.value || isUpdating.value || profile.value.default_type === value) return
  isUpdating.value = true
  try {
    await profileStore.updateProfile({ default_type: value })
  } catch {
    toast({
      title: 'Save failed',
      description: 'Could not update profile. Please try again.',
      variant: 'destructive'
    })
  } finally {
    isUpdating.value = false
  }
}

async function selectBudget(value: BudgetPreference) {
  if (!profile.value || isUpdating.value || profile.value.default_budget === value) return
  isUpdating.value = true
  try {
    await profileStore.updateProfile({ default_budget: value })
  } catch {
    toast({
      title: 'Save failed',
      description: 'Could not update profile. Please try again.',
      variant: 'destructive'
    })
  } finally {
    isUpdating.value = false
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Your Travel Profile</CardTitle>
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

      <template v-else-if="profile">
        <!-- Section A: About you -->
        <div class="mb-6">
          <p class="mb-3 text-sm font-medium text-muted-foreground">About you</p>
          <div class="flex flex-wrap gap-2">
            <!-- Boolean flags -->
            <button
              v-for="flag in flags"
              :key="flag.key"
              :disabled="isUpdating"
              :class="[
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
                profile[flag.key]
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
              :disabled="isUpdating"
              :class="[
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
                profile.has_dietary_preferences || localDietaryEnabled
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
          <div v-if="profile.has_dietary_preferences || localDietaryEnabled" class="mt-3">
            <Textarea
              v-model="dietaryTextarea"
              :disabled="isUpdating"
              placeholder="Describe your dietary preferences (e.g. vegetarian, gluten-free, nut allergy)…"
              class="min-h-[80px] resize-none"
              @blur="onDietaryBlur"
            />
          </div>
        </div>

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
                :disabled="isUpdating"
                :class="[
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  (profile.default_what ?? []).includes(opt.value)
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
                :disabled="isUpdating"
                :class="[
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  profile.default_speed === opt.value
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
                :disabled="isUpdating"
                :class="[
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  profile.default_type === opt.value
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
                :disabled="isUpdating"
                :class="[
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  profile.default_budget === opt.value
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

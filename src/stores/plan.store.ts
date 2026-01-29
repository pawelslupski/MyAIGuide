import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GeneratedPlanDTO, PlanJson, ErrorResponse } from '@/types'
import { supabaseClient } from '@/db/supabase.client'
import { useTripStore } from './trip.store'

/**
 * Plan Store
 * Manages plan candidate (temporary, in-memory), generation state, and plan operations
 */
export const usePlanStore = defineStore('plan', () => {
  // State
  const planCandidate = ref<GeneratedPlanDTO | null>(null)
  const isGenerating = ref(false)
  const isSaving = ref(false)
  const generationError = ref<ErrorResponse | null>(null)

  // Getters
  const hasCandidate = computed(() => planCandidate.value !== null)
  const candidatePlan = computed(() => planCandidate.value?.plan ?? null)

  /**
   * Generate plan for trip
   * Calls Edge Function to generate AI plan
   */
  async function generatePlan(tripId: number): Promise<void> {
    isGenerating.value = true
    generationError.value = null

    try {
      // Call Edge Function for plan generation
      const { data, error } = await supabaseClient.functions.invoke('generate-plan', {
        body: { tripId }
      })

      if (error) throw error

      // Store candidate in memory (not saved to database yet)
      planCandidate.value = {
        plan: data.plan,
        language: data.language,
        model_used: data.model_used,
        generated_at: data.generated_at || new Date().toISOString()
      }
    } catch (err: any) {
      generationError.value = {
        error: {
          code: err.code || 'GENERATION_ERROR',
          message: err.message || 'Failed to generate plan'
        }
      }
      throw err
    } finally {
      isGenerating.value = false
    }
  }

  /**
   * Save plan candidate to trip
   * Updates trip with plan_json and plan_language
   */
  async function savePlanToTrip(tripId: number): Promise<void> {
    if (!planCandidate.value) {
      throw new Error('No plan candidate to save')
    }

    isSaving.value = true

    try {
      const tripStore = useTripStore()

      const {
        data: { user }
      } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Import savePlanToTrip service function
      const { savePlanToTrip: savePlan } = await import('@/lib/services/trip.service')

      const updatedTrip = await savePlan(
        tripId,
        user.id,
        planCandidate.value.plan,
        planCandidate.value.language
      )

      // Update trip store with saved plan
      tripStore.currentTrip = updatedTrip

      // Clear candidate after successful save
      planCandidate.value = null
      generationError.value = null
    } finally {
      isSaving.value = false
    }
  }

  /**
   * Discard plan candidate
   * Clears candidate from memory without saving
   */
  function discardCandidate(): void {
    planCandidate.value = null
    generationError.value = null
  }

  /**
   * Update plan candidate
   * Allows editing candidate before saving
   */
  function updateCandidatePlan(plan: PlanJson): void {
    if (planCandidate.value) {
      planCandidate.value.plan = plan
    }
  }

  return {
    // State
    planCandidate,
    isGenerating,
    isSaving,
    generationError,
    // Getters
    hasCandidate,
    candidatePlan,
    // Actions
    generatePlan,
    savePlanToTrip,
    discardCandidate,
    updateCandidatePlan
  }
})

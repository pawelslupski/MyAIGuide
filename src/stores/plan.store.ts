import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GeneratedPlanDTO, PlanJson, ErrorResponse } from '@/types'
import { supabaseClient } from '@/db/supabase.client'
import { useTripStore } from './trip.store'
import { useProfileStore } from './profile.store'
import { detectLanguage, callAIService } from '@/lib/services/generation.service'
import { savePlanToTrip as savePlanService } from '@/lib/services/trip.service'

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
  const saveError = ref<ErrorResponse | null>(null)

  // Getters
  const hasCandidate = computed(() => planCandidate.value !== null)
  const candidatePlan = computed(() => planCandidate.value?.plan ?? null)

  /**
   * Generate plan for trip
   * Calls OpenRouter API via Supabase Edge Function
   */
  async function generatePlan(_tripId: number): Promise<void> {
    isGenerating.value = true
    generationError.value = null
    saveError.value = null

    try {
      // Get trip data
      const tripStore = useTripStore()

      if (!tripStore.currentTrip) {
        throw new Error('Trip not found')
      }

      const trip = tripStore.currentTrip

      // Validate note body (optional but must not exceed max length if provided)
      if (trip.note_body && trip.note_body.length > 10000) {
        throw new Error('Trip notes must not exceed 10000 characters')
      }

      // Detect language from note (default to 'en' if no note)
      const language = detectLanguage(trip.note_body ?? '')

      // Build trip preferences with proper typing
      const tripPreferences = {
        what: (trip.what ?? []) as import('@/types').WhatPreference[],
        speed: trip.speed as import('@/types').SpeedPreference | null,
        type: trip.type as import('@/types').TypePreference | null,
        budget: trip.budget as import('@/types').BudgetPreference | null,
        num_days: trip.num_days ?? null,
        num_people: trip.num_people ?? null
      }

      // Fetch user profile for personalization flags
      const profileStore = useProfileStore()
      if (!profileStore.profile) {
        await profileStore.fetchProfile()
      }
      const userProfile = {
        hasKids: profileStore.profile?.has_kids ?? false,
        hasPets: profileStore.profile?.has_pets ?? false,
        hasMobilityIssues: profileStore.profile?.has_mobility_issues ?? false,
        hasDietaryPreferences: profileStore.profile?.has_dietary_preferences ?? false
      }

      const response = await callAIService({
        language,
        noteBody: trip.note_body ?? '',
        userProfile,
        tripPreferences
      })

      // Store candidate in memory (not saved to database yet)
      planCandidate.value = {
        plan: response.plan,
        language,
        model_used: response.model_used,
        generated_at: new Date().toISOString()
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
    saveError.value = null

    try {
      const tripStore = useTripStore()

      const {
        data: { user }
      } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const updatedTrip = await savePlanService(
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
    } catch (err: any) {
      saveError.value = {
        error: {
          code: err.code || 'SAVE_ERROR',
          message: err.message || 'Failed to save plan'
        }
      }
      throw err
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
    saveError.value = null
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
    saveError,
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

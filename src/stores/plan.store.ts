import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import type {
  GeneratedPlanDTO,
  GenerationQuotaDTO,
  PlanJson,
  ErrorResponse,
  AIServiceResponse,
  PlanGenerationHistoryItemDTO
} from '@/types'
import { supabaseClient } from '@/db/supabase.client'
import { useTripStore } from './trip.store'
import { useProfileStore } from './profile.store'
import {
  detectLanguage,
  callAIService,
  checkGenerationQuota,
  recordGenerationAttempt,
  getTripGenerations
} from '@/lib/services/generation.service'
import { getTripById, savePlanToTrip as savePlanService } from '@/lib/services/trip.service'
import {
  createValidationError,
  createUnauthorizedError,
  createQuotaExceededError,
  createAIApiError,
  createAIResponseValidationError,
  createInvalidTripIdError,
  createInternalError,
  toApiError
} from '@/lib/errors/api.error'
import { tripIdSchema } from '@/lib/validation/trip.schemas'
import { validateAIResponse } from '@/lib/validation/plan.schemas'

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

  // Generation quota state
  const generationQuota = ref<GenerationQuotaDTO | null>(null)
  const quotaError = ref<ErrorResponse | null>(null)
  const isLoadingQuota = ref(false)

  // Generation history state
  const tripGenerations = ref<PlanGenerationHistoryItemDTO[]>([])
  const generationsError = ref<ErrorResponse | null>(null)
  const isLoadingGenerations = ref(false)

  // Getters
  const hasCandidate = computed(() => planCandidate.value !== null)
  const candidatePlan = computed(() => planCandidate.value?.plan ?? null)

  /**
   * Generate plan for trip
   * Calls OpenRouter API via Supabase Edge Function
   */
  async function generatePlan(tripId: number): Promise<void> {
    isGenerating.value = true
    generationError.value = null
    saveError.value = null

    try {
      // 1. Authenticate user — required before any DB query
      const {
        data: { user }
      } = await supabaseClient.auth.getUser()
      if (!user) throw createUnauthorizedError()
      const userId = user.id

      // 2. Validate tripId format (positive integer)
      const parsedId = tripIdSchema.safeParse(tripId)
      if (!parsedId.success) {
        throw createInvalidTripIdError(String(tripId))
      }
      const validTripId = parsedId.data

      // 3. Fetch trip from DB — validates existence (404) and ownership (403)
      const trip = await getTripById(validTripId, userId)

      // Keep the trip store in sync with the fresh DB data
      const tripStore = useTripStore()
      tripStore.currentTrip = trip

      // 4. Guard: destination must be set before generating a plan
      if (!trip.destination || trip.destination.trim() === '') {
        await recordGenerationAttempt({
          userId,
          tripId: validTripId,
          status: 'validation_error',
          errorMessage: 'destination must be set before generating a plan'
        })
        throw createValidationError('destination must be set before generating a plan', {
          field: 'destination'
        })
      }

      // 5. Guard: note_body must not exceed 10,000 characters
      if (trip.note_body && trip.note_body.length > 10000) {
        await recordGenerationAttempt({
          userId,
          tripId: validTripId,
          status: 'validation_error',
          errorMessage: 'Trip notes must not exceed 10000 characters'
        })
        throw createValidationError('Trip notes must not exceed 10000 characters', {
          field: 'note_body',
          max_length: 10000
        })
      }

      // 6. Enforce rate limit before invoking AI (10 generations / 24h)
      const quotaCheck = await checkGenerationQuota(userId)
      if (!quotaCheck.allowed) {
        throw createQuotaExceededError(quotaCheck.used, quotaCheck.limit, quotaCheck.resetAt)
      }

      // 7. Detect language from note (default to 'en' if no note)
      const language = detectLanguage(trip.note_body ?? '')

      // 8. Fetch user profile for personalization flags and preference fallbacks
      const profileStore = useProfileStore()
      if (!profileStore.profile) {
        await profileStore.fetchProfile()
      }

      // 9. Build trip preferences — fall back to profile defaults when trip fields are null
      const tripPreferences = {
        what: (trip.what?.length
          ? trip.what
          : (profileStore.profile?.default_what ?? [])) as import('@/types').WhatPreference[],
        speed: (trip.speed ?? profileStore.profile?.default_speed ?? null) as
          | import('@/types').SpeedPreference
          | null,
        type: (trip.type ?? profileStore.profile?.default_type ?? null) as
          | import('@/types').TypePreference
          | null,
        budget: (trip.budget ?? profileStore.profile?.default_budget ?? null) as
          | import('@/types').BudgetPreference
          | null,
        num_days: trip.num_days ?? null,
        num_people: trip.num_people ?? null
      }

      const userProfile = {
        hasKids: profileStore.profile?.has_kids ?? false,
        hasPets: profileStore.profile?.has_pets ?? false,
        hasMobilityIssues: profileStore.profile?.has_mobility_issues ?? false,
        hasDietaryPreferences: profileStore.profile?.has_dietary_preferences ?? false,
        dietaryPreferencesDescription: profileStore.profile?.dietary_preferences_description ?? null
      }

      // 10. Call AI service — record api_error and throw 502 on Edge Function / network failure
      let rawResponse: AIServiceResponse
      try {
        rawResponse = await callAIService({
          language,
          noteBody: trip.note_body ?? '',
          destination: trip.destination,
          userProfile,
          tripPreferences
        })
      } catch (aiError) {
        await recordGenerationAttempt({
          userId,
          tripId: validTripId,
          status: 'api_error',
          errorMessage: aiError instanceof Error ? aiError.message : 'Unknown error'
        })
        throw createAIApiError(aiError instanceof Error ? aiError.message : undefined)
      }

      // 11. Validate AI response structure with Zod — record validation_error and throw 422
      try {
        validateAIResponse(rawResponse)
      } catch (zodErr) {
        await recordGenerationAttempt({
          userId,
          tripId: validTripId,
          status: 'validation_error',
          errorMessage: zodErr instanceof Error ? zodErr.message : 'Invalid AI response structure'
        })
        throw createAIResponseValidationError(zodErr instanceof Error ? zodErr.message : undefined)
      }

      // 12. Record successful generation
      await recordGenerationAttempt({
        userId,
        tripId: validTripId,
        status: 'success',
        modelName: rawResponse.model_used
      })

      // 13. Refresh quota via the dedicated Edge Function so generationQuota store
      //     state is updated and the UI counter reflects the new usage immediately.
      await fetchGenerationQuota()

      // 14. Store candidate in memory (not saved to database yet).
      //     Use the freshly fetched generationQuota snapshot for the embedded quota field.
      const quota = generationQuota.value ?? { used: 0, limit: 10, remaining: 10, reset_at: new Date(Date.now() + 86400000).toISOString() }
      planCandidate.value = {
        plan: rawResponse.plan,
        language,
        model_used: rawResponse.model_used,
        generated_at: new Date().toISOString(),
        quota
      }
    } catch (err: unknown) {
      const apiErr = toApiError(err)
      generationError.value = apiErr.toResponse()
      throw apiErr
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
      if (!user) throw createUnauthorizedError()

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
    } catch (err: unknown) {
      const apiErr = toApiError(err)
      saveError.value = apiErr.toResponse()
      throw apiErr
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
   * Fetch the current user's generation quota from the Edge Function.
   * Stores the result in generationQuota; sets quotaError on failure.
   */
  async function fetchGenerationQuota(): Promise<void> {
    isLoadingQuota.value = true
    quotaError.value = null

    try {
      // Guard: require an active session before calling the Edge Function
      const {
        data: { user }
      } = await supabaseClient.auth.getUser()
      if (!user) throw createUnauthorizedError()

      const { data, error } = await supabaseClient.functions.invoke('get-generation-quota')
      if (error) throw createInternalError(error.message)

      generationQuota.value = data as GenerationQuotaDTO
    } catch (err: unknown) {
      const apiErr = toApiError(err)
      quotaError.value = apiErr.toResponse()
      throw apiErr
    } finally {
      isLoadingQuota.value = false
    }
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

  /**
   * Fetch generation attempt history for a trip.
   * Requires an active session. Validates tripId before calling the service.
   * Stores the result in tripGenerations; sets generationsError on failure.
   *
   * @param tripId - Trip identifier (positive integer)
   * @param limit  - Max records to return (1–50, default 10)
   */
  async function fetchTripGenerations(tripId: number, limit = 10): Promise<void> {
    isLoadingGenerations.value = true
    generationsError.value = null

    try {
      // Guard: require an active session before any DB interaction
      const {
        data: { user }
      } = await supabaseClient.auth.getUser()
      if (!user) throw createUnauthorizedError()

      // Validate tripId is a positive integer
      const parsedId = tripIdSchema.safeParse(tripId)
      if (!parsedId.success) {
        throw createInvalidTripIdError(String(tripId))
      }

      const result = await getTripGenerations(parsedId.data, user.id, limit)
      tripGenerations.value = result.generations
    } catch (err: unknown) {
      const apiErr = toApiError(err)
      generationsError.value = apiErr.toResponse()
      throw apiErr
    } finally {
      isLoadingGenerations.value = false
    }
  }

  return {
    // State
    planCandidate,
    isGenerating,
    isSaving,
    generationError,
    saveError,
    // Quota state
    generationQuota: readonly(generationQuota),
    quotaError: readonly(quotaError),
    isLoadingQuota: readonly(isLoadingQuota),
    // Generation history state
    tripGenerations: readonly(tripGenerations),
    generationsError: readonly(generationsError),
    isLoadingGenerations: readonly(isLoadingGenerations),
    // Getters
    hasCandidate,
    candidatePlan,
    // Actions
    generatePlan,
    savePlanToTrip,
    discardCandidate,
    updateCandidatePlan,
    fetchGenerationQuota,
    fetchTripGenerations
  }
})

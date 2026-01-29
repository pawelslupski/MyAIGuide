import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TripDTO, TripPreferencesDto, ErrorResponse } from '@/types'
import { getTripById } from '@/lib/services/trip.service'

/**
 * Trip Store
 * Manages current trip data, loading states, and trip operations
 */
export const useTripStore = defineStore('trip', () => {
  // State
  const currentTrip = ref<TripDTO | null>(null)
  const isLoading = ref(false)
  const isSaving = ref(false)
  const error = ref<ErrorResponse | null>(null)

  // Getters
  const tripStatus = computed(() => currentTrip.value?.status ?? null)
  const hasNote = computed(
    () => currentTrip.value?.note_body !== null && currentTrip.value?.note_body !== ''
  )
  const hasPlan = computed(() => currentTrip.value?.plan_json !== null)

  /**
   * Fetch trip by ID
   * Validates ownership and derives status
   * MOCK MODE: Uses hardcoded user ID instead of authentication
   */
  async function fetchTrip(tripId: number): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      // MOCK MODE: Use hardcoded user ID instead of authentication
      // TODO: Replace with real authentication when Supabase is configured
      const mockUserId = '00000000-0000-0000-0000-000000000001'
      console.log('[fetchTrip] MOCK MODE - using mock user ID:', mockUserId)

      currentTrip.value = await getTripById(tripId, mockUserId)
    } catch (err: any) {
      error.value = {
        error: {
          code: err.code || 'FETCH_ERROR',
          message: err.message || 'Failed to fetch trip'
        }
      }
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Update trip title
   * Uses optimistic update with rollback on error
   * MOCK MODE: Simulates success without actual API call
   */
  async function updateTripTitle(_tripId: number, title: string): Promise<void> {
    if (!currentTrip.value) return

    const previousTitle = currentTrip.value.title
    currentTrip.value.title = title // Optimistic update

    try {
      // MOCK MODE: Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 100))
      console.log(`[updateTripTitle] MOCK MODE - title updated to: ${title}`)
      // TODO: Replace with real Supabase client when environment is configured
    } catch (err: any) {
      // Rollback on error
      if (currentTrip.value) {
        currentTrip.value.title = previousTitle
      }
      throw err
    }
  }

  /**
   * Update trip note body
   * Uses optimistic update with rollback on error
   * MOCK MODE: Simulates success without actual API call
   */
  async function updateTripNote(_tripId: number, noteBody: string): Promise<void> {
    if (!currentTrip.value) return

    const previousNote = currentTrip.value.note_body
    currentTrip.value.note_body = noteBody // Optimistic update

    try {
      // MOCK MODE: Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 100))
      console.log(`[updateTripNote] MOCK MODE - note updated (${noteBody.length} chars)`)
      // TODO: Replace with real Supabase client when environment is configured
    } catch (err: any) {
      // Rollback on error
      if (currentTrip.value) {
        currentTrip.value.note_body = previousNote
      }
      throw err
    }
  }

  /**
   * Update trip preferences
   * Uses optimistic update with rollback on error
   * MOCK MODE: Simulates success without actual API call
   */
  async function updateTripPreferences(
    _tripId: number,
    preferences: TripPreferencesDto
  ): Promise<void> {
    if (!currentTrip.value) return

    const previousPreferences = {
      what: currentTrip.value.what,
      speed: currentTrip.value.speed,
      type: currentTrip.value.type,
      budget: currentTrip.value.budget
    }

    // Optimistic update
    currentTrip.value.what = preferences.what
    currentTrip.value.speed = preferences.speed
    currentTrip.value.type = preferences.type
    currentTrip.value.budget = preferences.budget

    try {
      // MOCK MODE: Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 100))
      console.log(`[updateTripPreferences] MOCK MODE - preferences updated:`, preferences)
      // TODO: Replace with real Supabase client when environment is configured
    } catch (err: any) {
      // Rollback on error
      if (currentTrip.value) {
        currentTrip.value.what = previousPreferences.what
        currentTrip.value.speed = previousPreferences.speed
        currentTrip.value.type = previousPreferences.type
        currentTrip.value.budget = previousPreferences.budget
      }
      throw err
    }
  }

  /**
   * Clear current trip
   */
  function clearTrip(): void {
    currentTrip.value = null
    error.value = null
  }

  return {
    // State
    currentTrip,
    isLoading,
    isSaving,
    error,
    // Getters
    tripStatus,
    hasNote,
    hasPlan,
    // Actions
    fetchTrip,
    updateTripTitle,
    updateTripNote,
    updateTripPreferences,
    clearTrip
  }
})

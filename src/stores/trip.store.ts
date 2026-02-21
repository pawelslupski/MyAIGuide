import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TripDTO, TripPreferencesDto, ErrorResponse } from '@/types'
import { supabaseClient } from '@/db/supabase.client'
import { getTripById, updateTrip } from '@/lib/services/trip.service'

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
   */
  async function fetchTrip(tripId: number): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const {
        data: { user }
      } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      currentTrip.value = await getTripById(tripId, user.id)
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
   */
  async function updateTripTitle(tripId: number, title: string): Promise<void> {
    if (!currentTrip.value) return

    const previousTitle = currentTrip.value.title
    currentTrip.value.title = title // Optimistic update

    try {
      const {
        data: { user }
      } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const updated = await updateTrip(tripId, user.id, { title })
      currentTrip.value = updated
    } catch (err: any) {
      if (currentTrip.value) {
        currentTrip.value.title = previousTitle
      }
      throw err
    }
  }

  /**
   * Update trip note body
   * Uses optimistic update with rollback on error
   */
  async function updateTripNote(tripId: number, noteBody: string): Promise<void> {
    if (!currentTrip.value) return

    const previousNote = currentTrip.value.note_body
    currentTrip.value.note_body = noteBody // Optimistic update

    try {
      const {
        data: { user }
      } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const updated = await updateTrip(tripId, user.id, { note_body: noteBody })
      currentTrip.value = updated
    } catch (err: any) {
      if (currentTrip.value) {
        currentTrip.value.note_body = previousNote
      }
      throw err
    }
  }

  /**
   * Update trip preferences
   * Uses optimistic update with rollback on error
   */
  async function updateTripPreferences(
    tripId: number,
    preferences: TripPreferencesDto
  ): Promise<void> {
    if (!currentTrip.value) return

    const previousPreferences = {
      what: currentTrip.value.what,
      speed: currentTrip.value.speed,
      type: currentTrip.value.type,
      budget: currentTrip.value.budget,
      num_days: currentTrip.value.num_days,
      num_people: currentTrip.value.num_people
    }

    // Optimistic update
    currentTrip.value.what = preferences.what
    currentTrip.value.speed = preferences.speed
    currentTrip.value.type = preferences.type
    currentTrip.value.budget = preferences.budget
    currentTrip.value.num_days = preferences.num_days
    currentTrip.value.num_people = preferences.num_people

    try {
      const {
        data: { user }
      } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const updated = await updateTrip(tripId, user.id, {
        what: preferences.what,
        speed: preferences.speed,
        type: preferences.type,
        budget: preferences.budget,
        num_days: preferences.num_days,
        num_people: preferences.num_people
      })
      currentTrip.value = updated
    } catch (err: any) {
      if (currentTrip.value) {
        currentTrip.value.what = previousPreferences.what
        currentTrip.value.speed = previousPreferences.speed
        currentTrip.value.type = previousPreferences.type
        currentTrip.value.budget = previousPreferences.budget
        currentTrip.value.num_days = previousPreferences.num_days
        currentTrip.value.num_people = previousPreferences.num_people
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

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ProfileDTO, ErrorResponse, TripPreferencesDto } from '@/types'
import { supabaseClient } from '@/db/supabase.client'
import { createUnauthorizedError, toApiError } from '@/lib/errors/api.error'
import { getProfile, updateProfile as updateProfileService } from '@/lib/services/profile.service'

/**
 * Profile Store
 * Manages user profile data and default preferences
 */
export const useProfileStore = defineStore('profile', () => {
  // State
  const profile = ref<ProfileDTO | null>(null)
  const isLoading = ref(false)
  const error = ref<ErrorResponse | null>(null)

  // Getters
  const defaultPreferences = computed(
    () =>
      ({
        what: profile.value?.default_what ?? [],
        speed: profile.value?.default_speed ?? null,
        type: profile.value?.default_type ?? null,
        budget: profile.value?.default_budget ?? null
      }) as TripPreferencesDto
  )

  /**
   * Fetch user profile
   * Loads profile data from database
   */
  async function fetchProfile(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const {
        data: { user }
      } = await supabaseClient.auth.getUser()
      if (!user) throw createUnauthorizedError()

      profile.value = await getProfile(user.id)
    } catch (err: unknown) {
      const apiErr = toApiError(err)
      error.value = apiErr.toResponse()
      throw apiErr
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Update user profile
   * Updates profile preferences
   */
  async function updateProfile(updates: Partial<ProfileDTO>): Promise<void> {
    if (!profile.value) return

    error.value = null

    try {
      const {
        data: { user }
      } = await supabaseClient.auth.getUser()
      if (!user) throw createUnauthorizedError()

      profile.value = await updateProfileService(user.id, updates)
    } catch (err: unknown) {
      const apiErr = toApiError(err)
      error.value = apiErr.toResponse()
      throw apiErr
    }
  }

  return {
    // State
    profile,
    isLoading,
    error,
    // Getters
    defaultPreferences,
    // Actions
    fetchProfile,
    updateProfile
  }
})

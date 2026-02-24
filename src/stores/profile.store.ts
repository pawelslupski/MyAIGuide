import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ProfileDTO, ErrorResponse, TripPreferencesDto } from '@/types'
import { supabaseClient } from '@/db/supabase.client'
import { validateProfileDTO } from '@/lib/validation/profile.schemas'
import {
  createUnauthorizedError,
  createProfileNotFoundError,
  createInternalError,
  toApiError
} from '@/lib/errors/api.error'

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

      const { data, error: fetchError } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (fetchError) {
        // PGRST116 = no rows returned by .single()
        if (fetchError.code === 'PGRST116') throw createProfileNotFoundError()
        throw createInternalError(fetchError.message)
      }

      profile.value = validateProfileDTO(data)
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

    try {
      const {
        data: { user }
      } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error: updateError } = await supabaseClient
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single()

      if (updateError) throw updateError
      if (!data) throw new Error('Failed to update profile')

      profile.value = data
    } catch (err: any) {
      error.value = {
        error: {
          code: err.code || 'UPDATE_ERROR',
          message: err.message || 'Failed to update profile'
        }
      }
      throw err
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

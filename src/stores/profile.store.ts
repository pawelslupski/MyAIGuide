import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ProfileDTO, ErrorResponse, TripPreferencesDto } from '@/types'
import { supabaseClient } from '@/db/supabase.client'

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

  const isComplete = computed(() => profile.value?.is_complete ?? false)

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
      if (!user) throw new Error('User not authenticated')

      const { data, error: fetchError } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (fetchError) throw fetchError
      if (!data) throw new Error('Profile not found')

      // Compute is_complete based on profile data
      const isComplete = !!(
        data.default_what &&
        data.default_what.length > 0 &&
        data.default_speed &&
        data.default_type &&
        data.default_budget
      )

      profile.value = {
        ...data,
        is_complete: isComplete
      }
    } catch (err: any) {
      error.value = {
        error: {
          code: err.code || 'FETCH_ERROR',
          message: err.message || 'Failed to fetch profile'
        }
      }
      throw err
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

      // Compute is_complete based on updated data
      const isComplete = !!(
        data.default_what &&
        data.default_what.length > 0 &&
        data.default_speed &&
        data.default_type &&
        data.default_budget
      )

      profile.value = {
        ...data,
        is_complete: isComplete
      }
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
    isComplete,
    // Actions
    fetchProfile,
    updateProfile
  }
})

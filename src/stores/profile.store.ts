import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ProfileDTO, ErrorResponse, TripPreferencesDto, UpdateProfileCommand } from '@/types'
import { supabaseClient } from '@/db/supabase.client'
import { createUnauthorizedError, createValidationError, toApiError } from '@/lib/errors/api.error'
import { isFeatureEnabled } from '@/lib/features/flags'
import { getProfile, updateProfile as updateProfileService } from '@/lib/services/profile.service'
import { validateUpdateProfileCommand } from '@/lib/validation/profile.schemas'
import { ZodError } from 'zod'

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
        data: { session }
      } = await supabaseClient.auth.getSession()
      const user = session?.user
      if (!user) {
        if (!isFeatureEnabled('auth')) return // auth disabled, no session yet — skip silently
        throw createUnauthorizedError()
      }

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
   * Validates command via Zod (including cross-field dietary rule), then persists updates.
   */
  async function updateProfile(command: UpdateProfileCommand): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const {
        data: { session }
      } = await supabaseClient.auth.getSession()
      const user = session?.user
      if (!user) throw createUnauthorizedError()

      const validated = validateUpdateProfileCommand(command)
      profile.value = await updateProfileService(user.id, validated)
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        const details = Object.fromEntries(err.issues.map((i) => [i.path.join('.'), i.message]))
        const apiErr = createValidationError('Invalid profile data', details)
        error.value = apiErr.toResponse()
        throw apiErr
      }
      const apiErr = toApiError(err)
      error.value = apiErr.toResponse()
      throw apiErr
    } finally {
      isLoading.value = false
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

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GenerationQuotaDTO, ErrorResponse } from '@/types'
import { checkGenerationQuota } from '@/lib/services/generation.service'
import { supabaseClient } from '@/db/supabase.client'

/**
 * Quota Store
 * Manages generation quota tracking and limits
 */
export const useQuotaStore = defineStore('quota', () => {
  // State
  const quota = ref<GenerationQuotaDTO | null>(null)
  const isLoading = ref(false)
  const error = ref<ErrorResponse | null>(null)

  // Getters
  const isQuotaExceeded = computed(() => {
    if (!quota.value) return false
    return quota.value.used >= quota.value.limit
  })

  const remainingGenerations = computed(() => {
    if (!quota.value) return 10
    return quota.value.limit - quota.value.used
  })

  /**
   * Fetch generation quota
   * Loads quota information from database
   */
  async function fetchQuota(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const {
        data: { user }
      } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const quotaResult = await checkGenerationQuota(user.id)

      quota.value = {
        used: quotaResult.used,
        limit: quotaResult.limit,
        remaining: quotaResult.limit - quotaResult.used,
        reset_at: quotaResult.resetAt
      }
    } catch (err: any) {
      error.value = {
        error: {
          code: err.code || 'FETCH_ERROR',
          message: err.message || 'Failed to fetch quota'
        }
      }
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Increment used count (optimistic update)
   * Called after successful plan generation
   */
  function incrementUsed(): void {
    if (quota.value) {
      quota.value.used += 1
      quota.value.remaining = quota.value.limit - quota.value.used
    }
  }

  return {
    // State
    quota,
    isLoading,
    error,
    // Getters
    isQuotaExceeded,
    remainingGenerations,
    // Actions
    fetchQuota,
    incrementUsed
  }
})

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { supabaseClient } from '@/db/supabase.client'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const isLoading = ref(true)

  const isAuthenticated = computed(() => !!session.value)
  const userEmail = computed(() => user.value?.email ?? null)

  /**
   * Initialize auth state and set up the onAuthStateChange listener.
   * Must be called once synchronously in App.vue <script setup> before any navigation.
   */
  function initialize(): void {
    supabaseClient.auth.onAuthStateChange((event: AuthChangeEvent, newSession: Session | null) => {
      session.value = newSession
      user.value = newSession?.user ?? null

      if (event === 'SIGNED_OUT') {
        resetAllStores()
      }
    })

    supabaseClient.auth.getSession().then(({ data }) => {
      session.value = data.session
      user.value = data.session?.user ?? null
      isLoading.value = false
    })
  }

  async function login(email: string, password: string): Promise<void> {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password })
    if (error) throw error
    // State is updated via onAuthStateChange listener
  }

  async function register(email: string, password: string): Promise<void> {
    const { error } = await supabaseClient.auth.signUp({ email, password })
    if (error) throw error
    // State is updated via onAuthStateChange listener (SIGNED_IN event fires automatically)
  }

  async function logout(): Promise<void> {
    const { error } = await supabaseClient.auth.signOut()
    if (error) throw error
    // State is cleared via onAuthStateChange listener (SIGNED_OUT event)
  }

  /**
   * Reset all stores on logout to prevent data leakage between sessions.
   * Composition API stores do not support Pinia's $reset() — use explicit clear actions.
   */
  function resetAllStores(): void {
    import('@/stores/trip.store').then(({ useTripStore }) => useTripStore().clearTrip())
    import('@/stores/plan.store').then(({ usePlanStore }) => usePlanStore().discardCandidate())
    import('@/stores/profile.store').then(({ useProfileStore }) => {
      useProfileStore().profile = null
    })
    import('@/stores/quota.store').then(({ useQuotaStore }) => {
      useQuotaStore().quota = null
    })
  }

  return {
    user,
    session,
    isLoading,
    isAuthenticated,
    userEmail,
    initialize,
    login,
    register,
    logout
  }
})

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  TripDTO,
  TripPreferencesDto,
  ErrorResponse,
  DashboardTripViewModel,
  PaginationDTO,
  TripStatus
} from '@/types'
import { supabaseClient } from '@/db/supabase.client'
import {
  getTripById,
  updateTrip,
  createTrip as createTripService
} from '@/lib/services/trip.service'

// Module-level helper — derives trip status from raw DB fields
function deriveTripStatus(noteBody: string | null, planJson: object | null): TripStatus {
  if (planJson !== null) return 'CONFIRMED'
  if (noteBody !== null && noteBody.trim() !== '') return 'DRAFT'
  return 'CREATED'
}

// Raw shape returned by the Supabase trips query before transformation
interface TripListRaw {
  id: number
  user_id: string
  title: string
  note_body: string | null
  plan_json: object | null
  created_at: string
  updated_at: string
}

/**
 * Trip Store
 * Manages current trip data, loading states, and trip operations
 */
export const useTripStore = defineStore('trip', () => {
  // State — current trip (trip detail view)
  const currentTrip = ref<TripDTO | null>(null)
  const isLoading = ref(false)
  const isSaving = ref(false)
  const error = ref<ErrorResponse | null>(null)

  // State — trips list (dashboard view)
  const trips = ref<DashboardTripViewModel[]>([])
  const tripsPagination = ref<PaginationDTO>({
    current_page: 1,
    total_pages: 1,
    total_count: 0,
    limit: 20
  })
  const isLoadingTrips = ref(false)
  const isCreatingTrip = ref(false)
  const tripsError = ref<ErrorResponse | null>(null)

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
   * Update trip destination
   * Uses optimistic update with rollback on error
   */
  async function updateTripDestination(tripId: number, destination: string): Promise<void> {
    if (!currentTrip.value) return

    const previousDestination = currentTrip.value.destination
    currentTrip.value.destination = destination // Optimistic update

    try {
      const {
        data: { user }
      } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const updated = await updateTrip(tripId, user.id, { destination })
      currentTrip.value = updated
    } catch (err: any) {
      if (currentTrip.value) {
        currentTrip.value.destination = previousDestination
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
   * Fetch paginated trips list for the dashboard
   */
  async function fetchTrips(page = 1, limit = 20): Promise<void> {
    isLoadingTrips.value = true
    tripsError.value = null

    try {
      const {
        data: { user }
      } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const from = (page - 1) * limit
      const to = from + limit - 1

      const {
        data,
        error: fetchError,
        count
      } = await supabaseClient
        .from('trips')
        .select('id, user_id, title, note_body, plan_json, created_at, updated_at', {
          count: 'exact'
        })
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .range(from, to)

      if (fetchError) throw fetchError

      const rows = (data ?? []) as TripListRaw[]
      trips.value = rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: deriveTripStatus(row.note_body, row.plan_json),
        notePreview: row.note_body
          ? row.note_body.slice(0, 100) + (row.note_body.length > 100 ? '…' : '')
          : '',
        updatedAt: row.updated_at
      }))

      const total = count ?? 0
      tripsPagination.value = {
        current_page: page,
        total_pages: Math.max(1, Math.ceil(total / limit)),
        total_count: total,
        limit
      }
    } catch (err: any) {
      tripsError.value = {
        error: {
          code: err.code || 'FETCH_ERROR',
          message: err.message || 'Failed to fetch trips'
        }
      }
    } finally {
      isLoadingTrips.value = false
    }
  }

  /**
   * Delete a trip by ID, then remove it from the local list
   */
  async function deleteTripById(tripId: number): Promise<void> {
    const {
      data: { user }
    } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { error: deleteError } = await supabaseClient
      .from('trips')
      .delete()
      .eq('id', tripId)
      .eq('user_id', user.id)

    if (deleteError) throw deleteError

    trips.value = trips.value.filter((t) => t.id !== tripId)
    tripsPagination.value = {
      ...tripsPagination.value,
      total_count: Math.max(0, tripsPagination.value.total_count - 1)
    }
  }

  /**
   * Create a new trip and return its ID
   */
  async function createTrip(title = 'New Trip'): Promise<number> {
    isCreatingTrip.value = true
    try {
      const {
        data: { user }
      } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { id } = await createTripService({ title }, user.id)
      return id
    } finally {
      isCreatingTrip.value = false
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
    // State — current trip
    currentTrip,
    isLoading,
    isSaving,
    error,
    // State — trips list
    trips,
    tripsPagination,
    isLoadingTrips,
    isCreatingTrip,
    tripsError,
    // Getters
    tripStatus,
    hasNote,
    hasPlan,
    // Actions
    fetchTrip,
    updateTripTitle,
    updateTripDestination,
    updateTripNote,
    updateTripPreferences,
    createTrip,
    clearTrip,
    fetchTrips,
    deleteTripById
  }
})

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  TripDTO,
  TripPreferencesDto,
  ErrorResponse,
  DashboardTripViewModel,
  PaginationDTO,
  CreateTripCommand,
  UpdateTripCommand,
  TripStatus
} from '@/types'
import { supabaseClient } from '@/db/supabase.client'
import {
  getTripById,
  updateTrip as updateTripService,
  createTrip as createTripService,
  deleteTrip as deleteTripService,
  getTrips as getTripsService
} from '@/lib/services/trip.service'
import {
  createUnauthorizedError,
  createInvalidTripIdError,
  createValidationError,
  toApiError
} from '@/lib/errors/api.error'
import {
  validateCreateTripCommand,
  validateUpdateTripCommand,
  getTripsQuerySchema
} from '@/lib/validation/trip.schemas'
import { useProfileStore } from '@/stores/profile.store'

/**
 * Validate and coerce a raw tripId value (from URL params or caller) to a positive integer.
 * Throws INVALID_TRIP_ID (400) if the value is not a safe positive integer.
 */
function validateTripId(tripIdRaw: string | number): number {
  const id = typeof tripIdRaw === 'string' ? parseInt(tripIdRaw, 10) : tripIdRaw
  if (!Number.isInteger(id) || id <= 0) throw createInvalidTripIdError(String(tripIdRaw))
  return id
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
   * Validates tripId (must be a positive integer), then validates ownership and derives status.
   */
  async function fetchTrip(tripId: string | number): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const validatedId = validateTripId(tripId)

      const {
        data: { user }
      } = await supabaseClient.auth.getUser()
      if (!user) throw createUnauthorizedError()

      currentTrip.value = await getTripById(validatedId, user.id)
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

      const updated = await updateTripService(tripId, user.id, { title })
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

      const updated = await updateTripService(tripId, user.id, { destination })
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

      const updated = await updateTripService(tripId, user.id, { note_body: noteBody })
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

      const updated = await updateTripService(tripId, user.id, {
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
   * Fetch paginated trips list for the dashboard with optional status filter.
   * Validates query params via Zod, delegates to the getTrips service,
   * then maps TripListItemDTO[] → DashboardTripViewModel[] for UI consumption.
   */
  async function fetchTrips(page = 1, limit = 20, status?: TripStatus): Promise<void> {
    isLoadingTrips.value = true
    tripsError.value = null

    try {
      const {
        data: { user }
      } = await supabaseClient.auth.getUser()
      if (!user) throw createUnauthorizedError()

      const queryResult = getTripsQuerySchema.safeParse({ page, limit, status })
      if (!queryResult.success) {
        const details = Object.fromEntries(
          queryResult.error.issues.map((i) => [i.path.join('.'), i.message])
        )
        throw createValidationError('Invalid query parameters', details)
      }

      const result = await getTripsService(user.id, queryResult.data)

      // Map TripListItemDTO[] → DashboardTripViewModel[] for UI consumption
      trips.value = result.trips.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        notePreview: '',
        updatedAt: item.updated_at
      }))

      tripsPagination.value = result.pagination
    } catch (err: unknown) {
      const apiErr = toApiError(err)
      tripsError.value = apiErr.toResponse()
      throw apiErr
    } finally {
      isLoadingTrips.value = false
    }
  }

  /**
   * Delete a trip by ID with ownership validation, then remove it from the local list.
   * Uses the two-step fetch→ownership-check→delete pattern (see trip.service.ts).
   */
  async function deleteTripById(tripId: number): Promise<void> {
    try {
      const {
        data: { user }
      } = await supabaseClient.auth.getUser()
      if (!user) throw createUnauthorizedError()

      await deleteTripService(tripId, user.id)

      trips.value = trips.value.filter((t) => t.id !== tripId)
      if (currentTrip.value?.id === tripId) currentTrip.value = null

      tripsPagination.value = {
        ...tripsPagination.value,
        total_count: Math.max(0, tripsPagination.value.total_count - 1)
      }
    } catch (err: unknown) {
      const apiErr = toApiError(err)
      tripsError.value = apiErr.toResponse()
      throw apiErr
    }
  }

  /**
   * Create a new trip, apply profile preference defaults for omitted fields,
   * prepend the result to the dashboard list and return the full TripDTO.
   */
  async function createTrip(command: CreateTripCommand): Promise<TripDTO> {
    isCreatingTrip.value = true
    try {
      const {
        data: { user }
      } = await supabaseClient.auth.getUser()
      if (!user) throw createUnauthorizedError()

      const validated = validateCreateTripCommand(command)

      // Apply profile defaults for any preference fields omitted from the command
      const profileStore = useProfileStore()
      const profile = profileStore.profile
      const resolved: CreateTripCommand = {
        ...validated,
        what: validated.what ?? profile?.default_what ?? [],
        speed: validated.speed ?? profile?.default_speed ?? null,
        type: validated.type ?? profile?.default_type ?? null,
        budget: validated.budget ?? profile?.default_budget ?? null
      }

      const newTrip = await createTripService(resolved, user.id)

      // Prepend to dashboard list so it appears at the top without a full refetch
      const viewModel: DashboardTripViewModel = {
        id: newTrip.id,
        title: newTrip.title,
        status: newTrip.status,
        notePreview: newTrip.note_body
          ? newTrip.note_body.slice(0, 100) + (newTrip.note_body.length > 100 ? '…' : '')
          : '',
        updatedAt: newTrip.updated_at
      }
      trips.value = [viewModel, ...trips.value]

      return newTrip
    } catch (err: unknown) {
      const apiErr = toApiError(err)
      tripsError.value = apiErr.toResponse()
      throw apiErr
    } finally {
      isCreatingTrip.value = false
    }
  }

  /**
   * Save all editable trip fields at once (title, destination, note, preferences).
   * Used by the explicit Save button in TripView.
   */
  async function saveAllFields(tripId: number, fields: UpdateTripCommand): Promise<void> {
    if (!currentTrip.value) return
    isSaving.value = true
    try {
      const {
        data: { user }
      } = await supabaseClient.auth.getUser()
      if (!user) throw createUnauthorizedError()

      const updated = await updateTripService(tripId, user.id, fields)
      currentTrip.value = updated
    } finally {
      isSaving.value = false
    }
  }

  /**
   * General-purpose trip update action (PATCH /api/trips/{tripId}).
   *
   * Orchestrates authentication, tripId validation, Zod command validation,
   * and delegates to the service layer. Sets currentTrip on success.
   *
   * @param tripId  - Trip identifier (positive integer or string coerced to int)
   * @param command - Partial UpdateTripCommand (all fields optional)
   * @throws ApiError - 400/401/403/404/500 depending on failure
   */
  async function updateTrip(tripId: number | string, command: UpdateTripCommand): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const {
        data: { user }
      } = await supabaseClient.auth.getUser()
      if (!user) throw createUnauthorizedError()

      const validatedId = validateTripId(tripId)
      const validated = validateUpdateTripCommand(command)
      const updated = await updateTripService(validatedId, user.id, validated)
      currentTrip.value = updated
    } catch (err: unknown) {
      const apiErr = toApiError(err)
      error.value = apiErr.toResponse()
      throw apiErr
    } finally {
      isLoading.value = false
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
    updateTrip,
    updateTripTitle,
    updateTripDestination,
    updateTripNote,
    updateTripPreferences,
    saveAllFields,
    createTrip,
    clearTrip,
    fetchTrips,
    deleteTripById
  }
})

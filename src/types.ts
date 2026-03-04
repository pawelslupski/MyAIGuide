import type { Tables } from './db/database.types'

// ============================================================================
// PREFERENCE DOMAIN TYPES
// ============================================================================

export type WhatPreference = 'nature' | 'culture_museums' | 'beach_relax' | 'city_break' | 'foodie'
export type SpeedPreference = 'slow_chill' | 'balance' | 'intensive'
export type TypePreference = 'base' | 'base_with_trips' | 'roadtrip'
export type BudgetPreference = 'budget' | 'moderate' | 'luxury'

// ============================================================================
// TRIP STATUS
// ============================================================================

/** Derived from DB fields: note_body presence + plan_json presence. Never stored in the DB. */
export type TripStatus = 'CREATED' | 'DRAFT' | 'CONFIRMED'

// ============================================================================
// PLAN JSON STRUCTURE
// ============================================================================

export type TimeOfDay = 'morning' | 'afternoon' | 'evening'

export interface Activity {
  timeOfDay: TimeOfDay
  locationName: string
  description: string
  categoryTag: WhatPreference
}

export interface Day {
  day: number
  activities: Activity[]
}

export interface PlanJson {
  days: Day[]
}

// ============================================================================
// PROFILE DTOs
// ============================================================================

/**
 * Profile DTO returned by GET /api/profiles/me.
 * Extends the raw DB row, narrowing the preference fields from `string` to
 * their respective enum union types for type-safe consumption on the client.
 */
export interface ProfileDTO extends Omit<
  Tables<'profiles'>,
  'default_what' | 'default_speed' | 'default_type' | 'default_budget'
> {
  default_what: WhatPreference[]
  default_speed: SpeedPreference | null
  default_type: TypePreference | null
  default_budget: BudgetPreference | null
}

/**
 * Command model for PATCH /api/profiles/me.
 * All fields optional (partial update). Preference fields are typed with
 * domain enums rather than plain strings to enforce valid values at the call site.
 */
export interface UpdateProfileCommand {
  has_kids?: boolean
  has_pets?: boolean
  has_mobility_issues?: boolean
  has_dietary_preferences?: boolean
  /** Required (non-empty) when has_dietary_preferences is true; null otherwise. */
  dietary_preferences_description?: string | null
  default_what?: WhatPreference[]
  default_speed?: SpeedPreference
  default_type?: TypePreference
  default_budget?: BudgetPreference
}

// ============================================================================
// TRIP DTOs
// ============================================================================

/**
 * Trip list item DTO returned in GET /api/trips response array.
 * Carries just the fields needed for the dashboard card plus computed status.
 */
export interface TripListItemDTO extends Pick<
  Tables<'trips'>,
  | 'id'
  | 'user_id'
  | 'title'
  | 'destination'
  | 'num_days'
  | 'num_people'
  | 'created_at'
  | 'updated_at'
> {
  status: TripStatus
}

/**
 * Full trip DTO returned by GET /api/trips/{tripId}.
 * Narrows string preference columns to domain enum types and replaces the
 * generic `Json` plan_json with the structured PlanJson type.
 */
export interface TripDTO extends Omit<
  Tables<'trips'>,
  'plan_json' | 'what' | 'speed' | 'type' | 'budget'
> {
  what: WhatPreference[]
  speed: SpeedPreference | null
  type: TypePreference | null
  budget: BudgetPreference | null
  plan_json: PlanJson | null
  status: TripStatus
}

/**
 * Command model for POST /api/trips.
 * Preference fields are optional – omitted values are copied from the user's
 * profile defaults server-side.
 */
export interface CreateTripCommand {
  title: string
  destination?: string | null
  note_body?: string | null
  what?: WhatPreference[]
  speed?: SpeedPreference | null
  type?: TypePreference | null
  budget?: BudgetPreference | null
  num_days?: number | null
  num_people?: number | null
}

/**
 * Command model for PATCH /api/trips/{tripId}.
 * All fields optional (partial update). Does not include plan_json – use
 * SavePlanCommand for that.
 */
export interface UpdateTripCommand {
  title?: string
  destination?: string | null
  note_body?: string | null
  what?: WhatPreference[]
  speed?: SpeedPreference | null
  type?: TypePreference | null
  budget?: BudgetPreference | null
  num_days?: number | null
  num_people?: number | null
}

/**
 * Command model for PUT /api/trips/{tripId}/plan.
 * Persists the in-memory plan candidate to the database.
 */
export interface SavePlanCommand {
  plan_json: PlanJson
  plan_language: string
}

// ============================================================================
// PAGINATION
// ============================================================================

export interface PaginationDTO {
  current_page: number
  total_pages: number
  total_count: number
  limit: number
}

/** Response DTO for GET /api/trips */
export interface TripsListDTO {
  trips: TripListItemDTO[]
  pagination: PaginationDTO
}

/** Query parameters for GET /api/trips (after Zod validation and defaults applied). */
export interface GetTripsQuery {
  page: number
  limit: number
  status?: TripStatus
}

// ============================================================================
// PLAN GENERATION DTOs
// ============================================================================

/** Response DTO for GET /api/users/me/generation-quota */
export interface GenerationQuotaDTO {
  used: number
  limit: number
  remaining: number
  reset_at: string
}

/**
 * Response DTO for POST /api/trips/{tripId}/generate-plan.
 * The plan is returned to the client but NOT yet persisted in the database.
 * The client stores it in Pinia state until the user explicitly saves it.
 */
export interface GeneratedPlanDTO {
  plan: PlanJson
  language: string
  model_used: string
  generated_at: string
  /** Updated quota snapshot so the client can refresh the counter without an extra request. */
  quota: GenerationQuotaDTO
}

/**
 * Public shape of a plan_generations row returned to the client.
 * `user_id` is intentionally excluded from the API response per api-plan.md §2.6.
 */
export interface PlanGenerationHistoryItemDTO {
  id: number
  trip_id: number
  status: 'success' | 'api_error' | 'validation_error'
  model_name: string | null
  error_message: string | null
  created_at: string
}

/** Response DTO for GET /api/trips/{tripId}/generations */
export interface PlanGenerationHistoryDTO {
  generations: PlanGenerationHistoryItemDTO[]
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/** Command model for DELETE /api/users/me */
export interface DeleteAccountCommand {
  /** Must equal "DELETE MY ACCOUNT" to confirm intentional deletion. */
  confirmation: string
}

// ============================================================================
// DASHBOARD VIEW MODEL (UI layer)
// ============================================================================

/**
 * View model for a trip card on the dashboard.
 * Derived from TripListItemDTO after computing status and truncating the note preview.
 */
export interface DashboardTripViewModel {
  id: number
  title: string
  status: TripStatus
  notePreview: string
  updatedAt: string
}

// ============================================================================
// INTERNAL SERVICE TYPES
// ============================================================================

/**
 * Snapshot of resolved trip preferences used between service layers.
 * Reflects per-trip values after profile defaults have been applied.
 */
export interface TripPreferencesDto {
  what: WhatPreference[]
  speed: SpeedPreference | null
  type: TypePreference | null
  budget: BudgetPreference | null
  num_days: number | null
  num_people: number | null
}

/** Status values stored in the plan_generations table. */
export type PlanGenerationStatus = 'success' | 'api_error' | 'validation_error'

/** Parameters for recording a generation attempt in plan_generations. */
export interface RecordGenerationParams {
  userId: string
  tripId: number
  status: PlanGenerationStatus
  modelName?: string
  errorMessage?: string
}

/**
 * Quota check result returned by the rate-limiting service.
 * `allowed` is false when the user has reached the 10/24h limit.
 */
export interface QuotaCheckResult {
  allowed: boolean
  used: number
  limit: number
  resetAt: string
}

/**
 * Internal command model used by the plan generation Edge Function.
 * Aggregates all context needed to build the AI prompt.
 */
export interface GeneratePlanCommand {
  userId: string
  tripId: number
  /** destination is validated non-null before this command is constructed. */
  destination: string
  noteBody: string
  userProfile: {
    hasKids: boolean
    hasPets: boolean
    hasMobilityIssues: boolean
    hasDietaryPreferences: boolean
    /** Non-null when hasDietaryPreferences is true; included verbatim in the prompt. */
    dietaryPreferencesDescription: string | null
  }
  tripPreferences: TripPreferencesDto
}

// ============================================================================
// AI SERVICE TYPES
// ============================================================================

/** Input parameters passed to the OpenRouter.ai call. */
export interface AIPlanParams {
  language: string
  noteBody: string
  destination: string
  userProfile: {
    hasKids: boolean
    hasPets: boolean
    hasMobilityIssues: boolean
    hasDietaryPreferences: boolean
    dietaryPreferencesDescription: string | null
  }
  tripPreferences: TripPreferencesDto
}

/** Parsed response from the OpenRouter.ai API. */
export interface AIServiceResponse {
  plan: PlanJson
  model_used: string
}

// ============================================================================
// ERROR RESPONSE TYPE
// ============================================================================

/** Standard error response structure used across all API endpoints. */
export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

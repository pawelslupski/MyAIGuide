import type { Tables, TablesUpdate } from './db/database.types'

// ============================================================================
// PREFERENCE TYPES (Validation Enums)
// ============================================================================

export type WhatPreference = 'nature' | 'culture_museums' | 'beach_relax' | 'city_break' | 'foodie'
export type SpeedPreference = 'slow_chill' | 'balance' | 'intensive'
export type TypePreference = 'base' | 'base_with_trips' | 'roadtrip'
export type BudgetPreference = 'budget' | 'moderate' | 'luxury'

// ============================================================================
// TRIP STATUS
// ============================================================================

export type TripStatus = 'CREATED' | 'DRAFT' | 'CONFIRMED'

// ============================================================================
// PLAN JSON STRUCTURE
// ============================================================================

export interface Activity {
  timeOfDay: string
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
 * Profile DTO returned by GET /api/profiles/me
 * Extends database Row with computed is_complete field
 * Note: user_id is included per API spec but may be redundant since user is authenticated
 */
export interface ProfileDTO extends Tables<'profiles'> {
  is_complete: boolean
}

/**
 * Command model for PUT /api/profiles/me
 * Contains only user-editable preference fields
 */
export type UpdateProfileCommand = Pick<
  TablesUpdate<'profiles'>,
  | 'has_kids'
  | 'has_pets'
  | 'has_mobility_issues'
  | 'has_dietary_preferences'
  | 'default_what'
  | 'default_speed'
  | 'default_type'
  | 'default_budget'
>

// ============================================================================
// TRIP DTOs
// ============================================================================

/**
 * Trip list item DTO returned in GET /api/trips response
 * Contains subset of trip fields plus computed status
 * Note: user_id is included per API spec but may be redundant since user is authenticated
 */
export interface TripListItemDTO extends Pick<
  Tables<'trips'>,
  'id' | 'user_id' | 'title' | 'created_at' | 'updated_at'
> {
  status: TripStatus
}

/**
 * Full trip DTO returned by GET /api/trips/{tripId}
 * Contains all trip fields with typed plan_json and computed status
 * Note: user_id is included per API spec but may be redundant since user is authenticated
 */
export interface TripDTO extends Omit<Tables<'trips'>, 'plan_json'> {
  plan_json: PlanJson | null
  status: TripStatus
}

/**
 * Command model for POST /api/trips
 * Contains fields required/allowed for trip creation
 */
export interface CreateTripCommand {
  title: string
  note_body?: string | null
  what?: WhatPreference[] | null
  speed?: SpeedPreference | null
  type?: TypePreference | null
  budget?: BudgetPreference | null
}

/**
 * Command model for PUT /api/trips/{tripId}
 * All fields optional for partial updates
 */
export interface UpdateTripCommand {
  title?: string
  note_body?: string | null
  what?: WhatPreference[] | null
  speed?: SpeedPreference | null
  type?: TypePreference | null
  budget?: BudgetPreference | null
}

/**
 * Command model for PUT /api/trips/{tripId}/plan
 * Saves a plan to the database
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

/**
 * Response DTO for GET /api/trips
 * Contains paginated list of trips
 */
export interface TripsListDTO {
  trips: TripListItemDTO[]
  pagination: PaginationDTO
}

// ============================================================================
// PLAN GENERATION DTOs
// ============================================================================

/**
 * Response DTO for GET /api/users/me/generation-quota
 * Contains quota information for plan generation
 */
export interface GenerationQuotaDTO {
  used: number
  limit: number
  remaining: number
  reset_at: string
}

/**
 * Response DTO for POST /api/trips/{tripId}/generate-plan
 * Contains generated plan (not yet saved to database)
 */
export interface GeneratedPlanDTO {
  plan: PlanJson
  language: string
  model_used: string
  generated_at: string
}

/**
 * Plan generation history item DTO
 * Returned in GET /api/trips/{tripId}/generations response
 * Directly maps to plan_generations table Row
 */
export type PlanGenerationHistoryItemDTO = Tables<'plan_generations'>

/**
 * Response DTO for GET /api/trips/{tripId}/generations
 * Contains list of generation attempts for a trip
 */
export interface PlanGenerationHistoryDTO {
  generations: PlanGenerationHistoryItemDTO[]
}

// ============================================================================
// INTERNAL SERVICE TYPES
// ============================================================================

/**
 * NAMING CONVENTIONS:
 * - DTOs (API responses): Use snake_case for JSON fields (Supabase convention)
 * - TypeScript types: Use camelCase for properties
 * - Supabase client handles automatic conversion between conventions
 */

/**
 * Trip preferences DTO
 * Extracted from trip or profile defaults
 * Used internally to pass preferences between service layers
 */
export interface TripPreferencesDto {
  what: WhatPreference[]
  speed: SpeedPreference | null
  type: TypePreference | null
  budget: BudgetPreference | null
}

/**
 * Command model for plan generation service
 * Used internally to pass data between layers
 */
export interface GeneratePlanCommand {
  userId: string
  tripId: number
  noteBody: string
  userProfile: {
    hasKids: boolean
    hasPets: boolean
    hasMobilityIssues: boolean
    hasDietaryPreferences: boolean
  }
  tripPreferences: TripPreferencesDto
}

/**
 * Quota check result
 * Returned by quota validation service
 */
export interface QuotaCheckResult {
  allowed: boolean
  used: number
  limit: number
  resetAt: string // ISO 8601 timestamp
}

/**
 * Plan generation status
 * Used in plan_generations table
 */
export type PlanGenerationStatus = 'success' | 'api_error' | 'validation_error'

/**
 * Parameters for recording generation attempt
 */
export interface RecordGenerationParams {
  userId: string
  tripId: number
  status: PlanGenerationStatus
  modelName?: string
  errorMessage?: string
}

// ============================================================================
// MOCK AI SERVICE TYPES (Phase 1 - Development)
// ============================================================================

/**
 * Mock AI service input parameters
 * Used during development to simulate AI plan generation
 */
export interface MockPlanParams {
  language: string
  tripPreferences: TripPreferencesDto
}

/**
 * Mock AI service response
 * Simulates real AI service response structure
 */
export interface MockPlanResponse {
  plan: PlanJson
  model_used: string
}

// ============================================================================
// AI SERVICE TYPES (Phase 2 - Production)
// ============================================================================

/**
 * AI service input parameters
 * Used to call OpenRouter.ai via Supabase Edge Function
 */
export interface AIServiceParams {
  prompt: string
  language: string
  model?: string // Optional, defaults to "anthropic/claude-3.5-sonnet"
}

/**
 * AI service response
 * Returned from OpenRouter.ai via Supabase Edge Function
 */
export interface AIServiceResponse {
  plan: PlanJson
  model_used: string
}

// ============================================================================
// ERROR RESPONSE TYPES
// ============================================================================

/**
 * Standard error response structure used across all API endpoints
 */
export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

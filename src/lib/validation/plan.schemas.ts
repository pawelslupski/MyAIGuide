import { z } from 'zod'

/**
 * Zod validation schemas for plan generation
 * Used to validate AI-generated plan responses
 */

// Enum for WhatPreference values
export const WhatPreferenceSchema = z.enum([
  'nature',
  'culture_museums',
  'beach_relax',
  'city_break',
  'foodie'
])

// Activity schema
export const ActivitySchema = z.object({
  timeOfDay: z.string().min(1, 'timeOfDay is required'),
  locationName: z.string().min(1, 'locationName is required'),
  description: z.string().min(1, 'description is required'),
  categoryTag: WhatPreferenceSchema
})

// Day schema
export const DaySchema = z.object({
  day: z.number().int().positive('day must be a positive integer'),
  activities: z.array(ActivitySchema).min(1, 'Each day must have at least one activity')
})

// Plan JSON schema
export const PlanJsonSchema = z.object({
  days: z.array(DaySchema).min(1, 'Plan must have at least one day')
})

// Edge Function response schema (for Phase 2)
export const EdgeFunctionResponseSchema = z.object({
  plan: PlanJsonSchema,
  model_used: z.string().min(1, 'model_used is required')
})

// Mock AI response schema (for Phase 1)
export const MockPlanResponseSchema = z.object({
  plan: PlanJsonSchema,
  model_used: z.string().min(1, 'model_used is required')
})

/**
 * Validate plan JSON structure
 * Throws ZodError if validation fails
 */
export function validatePlanJson(data: unknown) {
  return PlanJsonSchema.parse(data)
}

/**
 * Validate AI service response
 * Throws ZodError if validation fails
 */
export function validateAIResponse(data: unknown) {
  return MockPlanResponseSchema.parse(data)
}

// ============================================================================
// SAVE PLAN COMMAND VALIDATION
// ============================================================================

/**
 * Save plan command schema
 * Validates plan_json and plan_language for PUT /api/trips/:id/plan
 */
export const SavePlanCommandSchema = z.object({
  plan_json: PlanJsonSchema,
  plan_language: z
    .string()
    .min(1, 'Language code is required')
    .max(10, 'Language code must be at most 10 characters')
    .regex(/^[a-z]{2,10}$/i, 'Must be a valid language code (e.g., "en", "pl")')
})

/**
 * Validate save plan command
 * Throws ZodError if validation fails
 */
export function validateSavePlanCommand(data: unknown) {
  return SavePlanCommandSchema.parse(data)
}

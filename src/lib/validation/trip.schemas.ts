import { z } from 'zod'
import { WhatPreferenceSchema } from './plan.schemas'

/**
 * Validates a raw tripId value (URL param string or number) as a positive integer.
 * Use this in route handlers or server-side code that receives the id as a string.
 */
export const tripIdSchema = z.coerce
  .number({ error: 'Trip ID must be a number' })
  .int('Trip ID must be an integer')
  .positive('Trip ID must be a positive integer')

export type TripIdInput = z.input<typeof tripIdSchema>

export const getTripsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['CREATED', 'DRAFT', 'CONFIRMED']).optional()
})

export type GetTripsQueryInput = z.input<typeof getTripsQuerySchema>
export type GetTripsQuery = z.output<typeof getTripsQuerySchema>

export const CreateTripCommandSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  destination: z.string().max(50).nullable().optional(),
  num_days: z.number().int().min(1).nullable().optional(),
  num_people: z.number().int().min(1).nullable().optional(),
  what: z.array(WhatPreferenceSchema).optional(),
  speed: z.enum(['slow_chill', 'balance', 'intensive']).nullable().optional(),
  type: z.enum(['base', 'base_with_trips', 'roadtrip']).nullable().optional(),
  budget: z.enum(['budget', 'moderate', 'luxury']).nullable().optional(),
  note_body: z.string().max(10000).nullable().optional()
})

export function validateCreateTripCommand(data: unknown) {
  return CreateTripCommandSchema.parse(data)
}

/**
 * Zod schema for PATCH /api/trips/{tripId}.
 * All fields are optional (partial update).
 * Does NOT include plan_json / plan_language — those are managed by PUT /api/trips/{tripId}/plan.
 */
export const UpdateTripCommandSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').max(255).optional(),
  destination: z.string().max(50).nullable().optional(),
  num_days: z.number().int().min(1).nullable().optional(),
  num_people: z.number().int().min(1).nullable().optional(),
  what: z.array(WhatPreferenceSchema).optional(),
  speed: z.enum(['slow_chill', 'balance', 'intensive']).nullable().optional(),
  type: z.enum(['base', 'base_with_trips', 'roadtrip']).nullable().optional(),
  budget: z.enum(['budget', 'moderate', 'luxury']).nullable().optional(),
  note_body: z.string().max(10000).nullable().optional()
})

export function validateUpdateTripCommand(data: unknown) {
  return UpdateTripCommandSchema.parse(data)
}

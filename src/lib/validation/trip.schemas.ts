import { z } from 'zod'

/**
 * Validates a raw tripId value (URL param string or number) as a positive integer.
 * Use this in route handlers or server-side code that receives the id as a string.
 */
export const tripIdSchema = z.coerce
  .number({ invalid_type_error: 'Trip ID must be a number' })
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

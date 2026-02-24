import { z } from 'zod'
import { WhatPreferenceSchema } from './plan.schemas'

export const ProfileDTOSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.string().uuid(),
  has_kids: z.boolean(),
  has_pets: z.boolean(),
  has_mobility_issues: z.boolean(),
  has_dietary_preferences: z.boolean(),
  dietary_preferences_description: z.string().nullable(),
  default_what: z.array(WhatPreferenceSchema).default([]),
  default_speed: z.enum(['slow_chill', 'balance', 'intensive']).nullable(),
  default_type: z.enum(['base', 'base_with_trips', 'roadtrip']).nullable(),
  default_budget: z.enum(['budget', 'moderate', 'luxury']).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
})

export function validateProfileDTO(data: unknown) {
  return ProfileDTOSchema.parse(data)
}

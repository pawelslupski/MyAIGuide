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
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true })
})

export function validateProfileDTO(data: unknown) {
  return ProfileDTOSchema.parse(data)
}

export const UpdateProfileCommandSchema = z
  .object({
    has_kids: z.boolean().optional(),
    has_pets: z.boolean().optional(),
    has_mobility_issues: z.boolean().optional(),
    has_dietary_preferences: z.boolean().optional(),
    dietary_preferences_description: z.string().nullable().optional(),
    default_what: z.array(WhatPreferenceSchema).optional(),
    default_speed: z.enum(['slow_chill', 'balance', 'intensive']).optional(),
    default_type: z.enum(['base', 'base_with_trips', 'roadtrip']).optional(),
    default_budget: z.enum(['budget', 'moderate', 'luxury']).optional()
  })
  .superRefine((data, ctx) => {
    if (data.has_dietary_preferences === true) {
      if (!data.dietary_preferences_description?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dietary_preferences_description'],
          message: 'Required and non-empty when has_dietary_preferences is true'
        })
      }
    }
    if (data.has_dietary_preferences === false && data.dietary_preferences_description != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dietary_preferences_description'],
        message: 'Must be null when has_dietary_preferences is false'
      })
    }
  })

export function validateUpdateProfileCommand(data: unknown) {
  return UpdateProfileCommandSchema.parse(data)
}

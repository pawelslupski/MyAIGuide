import type { ErrorResponse } from '@/types'

/**
 * Custom API Error class for consistent error handling
 * Extends Error with HTTP status code and structured error response
 */
export class ApiError extends Error {
  statusCode: number
  code: string
  details?: Record<string, unknown>

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }

  /**
   * Convert error to ErrorResponse format
   */
  toResponse(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details })
      }
    }
  }
}

/**
 * Error factory functions for common HTTP errors
 */
export function createUnauthorizedError(): ApiError {
  return new ApiError(401, 'UNAUTHORIZED', 'Authentication required')
}

export function createForbiddenError(): ApiError {
  return new ApiError(403, 'FORBIDDEN', "You don't have permission to access this trip")
}

export function createNotFoundError(): ApiError {
  return new ApiError(404, 'NOT_FOUND', 'Trip not found')
}

export function createProfileNotFoundError(): ApiError {
  return new ApiError(404, 'NOT_FOUND', 'Profile not found')
}

export function createInvalidTripIdError(provided: string): ApiError {
  return new ApiError(400, 'INVALID_TRIP_ID', 'Trip ID must be a valid positive integer', {
    provided
  })
}

export function createNoteRequiredError(): ApiError {
  return new ApiError(
    400,
    'VALIDATION_ERROR',
    'Note body exceeds maximum length for plan generation',
    {
      max_length: 10000
    }
  )
}

export function createQuotaExceededError(used: number, limit: number, resetAt: string): ApiError {
  return new ApiError(
    429,
    'QUOTA_EXCEEDED',
    `You have reached the limit of ${limit} plan generations in 24 hours`,
    {
      used,
      limit,
      reset_at: resetAt
    }
  )
}

export function createAIApiError(reason?: string): ApiError {
  return new ApiError(500, 'AI_API_ERROR', 'Failed to generate plan. Please try again.', {
    ...(reason && { reason })
  })
}

export function createServiceUnavailableError(): ApiError {
  return new ApiError(
    503,
    'SERVICE_UNAVAILABLE',
    'AI service is temporarily unavailable. Please try again later.'
  )
}

export function createValidationError(
  message: string,
  details?: Record<string, unknown>
): ApiError {
  return new ApiError(400, 'VALIDATION_ERROR', message, details)
}

export function createInternalError(message: string = 'An unexpected error occurred'): ApiError {
  return new ApiError(500, 'INTERNAL_ERROR', message)
}

/**
 * Check if error is an ApiError instance
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/**
 * Convert unknown error to ApiError
 * Useful for catch blocks to ensure consistent error handling
 */
export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error
  }

  if (error instanceof Error) {
    return createInternalError(error.message)
  }

  return createInternalError('An unexpected error occurred')
}

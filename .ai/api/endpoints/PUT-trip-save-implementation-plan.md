# API Endpoint Implementation Plan: PUT /api/trips/:id/plan

## 1. Endpoint Overview

**Purpose**: Save a generated AI plan (or manually edited plan) to the database, associating it 1:1 with a trip. This endpoint completes the core feature loop: generate plan → save plan → view saved plan.

**Key Functionality**:

- Updates `plan_json` and `plan_language` fields in the trips table
- Overwrites any existing plan (1:1 relationship)
- Changes trip status from DRAFT to CONFIRMED
- Validates trip ownership before allowing updates
- Returns full trip DTO with updated plan data

**Implementation Approach**: Use Supabase JS Client directly from frontend (no Edge Function needed, per API plan section 6.2).

---

## 2. Request Details

**HTTP Method**: `PUT`

**URL Structure**: `/api/trips/{tripId}/plan`

- Note: This is a logical endpoint - implementation uses Supabase client method, not HTTP call

**Path Parameters**:

- `tripId` (required): Trip identifier (positive integer)

**Authentication**: Required - user must be authenticated via Supabase Auth

**Request Body**:

```typescript
{
  "plan_json": {
    "days": [
      {
        "day": 1,
        "activities": [
          {
            "timeOfDay": "morning",
            "locationName": "Wawel Castle",
            "description": "Visit the historic royal castle",
            "categoryTag": "culture_museums"
          }
        ]
      }
    ]
  },
  "plan_language": "pl"
}
```

**Validation Rules**:

- `plan_json`: Required, must be valid JSON object with `days` array structure
- `plan_language`: Required, max 10 characters (e.g., "pl", "en")

---

## 3. Used Types

### Input Types

**SavePlanCommand** (to be created in `/src/types.ts`):

```typescript
export interface SavePlanCommand {
  plan_json: PlanJson
  plan_language: string
}
```

**PlanJson** (already exists in `/src/types.ts`):

```typescript
export interface PlanJson {
  days: Array<{
    day: number
    activities: Array<{
      timeOfDay: string
      locationName: string
      description: string
      categoryTag: string
    }>
  }>
}
```

### Output Types

**TripDTO** (already exists in `/src/types.ts`):

```typescript
export interface TripDTO extends Omit<Tables<'trips'>, 'plan_json'> {
  plan_json: PlanJson | null
  status: TripStatus
}
```

### Validation Schema

**SavePlanSchema** (to be created in `/src/lib/validation/plan.schemas.ts`):

- Validates `plan_json` structure using Zod
- Validates `plan_language` format and length
- Ensures all required fields are present

---

## 4. Response Details

### Success Response (200 OK)

Returns full `TripDTO` with updated plan:

```json
{
  "id": 456,
  "user_id": "uuid-string",
  "title": "Summer in Croatia",
  "note_body": "Planning a 10-day trip...",
  "what": ["culture_museums", "beach_relax"],
  "speed": "balance",
  "type": "roadtrip",
  "budget": "moderate",
  "plan_json": {
    "days": [...]
  },
  "plan_language": "pl",
  "status": "CONFIRMED",
  "created_at": "2024-01-10T09:00:00Z",
  "updated_at": "2024-01-23T12:15:00Z"
}
```

**Status Derivation**: After saving plan, status will be `CONFIRMED` because `plan_json` is NOT NULL.

### Error Responses

| Status Code | Error Code       | Description                  | Example Scenario                                 |
| ----------- | ---------------- | ---------------------------- | ------------------------------------------------ |
| 400         | VALIDATION_ERROR | Invalid plan JSON structure  | Missing `days` array, invalid activity structure |
| 401         | UNAUTHORIZED     | User not authenticated       | No valid session token                           |
| 403         | FORBIDDEN        | Trip belongs to another user | User tries to save plan to someone else's trip   |
| 404         | NOT_FOUND        | Trip does not exist          | Invalid tripId or trip deleted                   |
| 500         | INTERNAL_ERROR   | Database error               | Connection failure, constraint violation         |

**Error Response Format**:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid plan JSON structure",
    "details": {
      "plan_json": "Must contain 'days' array with valid structure"
    }
  }
}
```

---

## 5. Data Flow

### High-Level Flow

```
1. Frontend Component (e.g., PlanView.vue)
   ↓ calls savePlanToTrip()
2. Trip Service (src/lib/services/trip.service.ts)
   ↓ validates input with Zod schema
3. Validation Layer (src/lib/validation/plan.schemas.ts)
   ↓ returns validated data or throws error
4. Trip Service
   ↓ queries trip with Supabase client (RLS filtering)
5. Supabase Database (trips table)
   ↓ returns trip data or null
6. Trip Service
   ↓ validates ownership (defense in depth)
   ↓ updates plan_json and plan_language
7. Supabase Database
   ↓ returns updated trip
8. Trip Service
   ↓ derives status (CONFIRMED)
   ↓ returns TripDTO
9. Frontend Component
   ↓ updates UI with saved plan
```

### Detailed Steps

1. **Input Validation**:
   - Validate `plan_json` structure using Zod schema
   - Validate `plan_language` format (max 10 chars)
   - Throw `VALIDATION_ERROR` if invalid

2. **Trip Retrieval**:
   - Query trip by `tripId` using Supabase client
   - RLS automatically filters by authenticated user
   - Throw `NOT_FOUND` if trip doesn't exist

3. **Ownership Validation** (Defense in Depth):
   - Explicitly check `trip.user_id === userId`
   - Throw `FORBIDDEN` if mismatch
   - This should never trigger due to RLS, but provides clearer error messages

4. **Plan Update**:
   - Update `plan_json` and `plan_language` fields
   - Update `updated_at` timestamp (automatic via trigger)
   - Return updated trip data

5. **Status Derivation**:
   - Call `deriveTripStatus(note_body, plan_json)`
   - Should return `CONFIRMED` since plan_json is now NOT NULL

6. **Response Construction**:
   - Type-cast `plan_json` to `PlanJson` (safe after validation)
   - Return `TripDTO` with computed status

---

## 6. Security Considerations

### Authentication

- **Requirement**: User must be authenticated via Supabase Auth
- **Implementation**: Pass `userId` from authenticated session to service function
- **Error**: Return 401 UNAUTHORIZED if no valid session

### Authorization

- **Requirement**: User can only save plans to their own trips
- **Implementation**:
  - Primary: Supabase RLS policies filter trips by `user_id`
  - Secondary: Explicit ownership check in service layer (defense in depth)
- **Error**: Return 403 FORBIDDEN if ownership mismatch

### Data Validation

- **Requirement**: Prevent malicious or malformed JSON
- **Implementation**:
  - Use Zod schema to validate plan structure
  - Validate plan_language format (alphanumeric, max 10 chars)
  - Consider max plan size to prevent DoS (e.g., max 1MB JSON)
- **Error**: Return 400 VALIDATION_ERROR with specific details

### SQL Injection Prevention

- **Implementation**: Use Supabase client parameterized queries (automatic)
- **Note**: Never construct raw SQL with user input

### XSS Prevention

- **Implementation**: Sanitize plan data on frontend display (Vue auto-escapes)
- **Note**: Store raw data in database, sanitize on render

---

## 7. Performance Considerations

### Database Operations

- **Query Optimization**:
  - Single UPDATE query with WHERE clause
  - Use indexed `id` column for fast lookup
  - RLS policies use indexed `user_id` column

### Payload Size

- **Consideration**: Large plan_json can slow down updates
- **Mitigation**:
  - Consider max plan size validation (e.g., 1MB)
  - Use JSONB type for efficient storage and querying
  - PostgreSQL handles JSONB efficiently

### Caching

- **Not applicable**: This is a write operation
- **Note**: Invalidate any cached trip data after update (if caching implemented)

### Concurrency

- **Consideration**: Multiple updates to same trip
- **Mitigation**:
  - Use PostgreSQL row-level locking (automatic)
  - Last write wins (acceptable for this use case)
  - Consider optimistic locking with version field (future enhancement)

---

## 8. Implementation Steps

### Phase 1: Type Definitions and Validation

**Step 1.1**: Add `SavePlanCommand` type to `/src/types.ts`

```typescript
/**
 * Command model for PUT /api/trips/{tripId}/plan
 * Contains plan data to be saved to a trip
 */
export interface SavePlanCommand {
  plan_json: PlanJson
  plan_language: string
}
```

**Step 1.2**: Create Zod validation schema in `/src/lib/validation/plan.schemas.ts`

```typescript
import { z } from 'zod'

// Activity schema
const activitySchema = z.object({
  timeOfDay: z.string().min(1),
  locationName: z.string().min(1),
  description: z.string().min(1),
  categoryTag: z.string().min(1)
})

// Day schema
const daySchema = z.object({
  day: z.number().int().positive(),
  activities: z.array(activitySchema).min(1)
})

// Plan JSON schema
export const planJsonSchema = z.object({
  days: z.array(daySchema).min(1)
})

// Save plan command schema
export const savePlanCommandSchema = z.object({
  plan_json: planJsonSchema,
  plan_language: z
    .string()
    .min(1)
    .max(10)
    .regex(/^[a-z]{2,10}$/i, 'Must be valid language code')
})

// Validation function
export function validateSavePlanCommand(data: unknown) {
  return savePlanCommandSchema.parse(data)
}
```

**Step 1.3**: Update error factory in `/src/lib/errors/api.error.ts` (if needed)

- Ensure `createValidationError()` function exists
- Ensure it accepts details object for field-specific errors

---

### Phase 2: Service Layer Implementation

**Step 2.1**: Add `savePlanToTrip()` function to `/src/lib/services/trip.service.ts`

```typescript
import { validateSavePlanCommand } from '@/lib/validation/plan.schemas'
import { createValidationError } from '@/lib/errors/api.error'

/**
 * Save plan to trip
 *
 * Updates plan_json and plan_language fields for a trip.
 * Validates:
 * 1. Input data structure (using Zod schema)
 * 2. Trip exists (throws 404 if not found)
 * 3. User owns the trip (throws 403 if ownership mismatch)
 *
 * Security:
 * - Uses Supabase RLS for database-level filtering
 * - Performs explicit ownership check for defense in depth
 * - Validates plan structure to prevent malicious JSON
 *
 * @param tripId - Trip identifier (positive integer)
 * @param userId - Authenticated user ID (UUID)
 * @param planJson - Plan data to save
 * @param planLanguage - Language code (e.g., "en", "pl")
 * @returns Promise<TripDTO> - Updated trip with status = CONFIRMED
 * @throws ApiError - 400 for validation errors, 404 if not found, 403 if unauthorized
 */
export async function savePlanToTrip(
  tripId: number,
  userId: string,
  planJson: PlanJson,
  planLanguage: string
): Promise<TripDTO> {
  // 1. Validate input data
  try {
    validateSavePlanCommand({ plan_json: planJson, plan_language: planLanguage })
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createValidationError('Invalid plan data', error.errors)
    }
    throw error
  }

  // 2. Fetch trip to validate ownership
  const { data: trip, error: fetchError } = await supabaseClient
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single()

  if (fetchError || !trip) {
    throw createNotFoundError()
  }

  // 3. Defense in depth: explicit ownership check
  if (trip.user_id !== userId) {
    throw createForbiddenError()
  }

  // 4. Update plan_json and plan_language
  const { data: updatedTrip, error: updateError } = await supabaseClient
    .from('trips')
    .update({
      plan_json: planJson,
      plan_language: planLanguage
    })
    .eq('id', tripId)
    .select()
    .single()

  if (updateError || !updatedTrip) {
    throw new Error(`Failed to save plan: ${updateError?.message || 'Unknown error'}`)
  }

  // 5. Derive status (should be CONFIRMED since plan_json is now NOT NULL)
  const status = deriveTripStatus(updatedTrip.note_body, updatedTrip.plan_json)

  // 6. Return typed DTO
  return {
    ...updatedTrip,
    plan_json: updatedTrip.plan_json as PlanJson | null,
    status
  }
}
```

**Step 2.2**: Add necessary imports to trip.service.ts

```typescript
import { z } from 'zod'
import type { PlanJson } from '@/types'
```

---

### Phase 3: Frontend Integration

**Step 3.1**: Create composable for plan saving (optional, for reusability)

Create `/src/composables/useSavePlan.ts`:

```typescript
import { ref } from 'vue'
import { savePlanToTrip } from '@/lib/services/trip.service'
import type { PlanJson, TripDTO } from '@/types'

export function useSavePlan() {
  const isSaving = ref(false)
  const error = ref<string | null>(null)

  async function savePlan(
    tripId: number,
    userId: string,
    planJson: PlanJson,
    planLanguage: string
  ): Promise<TripDTO | null> {
    isSaving.value = true
    error.value = null

    try {
      const updatedTrip = await savePlanToTrip(tripId, userId, planJson, planLanguage)
      return updatedTrip
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save plan'
      return null
    } finally {
      isSaving.value = false
    }
  }

  return {
    savePlan,
    isSaving,
    error
  }
}
```

**Step 3.2**: Integrate into component (example usage)

In a component like `PlanView.vue` or `TripDetail.vue`:

```vue
<script setup lang="ts">
import { useSavePlan } from '@/composables/useSavePlan'
import { useAuthStore } from '@/stores/auth' // Assuming auth store exists

const { savePlan, isSaving, error } = useSavePlan()
const authStore = useAuthStore()

async function handleSavePlan(tripId: number, planJson: PlanJson, planLanguage: string) {
  const userId = authStore.userId // Get from auth store
  const updatedTrip = await savePlan(tripId, userId, planJson, planLanguage)

  if (updatedTrip) {
    // Success: update UI, show toast, etc.
    console.log('Plan saved successfully:', updatedTrip)
  } else {
    // Error: show error message
    console.error('Failed to save plan:', error.value)
  }
}
</script>

<template>
  <button @click="handleSavePlan(tripId, planJson, planLanguage)" :disabled="isSaving">
    {{ isSaving ? 'Saving...' : 'Save Plan' }}
  </button>
  <p v-if="error" class="text-red-500">{{ error }}</p>
</template>
```

**Step 3.3**: Update Pinia store (if using store for trip state)

If you have a trips store, add action to save plan:

```typescript
// In stores/trips.ts or similar
async savePlanToTrip(tripId: number, planJson: PlanJson, planLanguage: string) {
  const userId = this.authStore.userId // Get from auth store
  const updatedTrip = await savePlanToTrip(tripId, userId, planJson, planLanguage)

  // Update store state
  const index = this.trips.findIndex(t => t.id === tripId)
  if (index !== -1) {
    this.trips[index] = updatedTrip
  }

  return updatedTrip
}
```

---

### Phase 4: Testing

**Step 4.1**: Create unit tests for validation schema

Create `/src/lib/validation/plan.schemas.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { validateSavePlanCommand } from './plan.schemas'

describe('validateSavePlanCommand', () => {
  it('should validate valid plan data', () => {
    const validData = {
      plan_json: {
        days: [
          {
            day: 1,
            activities: [
              {
                timeOfDay: 'morning',
                locationName: 'Test Location',
                description: 'Test description',
                categoryTag: 'culture_museums'
              }
            ]
          }
        ]
      },
      plan_language: 'en'
    }

    expect(() => validateSavePlanCommand(validData)).not.toThrow()
  })

  it('should reject invalid language code', () => {
    const invalidData = {
      plan_json: {
        days: [
          /* ... */
        ]
      },
      plan_language: 'this-is-too-long'
    }

    expect(() => validateSavePlanCommand(invalidData)).toThrow()
  })

  // Add more test cases...
})
```

**Step 4.2**: Create integration tests for service function

Create `/src/lib/services/trip.service.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { savePlanToTrip } from './trip.service'

// Mock Supabase client
vi.mock('@/db/supabase.client', () => ({
  supabaseClient: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn()
          }))
        }))
      }))
    }))
  }
}))

describe('savePlanToTrip', () => {
  it('should save plan successfully', async () => {
    // Test implementation...
  })

  it('should throw 404 if trip not found', async () => {
    // Test implementation...
  })

  it('should throw 403 if user does not own trip', async () => {
    // Test implementation...
  })

  // Add more test cases...
})
```

**Step 4.3**: Manual testing checklist

- [ ] Save plan to own trip (should succeed)
- [ ] Try to save plan to non-existent trip (should return 404)
- [ ] Try to save plan to another user's trip (should return 403)
- [ ] Save plan with invalid JSON structure (should return 400)
- [ ] Save plan with invalid language code (should return 400)
- [ ] Verify trip status changes to CONFIRMED after saving
- [ ] Verify updated_at timestamp is updated
- [ ] Test with large plan JSON (performance check)

---

## 9. Acceptance Criteria

✅ **Functional Requirements**:

- [ ] User can save generated plan to their trip
- [ ] Plan overwrites any existing plan (1:1 relationship)
- [ ] Trip status changes to CONFIRMED after saving plan
- [ ] Updated trip data is returned with correct status

✅ **Security Requirements**:

- [ ] Only authenticated users can save plans
- [ ] Users can only save plans to their own trips
- [ ] Plan JSON structure is validated before saving
- [ ] SQL injection is prevented (parameterized queries)

✅ **Error Handling**:

- [ ] Returns 400 for invalid plan structure
- [ ] Returns 401 for unauthenticated requests
- [ ] Returns 403 for unauthorized access
- [ ] Returns 404 for non-existent trips
- [ ] Returns 500 for database errors with proper logging

✅ **Performance**:

- [ ] Single database query for update
- [ ] Response time < 500ms for typical plan size
- [ ] Handles plans up to 1MB without issues

✅ **Code Quality**:

- [ ] TypeScript types are properly defined
- [ ] Zod validation schemas are comprehensive
- [ ] Service functions have JSDoc comments
- [ ] Error messages are user-friendly
- [ ] Code follows project conventions (kebab-case files, etc.)

---

## 10. Future Enhancements

1. **Optimistic Locking**: Add version field to prevent concurrent update conflicts
2. **Plan History**: Store previous versions of plans for undo functionality
3. **Plan Validation**: Add more sophisticated validation (e.g., date ranges, location validation)
4. **Caching**: Implement caching strategy for frequently accessed trips
5. **Webhooks**: Trigger webhooks on plan save for integrations
6. **Analytics**: Track plan save events for usage analytics

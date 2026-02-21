# API Endpoint Implementation Plan: GET /api/trips/{tripId}

## 1. Endpoint Overview

This endpoint retrieves detailed information about a specific trip, including the trip's note, preferences, and saved plan (if exists). It enforces strict ownership validation to ensure users can only access their own trips. The endpoint returns a fully typed `TripDTO` with a computed `status` field derived from the trip's `note_body` and `plan_json` fields.

**Key Features:**

- Validates trip ownership using authenticated user session
- Returns typed plan_json (PlanJson | null) instead of raw JSONB
- Computes trip status (CREATED, DRAFT, CONFIRMED) based on note and plan presence
- Leverages Supabase RLS for database-level security
- Returns 404 for non-existent trips, 403 for unauthorized access

**Use Cases:**

- Display trip details in the main trip view
- Load trip data before plan generation
- Show saved plan if it exists
- Populate trip edit form

---

## 2. Request Details

**HTTP Method:** GET

**URL Structure:** `/api/trips/{tripId}`

**Path Parameters:**

- `tripId` (required): Trip identifier (positive integer)

**Query Parameters:** None

**Request Headers:**

- `Authorization: Bearer <supabase_access_token>` (required)

**Request Body:** None (GET request)

**Example Request:**

```bash
GET /api/trips/456
Authorization: Bearer eyJhbGc...
```

---

## 3. Used Types

### Response DTO

**TripDTO** (defined in `src/types.ts` lines 88-91):

```typescript
export interface TripDTO extends Omit<Tables<'trips'>, 'plan_json'> {
  plan_json: PlanJson | null
  status: TripStatus
}
```

**Fields:**

- `id`: bigint - Trip identifier
- `user_id`: uuid - Owner user ID
- `title`: string - Trip title
- `note_body`: string | null - Trip note (1000-10000 chars or null)
- `what`: WhatPreference[] - Activity preferences
- `speed`: SpeedPreference | null - Pace preference
- `type`: TypePreference | null - Trip type
- `budget`: BudgetPreference | null - Budget level
- `plan_json`: PlanJson | null - Saved plan (typed, not raw JSONB)
- `plan_language`: string | null - Plan language code
- `status`: TripStatus - Computed status (CREATED | DRAFT | CONFIRMED)
- `created_at`: string - ISO 8601 timestamp
- `updated_at`: string - ISO 8601 timestamp

### Supporting Types

**PlanJson** (lines 34-36):

```typescript
export interface PlanJson {
  days: Day[]
}
```

**TripStatus** (line 16):

```typescript
export type TripStatus = 'CREATED' | 'DRAFT' | 'CONFIRMED'
```

### Error Response

**ErrorResponse** (lines 309-315):

```typescript
export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}
```

---

## 4. Response Details

### Success Response (200 OK)

**Content-Type:** `application/json`

**Example:**

```json
{
  "id": 456,
  "user_id": "uuid-string",
  "title": "Summer in Croatia",
  "note_body": "Planning a 10-day trip to Croatia...",
  "what": ["culture_museums", "beach_relax", "foodie"],
  "speed": "balance",
  "type": "roadtrip",
  "budget": "moderate",
  "plan_json": {
    "days": [
      {
        "day": 1,
        "activities": [
          {
            "timeOfDay": "morning",
            "locationName": "Dubrovnik Old Town",
            "description": "Explore the historic walled city",
            "categoryTag": "culture_museums"
          }
        ]
      }
    ]
  },
  "plan_language": "en",
  "status": "CONFIRMED",
  "created_at": "2024-01-10T09:00:00Z",
  "updated_at": "2024-01-22T16:30:00Z"
}
```

**Note:** If no plan has been saved, `plan_json` and `plan_language` will be `null`, and `status` will be either `CREATED` or `DRAFT`.

### Error Responses

#### 400 Bad Request - Invalid Trip ID

```json
{
  "error": {
    "code": "INVALID_TRIP_ID",
    "message": "Trip ID must be a valid positive integer",
    "details": {
      "provided": "abc"
    }
  }
}
```

#### 401 Unauthorized - Missing/Invalid Authentication

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

#### 403 Forbidden - Trip Belongs to Another User

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You don't have permission to access this trip"
  }
}
```

#### 404 Not Found - Trip Does Not Exist

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Trip not found"
  }
}
```

#### 500 Internal Server Error

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

---

## 5. Data Flow

### Request Flow

```
1. Client Request
   ↓
2. Edge Function Router (supabase/functions/api/index.ts)
   - Parse URL path to extract tripId
   - Route to handleGetTrip()
   ↓
3. Authentication Validation
   - Extract Supabase session from Authorization header
   - Verify session is valid
   - Extract userId from session (auth.uid())
   - Return 401 if authentication fails
   ↓
4. Path Parameter Validation
   - Parse tripId from URL path
   - Validate tripId is a positive integer
   - Return 400 if validation fails
   ↓
5. Service Layer Call (trip.service.ts)
   - Call getTripById(tripId, userId)
   ↓
6. Database Query (with RLS)
   - SELECT * FROM trips WHERE id = tripId
   - RLS policy automatically filters by auth.uid() = user_id
   - Supabase client handles parameterized query
   ↓
7. Business Logic Validation
   - Check if trip exists (query returned data)
   - Return 404 if trip not found
   - Verify trip.user_id === userId (defense in depth)
   - Return 403 if ownership check fails
   ↓
8. Status Derivation
   - Compute status based on note_body and plan_json
   - CREATED: note_body IS NULL AND plan_json IS NULL
   - DRAFT: note_body IS NOT NULL AND plan_json IS NULL
   - CONFIRMED: plan_json IS NOT NULL
   ↓
9. Response Construction
   - Build TripDTO with typed plan_json
   - Add computed status field
   - Return 200 with TripDTO
```

### Database Interaction

**Table:** `trips` (schema defined in `.ai/db-plan.md` lines 61-106)

**Query:**

```typescript
const { data, error } = await supabaseClient.from('trips').select('*').eq('id', tripId).single()
```

**RLS Policy Applied:**

```sql
CREATE POLICY "Users can view own trips"
  ON trips FOR SELECT
  USING (auth.uid() = user_id);
```

**Note:** RLS automatically filters results, but we still perform explicit ownership check for defense in depth and clearer error messages.

---

## 6. Security Considerations

### Authentication

**Mechanism:** Supabase Auth with JWT session tokens

**Implementation:**

1. Extract session from `Authorization: Bearer <token>` header
2. Validate session using Supabase Auth middleware
3. Extract `userId` from validated session (`auth.uid()`)
4. Return 401 Unauthorized if session is missing or invalid

**Edge Function Code:**

```typescript
const authHeader = req.headers.get('Authorization')
if (!authHeader) {
  throw createUnauthorizedError()
}

// Supabase client automatically validates session
const {
  data: { user },
  error
} = await supabaseClient.auth.getUser(token)
if (error || !user) {
  throw createUnauthorizedError()
}

const userId = user.id
```

### Authorization

**Ownership Validation:**

1. After fetching trip from database, verify `trip.user_id === userId`
2. Return 403 Forbidden if ownership check fails
3. This provides defense in depth beyond RLS

**RLS Policy:**

- Database-level security ensures users can only query their own trips
- Even if application logic has bugs, RLS prevents data leakage
- Policy: `auth.uid() = user_id`

### Input Validation

**Path Parameter (tripId):**

1. Extract tripId from URL path (e.g., `/api/trips/456`)
2. Parse as integer using `parseInt(tripId, 10)`
3. Validate tripId > 0
4. Return 400 Bad Request with `INVALID_TRIP_ID` error if validation fails

**Validation Function:**

```typescript
function validateTripId(tripIdStr: string): number {
  const tripId = parseInt(tripIdStr, 10)

  if (isNaN(tripId) || tripId <= 0) {
    throw createInvalidTripIdError(tripIdStr)
  }

  return tripId
}
```

### Threat Mitigation

| Threat                              | Mitigation                                               |
| ----------------------------------- | -------------------------------------------------------- |
| **SQL Injection**                   | Supabase client uses parameterized queries automatically |
| **Horizontal Privilege Escalation** | RLS policy + explicit ownership check                    |
| **Session Hijacking**               | HTTPS only, secure token storage, token expiration       |
| **Enumeration Attack**              | RLS prevents querying other users' trips                 |
| **Information Disclosure**          | Consistent error messages (404 for non-existent trips)   |

---

## 7. Error Handling

### Error Handling Strategy

**Principles:**

- Use early returns for error conditions (guard clauses)
- Handle errors at the beginning of functions
- Place happy path last for improved readability
- Use custom error types from `src/lib/errors/api.error.ts`
- Return consistent ErrorResponse format

### Error Scenarios

#### 1. Invalid Trip ID (400)

**Trigger:** tripId is not a positive integer

**Example:** `/api/trips/abc` or `/api/trips/-5`

**Handler:**

```typescript
const tripId = validateTripId(tripIdStr)
// Throws createInvalidTripIdError(tripIdStr) if invalid
```

**Response:**

```json
{
  "error": {
    "code": "INVALID_TRIP_ID",
    "message": "Trip ID must be a valid positive integer",
    "details": { "provided": "abc" }
  }
}
```

#### 2. Unauthorized (401)

**Trigger:** Missing or invalid authentication token

**Handler:**

```typescript
const {
  data: { user },
  error
} = await supabaseClient.auth.getUser(token)
if (error || !user) {
  throw createUnauthorizedError()
}
```

**Response:**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

#### 3. Forbidden (403)

**Trigger:** Trip belongs to another user

**Handler:**

```typescript
if (trip.user_id !== userId) {
  throw createForbiddenError()
}
```

**Response:**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You don't have permission to access this trip"
  }
}
```

#### 4. Not Found (404)

**Trigger:** Trip does not exist

**Handler:**

```typescript
const { data: trip, error } = await supabaseClient
  .from('trips')
  .select('*')
  .eq('id', tripId)
  .single()

if (error || !trip) {
  throw createNotFoundError()
}
```

**Response:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Trip not found"
  }
}
```

#### 5. Internal Server Error (500)

**Trigger:** Unexpected database error or server exception

**Handler:**

```typescript
try {
  // ... endpoint logic
} catch (error) {
  if (error instanceof ApiError) {
    throw error // Re-throw known errors
  }

  console.error('[GET /api/trips/:id] Unexpected error:', error)
  throw new ApiError(500, 'INTERNAL_ERROR', 'An unexpected error occurred')
}
```

**Response:**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

### Error Logging

**Strategy:**

- Use `console.error()` for server-side logging
- Supabase automatically captures Edge Function logs
- Include context: endpoint, tripId, userId (sanitized)
- Do NOT log sensitive data (tokens, passwords)

**Example:**

```typescript
console.error(`[GET /api/trips/${tripId}] Database error:`, error.message)
```

---

## 8. Performance Considerations

### Database Query Optimization

**Single Query:**

- Use `.single()` modifier for single-row queries
- Supabase automatically adds `LIMIT 1` to query
- Reduces data transfer and parsing overhead

**Index Usage:**

- Primary key index on `trips(id)` (automatic)
- RLS filter uses `trips(user_id)` - covered by `idx_trips_user_updated` index

**No N+1 Queries:**

- Single database query per request
- No additional queries for related data (profile, generations)

### Response Size

**Typical Response Size:**

- Small trip (no plan): ~500 bytes
- Large trip (with plan): ~5-20 KB (depends on plan complexity)

**Optimization:**

- plan_json is already stored as JSONB (compressed)
- No additional serialization needed
- Supabase client handles JSON parsing efficiently

### Caching Strategy

**Not Recommended for MVP:**

- Trip data changes frequently (user edits)
- Caching adds complexity without significant benefit
- Database query is fast enough (<50ms typical)

**Future Enhancement:**

- Consider HTTP ETag headers for conditional requests
- Client-side caching in Pinia store (already planned)

### Bottlenecks

**Potential Issues:**

- Large plan_json (>100 KB) could slow response
- Multiple concurrent requests from same user

**Mitigation:**

- plan_json size is limited by UI constraints (max days, activities)
- Supabase handles connection pooling automatically
- Edge Functions scale horizontally

---

## 9. Implementation Steps

### Step 1: Create Trip Service Layer

**File:** `src/lib/services/trip.service.ts`

**Functions to implement:**

1. **getTripById(tripId: number, userId: string): Promise<TripDTO>**
   - Query trips table with RLS
   - Validate trip exists (throw 404 if not)
   - Validate ownership (throw 403 if mismatch)
   - Derive trip status
   - Return typed TripDTO

2. **deriveTripStatus(noteBody: string | null, planJson: unknown): TripStatus**
   - Implement status derivation logic
   - CREATED: noteBody IS NULL AND planJson IS NULL
   - DRAFT: noteBody IS NOT NULL AND planJson IS NULL
   - CONFIRMED: planJson IS NOT NULL

**Example Implementation:**

```typescript
import { supabaseClient } from '@/db/supabase.client'
import type { TripDTO, TripStatus } from '@/types'
import { createNotFoundError, createForbiddenError } from '@/lib/errors/api.error'

export async function getTripById(tripId: number, userId: string): Promise<TripDTO> {
  // Query trip with RLS
  const { data: trip, error } = await supabaseClient
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single()

  // Handle errors
  if (error || !trip) {
    throw createNotFoundError()
  }

  // Verify ownership (defense in depth)
  if (trip.user_id !== userId) {
    throw createForbiddenError()
  }

  // Derive status
  const status = deriveTripStatus(trip.note_body, trip.plan_json)

  // Return typed DTO
  return {
    ...trip,
    plan_json: trip.plan_json as any, // Type assertion for PlanJson | null
    status
  }
}

export function deriveTripStatus(noteBody: string | null, planJson: unknown): TripStatus {
  if (planJson !== null) {
    return 'CONFIRMED'
  }

  if (noteBody !== null && noteBody.length > 0) {
    return 'DRAFT'
  }

  return 'CREATED'
}
```

### Step 2: Add Route Handler to Edge Function

**File:** `supabase/functions/api/index.ts`

**Add route matching:**

```typescript
// Route: GET /api/trips/:id
if (path.match(/\/trips\/\d+$/) && req.method === 'GET') {
  return await handleGetTrip(req, path)
}
```

**Implement handler:**

```typescript
async function handleGetTrip(req: Request, path: string) {
  try {
    // 1. Extract tripId from path
    const tripIdStr = path.split('/').pop() || ''
    const tripId = validateTripId(tripIdStr)

    // 2. Authenticate user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw createUnauthorizedError()
    }

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: authError
    } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      throw createUnauthorizedError()
    }

    const userId = user.id

    // 3. Call service layer
    const trip = await getTripById(tripId, userId)

    // 4. Return success response
    return new Response(JSON.stringify(trip), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    if (error instanceof ApiError) {
      return new Response(JSON.stringify(error.toResponse()), {
        status: error.statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.error('[GET /api/trips/:id] Unexpected error:', error)
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred')
  }
}

function validateTripId(tripIdStr: string): number {
  const tripId = parseInt(tripIdStr, 10)

  if (isNaN(tripId) || tripId <= 0) {
    throw createInvalidTripIdError(tripIdStr)
  }

  return tripId
}
```

### Step 3: Add Mock Mode Support (Optional)

**For development/testing without database:**

```typescript
async function handleGetTrip(req: Request, path: string) {
  // MOCK MODE: Return hardcoded trip data
  if (MOCK_MODE) {
    const tripIdStr = path.split('/').pop() || ''
    const tripId = parseInt(tripIdStr, 10)

    const mockTrip: TripDTO = {
      id: tripId,
      user_id: '00000000-0000-0000-0000-000000000001',
      title: 'Summer in Croatia',
      note_body:
        "Planning a 10-day trip to Croatia in July. Want to visit Dubrovnik, Split, and Hvar. Interested in historical sites, beaches, and local cuisine. Traveling with family (2 adults, 2 kids aged 8 and 10). Budget is moderate. Looking for a mix of relaxation and cultural experiences. Would love to explore the old town walls in Dubrovnik, visit Diocletian's Palace in Split, and enjoy the beaches in Hvar. Also interested in trying local seafood and wine. Planning to rent a car for flexibility. Looking for family-friendly accommodations near the beach. Want to balance sightseeing with downtime for the kids. Interested in boat trips to nearby islands. Need recommendations for restaurants that accommodate children. Also curious about any local festivals or events happening in July. Want to avoid overly touristy spots if possible. Prefer authentic experiences. Budget allows for some splurges but generally moderate spending. Trip duration is 10 days total.",
      what: ['culture_museums', 'beach_relax', 'foodie'],
      speed: 'balance',
      type: 'roadtrip',
      budget: 'moderate',
      plan_json: null,
      plan_language: null,
      status: 'DRAFT',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    return new Response(JSON.stringify(mockTrip), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // ... real implementation
}
```

### Step 4: Test the Endpoint

**Manual Testing with cURL:**

```bash
# Success case
curl -X GET http://localhost:54321/functions/v1/api/trips/1 \
  -H "Authorization: Bearer <supabase_token>"

# Invalid trip ID
curl -X GET http://localhost:54321/functions/v1/api/trips/abc \
  -H "Authorization: Bearer <supabase_token>"

# Unauthorized
curl -X GET http://localhost:54321/functions/v1/api/trips/1

# Not found
curl -X GET http://localhost:54321/functions/v1/api/trips/99999 \
  -H "Authorization: Bearer <supabase_token>"
```

**Expected Responses:**

- Success: 200 with TripDTO
- Invalid ID: 400 with INVALID_TRIP_ID error
- Unauthorized: 401 with UNAUTHORIZED error
- Not found: 404 with NOT_FOUND error

### Step 5: Verify RLS Policies

**Check RLS is enabled:**

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'trips';
```

**Verify policy exists:**

```sql
SELECT * FROM pg_policies WHERE tablename = 'trips';
```

**Test RLS enforcement:**

- Try accessing another user's trip
- Should return 404 (RLS filters it out)
- Explicit ownership check should never trigger (RLS prevents query from returning data)

### Step 6: Integration with Frontend

**Create composable or service call in Vue:**

**File:** `src/lib/services/trip.service.ts` (frontend)

```typescript
import { supabaseClient } from '@/db/supabase.client'
import type { TripDTO } from '@/types'

export async function fetchTripById(tripId: number): Promise<TripDTO> {
  const { data, error } = await supabaseClient.from('trips').select('*').eq('id', tripId).single()

  if (error) {
    throw new Error(`Failed to fetch trip: ${error.message}`)
  }

  // Derive status on client side
  const status = deriveTripStatus(data.note_body, data.plan_json)

  return {
    ...data,
    status
  }
}
```

**Note:** For MVP, you can call Supabase client directly from frontend instead of going through Edge Function. Edge Function is needed for:

- Complex business logic
- AI generation (API key protection)
- Rate limiting

For simple CRUD operations, Supabase client + RLS is sufficient.

---

## Summary

This implementation plan provides comprehensive guidance for implementing the `GET /api/trips/{tripId}` endpoint with:

✅ **Security:** Authentication, authorization, RLS, input validation
✅ **Error Handling:** Early returns, guard clauses, consistent error responses
✅ **Performance:** Single query, index usage, efficient response size
✅ **Maintainability:** Service layer separation, typed DTOs, clear data flow
✅ **User Experience:** Clear error messages, typed responses, computed status field

**Key Implementation Points:**

1. Create `trip.service.ts` with `getTripById()` and `deriveTripStatus()` functions
2. Add route handler to Edge Function with path parameter validation
3. Implement authentication and authorization checks
4. Use existing error factories from `api.error.ts`
5. Return typed `TripDTO` with computed `status` field
6. Test all error scenarios (400, 401, 403, 404, 500)
7. Verify RLS policies are enforced

**Alternative Approach:**
For MVP, consider using Supabase client directly from frontend instead of Edge Function. This simplifies implementation while maintaining security through RLS. Edge Function is only needed for complex operations like AI generation.

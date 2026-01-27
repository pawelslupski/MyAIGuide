# API Endpoint Implementation Plan: POST /api/trips/{tripId}/generate-plan

## 1. Endpoint Overview

This endpoint generates an AI-powered travel plan based on a trip's note content, user profile preferences, and
trip-specific preferences. The generated plan is returned as a temporary candidate and is **not** automatically saved to
the database. The client stores it in Pinia state, allowing the user to review before confirming.

**Key Features:**

- Validates trip ownership and note content requirements
- Enforces rate limiting (10 generations per user in rolling 24-hour window)
- Auto-detects language from note content
- Builds structured AI prompt combining trip note, user profile flags, and preferences
- **Initial Development:** Uses mock AI responses for testing and development
- **Production:** Calls OpenRouter.ai via Supabase Edge Function
- Records all generation attempts for quota tracking and diagnostics
- Returns structured plan JSON with metadata (language, model, timestamp)

**Development Strategy:**

- **Phase 1 (Current):** Implement with mock AI service that returns predefined plan structures
- **Phase 2 (Future):** Replace mock with real OpenRouter.ai integration via Edge Function
- This approach allows testing the full flow (validation, quota, error handling) without AI API costs

## 2. Request Details

- **HTTP Method:** POST
- **URL Structure:** `/api/trips/{tripId}/generate-plan`
- **Authentication:** Required (Supabase Auth session)
- **Content-Type:** application/json

### Parameters

**Path Parameters:**

- `tripId` (required): Trip identifier (positive integer)

**Request Body:**

- None (all data retrieved from database)

**Headers:**

- `Authorization: Bearer <supabase_access_token>` (required)

### Request Flow

1. Extract `tripId` from URL path
2. Extract `userId` from authenticated Supabase session
3. Retrieve trip data, user profile, and generation history from database
4. Validate all requirements
5. Call AI service via Edge Function
6. Record generation attempt
7. Return generated plan

## 3. Used Types

### Response DTOs

**GeneratedPlanDTO** (already defined in `src/types.ts`):

```typescript
interface GeneratedPlanDTO {
  plan: PlanJson
  language: string
  model_used: string
  generated_at: string // ISO 8601 timestamp
}
```

**PlanJson** (already defined):

```typescript
interface PlanJson {
  days: Day[]
}

interface Day {
  day: number
  activities: Activity[]
}

interface Activity {
  timeOfDay: string
  locationName: string
  description: string
  categoryTag: WhatPreference
}
```

### Internal Command Models (to be created)

**GeneratePlanCommand** (internal service layer):

```typescript
interface GeneratePlanCommand {
  userId: string
  tripId: number
  noteBody: string
  userProfile: {
    hasKids: boolean
    hasPets: boolean
    hasMobilityIssues: boolean
    hasDietaryPreferences: boolean
  }
  tripPreferences: {
    what: WhatPreference[]
    speed: SpeedPreference | null
    type: TypePreference | null
    budget: BudgetPreference | null
  }
}
```

**QuotaCheckResult** (internal):

```typescript
interface QuotaCheckResult {
  allowed: boolean
  used: number
  limit: number
  resetAt: string // ISO 8601 timestamp
}
```

### Error Response DTOs

**ErrorResponse** (already defined in `src/types.ts`):

```typescript
interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}
```

## 4. Response Details

### Success Response (200 OK)

```json
{
  "plan": {
    "days": [
      {
        "day": 1,
        "activities": [
          {
            "timeOfDay": "morning",
            "locationName": "Wawel Castle",
            "description": "Visit the historic royal castle and cathedral",
            "categoryTag": "culture_museums"
          },
          {
            "timeOfDay": "afternoon",
            "locationName": "Kazimierz District",
            "description": "Explore the historic Jewish quarter with its cafes and galleries",
            "categoryTag": "city_break"
          }
        ]
      }
    ]
  },
  "language": "pl",
  "model_used": "anthropic/claude-3.5-sonnet",
  "generated_at": "2024-01-23T12:00:00Z"
}
```

### Error Responses

#### 400 Bad Request - Invalid tripId Format

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

#### 400 Bad Request - Note Body Validation Error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Note must be between 1000 and 10000 characters",
    "details": {
      "note_body_length": 500,
      "min_length": 1000,
      "max_length": 10000
    }
  }
}
```

#### 401 Unauthorized

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

#### 403 Forbidden - Trip Ownership

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You don't have permission to access this trip"
  }
}
```

#### 404 Not Found

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Trip not found"
  }
}
```

#### 429 Too Many Requests - Quota Exceeded

```json
{
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "You have reached the limit of 10 plan generations in 24 hours",
    "details": {
      "used": 10,
      "limit": 10,
      "reset_at": "2024-01-24T10:00:00Z"
    }
  }
}
```

#### 500 Internal Server Error - AI API Error

```json
{
  "error": {
    "code": "AI_API_ERROR",
    "message": "Failed to generate plan. Please try again.",
    "details": {
      "reason": "API timeout"
    }
  }
}
```

#### 503 Service Unavailable

```json
{
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "AI service is temporarily unavailable. Please try again later."
  }
}
```

## 5. Data Flow

### High-Level Flow

```
1. Client Request
   ↓
2. Authentication Middleware (Supabase Auth)
   ↓
3. Path Parameter Validation (tripId)
   ↓
4. Database Queries (parallel):
   - Fetch trip by ID (with RLS)
   - Fetch user profile
   - Count recent generations
   ↓
5. Business Logic Validation:
   - Trip exists check (404)
   - Trip ownership check (403)
   - Note body validation (400)
   - Quota check (429)
   ↓
6. Build AI Prompt:
   - Detect language from note_body
   - Combine note + profile + preferences
   ↓
7. Call AI Service:
   - **Phase 1 (Development):** Call mock AI service
   - **Phase 2 (Production):** Call Supabase Edge Function → OpenRouter.ai
   - Returns structured plan JSON
   ↓
8. Validate AI Response:
   - Schema validation
   - Field validation
   ↓
9. Record Generation Attempt:
   - Insert into plan_generations table
   - Status: success/api_error/validation_error
   ↓
10. Return Response (200 OK)
```

### Detailed Database Interactions

**Step 4: Parallel Database Queries**

Query 1 - Fetch Trip (with RLS enforcement):

```sql
SELECT id,
       user_id,
       title,
       note_body,
       what,
       speed,
       type,
       budget
FROM trips
WHERE id = $1
```

Query 2 - Fetch User Profile:

```sql
SELECT has_kids,
       has_pets,
       has_mobility_issues,
       has_dietary_preferences,
       default_what,
       default_speed,
       default_type,
       default_budget
FROM profiles
WHERE user_id = $1
```

Query 3 - Count Recent Generations:

```sql
SELECT COUNT(*) as count
FROM plan_generations
WHERE user_id = $1
  AND created_at
    > NOW() - INTERVAL '24 hours'
```

**Step 9: Record Generation Attempt**

Insert into plan_generations:

```sql
INSERT INTO plan_generations (user_id, trip_id, status, model_name, error_message)
VALUES ($1, $2, $3, $4, $5)
```

### AI Service Flow

**Phase 1 (Development): Mock AI Service**

**File:** `src/lib/services/mockAIService.ts`

Input:

```typescript
{
  prompt: string,
  language: string,
  tripPreferences: TripPreferencesDto
}
```

Process:

1. Validate input
2. Generate mock plan based on preferences
3. Add realistic delay (2-5 seconds) to simulate API call
4. Return predefined plan structure with variations

Output:

```typescript
{
  plan: PlanJson,
  model_used: "mock-ai-v1"
}
```

Mock Strategy:

- Multiple predefined plan templates based on `what` preferences
- Random selection from templates for variety
- Configurable delay to simulate real API latency
- Can simulate errors for testing (timeout, validation errors)

---

**Phase 2 (Production): Supabase Edge Function**

**File:** `supabase/functions/generate-travel-plan/index.ts`

Input:

```typescript
{
  prompt: string,
  language: string,
  model?: string  // Optional, defaults to "anthropic/claude-3.5-sonnet"
}
```

Process:

1. Validate input
2. Call OpenRouter.ai API with structured prompt
3. Parse AI response
4. Return structured plan JSON

Output:

```typescript
{
  plan: PlanJson,
  model_used: string
}
```

Error Handling:

- Timeout (60s): Return 500 with AI_API_ERROR
- Rate limit: Return 500 with AI_API_ERROR
- Invalid response: Return 500 with AI_API_ERROR
- Network error: Return 503 with SERVICE_UNAVAILABLE

## 6. Security Considerations

### Authentication & Authorization

1. **Session Validation:**
   - Verify Supabase Auth session exists
   - Extract userId from session
   - Return 401 if session invalid/expired

2. **Trip Ownership:**
   - Use RLS to automatically filter trips by user_id
   - Explicit check: `trip.user_id === session.user.id`
   - Return 403 if ownership check fails
   - Return 404 if trip doesn't exist (don't leak existence)

3. **Row Level Security (RLS):**
   - Enabled on `trips` table
   - Policy: `user_id = auth.uid()`
   - Automatic enforcement by Supabase client

### Input Validation & Sanitization

1. **Path Parameter:**
   - Validate tripId is positive integer
   - Reject non-numeric values (400)
   - Use parameterized queries (SQL injection prevention)

2. **Note Body:**
   - Validate length: 1000-10000 characters
   - No HTML/script injection (AI prompt context)
   - Sanitize before passing to AI (escape special chars)

3. **AI Response:**
   - Validate structure matches PlanJson schema
   - Validate categoryTag values against allowed set
   - Reject malformed responses (500)

### Rate Limiting

1. **Generation Quota:**
   - 10 generations per user in rolling 24-hour window
   - Count from `plan_generations` table
   - Return 429 with reset_at timestamp

2. **Edge Function Timeout:**
   - 60-second timeout on AI API calls
   - Prevents resource exhaustion
   - Return 500 on timeout

### API Key Protection

1. **OpenRouter.ai API Key:**
   - Stored in Supabase Edge Function secrets
   - Never exposed to client
   - Only accessible server-side

2. **Supabase Service Role Key:**
   - Not used on frontend
   - Edge Functions use service role for privileged operations

### Data Privacy

1. **Error Messages:**
   - Generic messages for 403/404 (don't leak data)
   - No user data in error responses
   - Detailed errors only for validation (400)

2. **Logging:**
   - Log errors server-side only
   - Don't log sensitive user data
   - Use structured logging for diagnostics

## 7. Error Handling

### Error Handling Strategy

**Principle:** Handle errors early with guard clauses, use early returns, place happy path last.

### Error Categories & Handling

#### 1. Client Errors (4xx)

**400 Bad Request:**

- **Trigger:** Invalid tripId format, note validation failure
- **Handling:**
  - Validate tripId format before database query
  - Validate note_body length and null check
  - Return detailed error with actual vs. expected values
- **Logging:** Record validation_error in plan_generations (only for note validation)

**401 Unauthorized:**

- **Trigger:** No session, invalid/expired token
- **Handling:**
  - Check session at start of request
  - Return generic "Authentication required" message
- **Logging:** None (authentication layer handles this)

**403 Forbidden:**

- **Trigger:** Trip belongs to different user
- **Handling:**
  - Check trip.user_id === session.user.id after fetch
  - Return generic "You don't have permission" message
- **Logging:** None (don't record in plan_generations)

**404 Not Found:**

- **Trigger:** Trip doesn't exist
- **Handling:**
  - Check if trip query returns null
  - Return generic "Trip not found" message
- **Logging:** None (don't record in plan_generations)

**429 Too Many Requests:**

- **Trigger:** User exceeded 10 generations in 24 hours
- **Handling:**
  - Count generations before AI call
  - Calculate reset_at (24 hours from oldest generation)
  - Return detailed quota info
- **Logging:** None (quota check prevents generation)

#### 2. Server Errors (5xx)

**500 Internal Server Error:**

- **Trigger:** AI API error, validation error, unexpected errors
- **Handling:**
  - Catch AI API errors (timeout, rate limit, invalid response)
  - Catch response validation errors
  - Return generic "Failed to generate plan" message
- **Logging:** Record api_error or validation_error in plan_generations

**503 Service Unavailable:**

- **Trigger:** Edge Function unavailable, OpenRouter.ai down
- **Handling:**
  - Catch network errors
  - Return "Service temporarily unavailable" message
- **Logging:** Record api_error in plan_generations

### Error Logging in plan_generations Table

**When to Log:**

1. **validation_error:**
   - Note body validation fails (NULL, too short, too long)
   - AI response validation fails
   - Fields: `status='validation_error'`, `model_name=NULL`, `error_message='<details>'`

2. **api_error:**
   - AI API call fails (timeout, rate limit, network error)
   - Edge Function error
   - Fields: `status='api_error'`, `model_name='<attempted_model>'`, `error_message='<details>'`

3. **success:**
   - Plan generated successfully
   - Fields: `status='success'`, `model_name='<used_model>'`, `error_message=NULL`

**What NOT to Log:**

- Authentication failures (401)
- Authorization failures (403)
- Trip not found (404)
- Quota exceeded (429)
- Invalid tripId format (400)

### Error Response Factory

Create a centralized error response factory for consistency:

```typescript
class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message)
  }

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
```

## 8. Performance Considerations

### Potential Bottlenecks

1. **AI API Call Latency:**
   - OpenRouter.ai response time: 5-60 seconds (can vary based on model and complexity)
   - Mitigation: Set 60s timeout, show loading state on client with progress indicator

2. **Database Queries:**
   - Multiple sequential queries slow down response
   - Mitigation: Parallelize independent queries (trip, profile, quota)

3. **Language Detection:**
   - Processing 10,000 character note
   - Mitigation: Use efficient library (e.g., franc-min), limit to first 1000 chars

4. **Generation History Query:**
   - Counting rows in large table
   - Mitigation: Index on (user_id, created_at)

### Optimization Strategies

1. **Parallel Database Queries:**

   ```typescript
   const [trip, profile, generationCount] = await Promise.all([
     fetchTrip(tripId),
     fetchProfile(userId),
     countRecentGenerations(userId)
   ])
   ```

2. **Database Indexing:**
   - Index on `plan_generations(user_id, created_at)` for quota queries
   - Index on `trips(user_id)` for ownership checks (likely exists)

3. **Edge Function Optimization:**
   - Keep Edge Function warm (periodic health checks)
   - Use connection pooling for OpenRouter.ai
   - Cache AI model metadata

4. **Response Streaming:**
   - Consider streaming AI response for better UX
   - Requires client-side handling of partial responses

5. **Caching:**
   - Don't cache generated plans (each is unique)
   - Cache user profile for duration of request
   - Cache quota count for 1 minute (acceptable staleness)

## 9. Implementation Steps

### Step 1: Create Mock AI Service (Phase 1 - Development)

**File:** `src/lib/services/mockAIService.ts`

**Purpose:** Simulate AI plan generation for development and testing without API costs.

**Functions to implement:**

1. `generateMockPlan(params: MockPlanParams): Promise<MockPlanResponse>`
   - Input: language, tripPreferences (what, speed, type, budget)
   - Select appropriate template based on preferences
   - Add realistic delay (2-5 seconds) to simulate API latency
   - Return mock plan with metadata

2. `getMockPlanTemplate(preferences: TripPreferencesDto): PlanJson`
   - Multiple predefined templates for different preference combinations
   - Templates include realistic activities matching categoryTags
   - Vary number of days and activities based on speed preference

3. `simulateError(errorType?: string): void` (optional)
   - Simulate timeout, validation errors for testing
   - Configurable via environment variable

**Mock Templates to Create:**

- Nature-focused plan (hiking, national parks, outdoor activities)
- Culture/museums plan (historical sites, galleries, monuments)
- Beach/relax plan (coastal activities, spa, leisure)
- City break plan (urban exploration, restaurants, nightlife)
- Foodie plan (culinary experiences, markets, cooking classes)
- Mixed plans for multiple preferences

**Example Template:**

```typescript
const culturePlanTemplate: PlanJson = {
  days: [
    {
      day: 1,
      activities: [
        {
          timeOfDay: 'morning',
          locationName: 'Wawel Castle',
          description: 'Visit the historic royal castle and cathedral',
          categoryTag: 'culture_museums'
        },
        {
          timeOfDay: 'afternoon',
          locationName: 'Kazimierz District',
          description: 'Explore the historic Jewish quarter',
          categoryTag: 'city_break'
        }
      ]
    }
  ]
}
```

---

### Step 2: Create Service Layer

**File:** `src/lib/services/planGenerationService.ts`

**Functions to implement:**

1. `checkGenerationQuota(userId: string): Promise<QuotaCheckResult>`
   - Query plan_generations table
   - Count generations in last 24 hours
   - Calculate reset_at timestamp
   - Return quota status

2. `detectLanguage(text: string): string`
   - Use language detection library (e.g., franc-min)
   - Limit input to first 1000 characters for performance
   - Return ISO 639-1 language code (e.g., 'pl', 'en')
   - Default to 'en' if detection fails

3. `buildAIPrompt(command: GeneratePlanCommand): string`
   - Combine note_body, user profile flags, trip preferences
   - Structure prompt for optimal AI response
   - Include output format instructions (JSON schema)
   - Return formatted prompt string
   - **Note:** Prepared for Phase 2, but can be implemented now

4. `validatePlanResponse(response: unknown): PlanJson`
   - Use Zod schema to validate structure
   - Check all required fields present
   - Validate categoryTag values
   - Validate timeOfDay values
   - Throw error if validation fails

5. `recordGenerationAttempt(params: RecordGenerationParams): Promise<void>`
   - Insert into plan_generations table
   - Fields: user_id, trip_id, status, model_name, error_message
   - Handle database errors gracefully

6. `callAIService(params: AIServiceParams): Promise<AIServiceResponse>`
   - **Phase 1 (Current):** Call mockAIService.generateMockPlan()
   - **Phase 2 (Future):** Call Supabase Edge Function
   - Abstraction layer for easy switching between mock and real AI
   - Use environment variable to control which service to use

**Dependencies:**

- Supabase client for database queries
- Zod for response validation
- Language detection library (franc-min or similar)
- Mock AI service (Phase 1)

---

### Step 3: Create Supabase Edge Function (Phase 2 - Production)

**File:** `supabase/functions/generate-travel-plan/index.ts`

**Status:** Prepared for future implementation, not needed for Phase 1.

**Implementation (when ready for Phase 2):**

1. Set up Deno environment with OpenRouter.ai client
2. Define input/output types
3. Implement request handler:
   - Validate input (prompt, language, model)
   - Build OpenRouter.ai API request
   - Set 60s timeout (allows for complex plan generation)
   - Call API with structured prompt
   - Parse and validate response
   - Return structured plan JSON
4. Implement error handling:
   - Timeout errors (after 60s)
   - Rate limit errors
   - Network errors
   - Invalid response errors
5. Add logging for diagnostics

**Environment Variables:**

- `OPENROUTER_API_KEY`: OpenRouter.ai API key (stored in Supabase secrets)

**Testing:**

- Test with valid prompts
- Test timeout scenarios
- Test error responses
- Test with different models

### Step 4: Create API Route Handler

**File:** `src/lib/api/trips/generatePlan.ts` (or similar based on routing structure)

**Implementation:**

1. Extract tripId from path parameters
2. Validate tripId format (positive integer)
3. Get authenticated user from Supabase session
4. Parallel database queries:
   - Fetch trip (with RLS)
   - Fetch user profile
   - Count recent generations
5. Validation checks (early returns):
   - Trip exists (404)
   - Trip ownership (403)
   - Note body not null (400)
   - Note body length 1000-10000 (400)
   - Quota not exceeded (429)
6. Detect language from note_body
7. Build trip preferences object
8. **Phase 1:** Call mockAIService via planGenerationService.callAIService()
9. **Phase 2:** Call Edge Function via planGenerationService.callAIService()
10. Validate AI response
11. Record generation attempt (success)
12. Return GeneratedPlanDTO (200)

**Error Handling:**

- Wrap in try-catch for unexpected errors
- Record generation attempt on errors (api_error, validation_error)
- Use error factory for consistent responses
- Log errors server-side

**Phase 1 Notes:**

- No need to build AI prompt (mock service doesn't use it)
- Focus on validation, quota, and error handling flow
- Mock service returns plan based on preferences only

### Step 5: Create Zod Validation Schemas

**File:** `src/lib/validation/planSchemas.ts`

**Schemas to create:**

1. `PlanJsonSchema`: Validates PlanJson structure
2. `DaySchema`: Validates Day structure
3. `ActivitySchema`: Validates Activity structure
4. `EdgeFunctionResponseSchema`: Validates Edge Function response

**Example:**

```typescript
import { z } from 'zod'

const WhatPreferenceSchema = z.enum([
  'nature',
  'culture_museums',
  'beach_relax',
  'city_break',
  'foodie'
])

const ActivitySchema = z.object({
  timeOfDay: z.string().min(1),
  locationName: z.string().min(1),
  description: z.string().min(1),
  categoryTag: WhatPreferenceSchema
})

const DaySchema = z.object({
  day: z.number().int().positive(),
  activities: z.array(ActivitySchema).min(1)
})

export const PlanJsonSchema = z.object({
  days: z.array(DaySchema).min(1)
})
```

### Step 6: Add Database Indexes

**Migration File:** `supabase/migrations/XXXXXX_add_plan_generations_indexes.sql`

**Indexes to create:**

```sql
-- Index for quota queries (user_id + created_at)
CREATE INDEX idx_plan_generations_user_created
    ON plan_generations (user_id, created_at DESC);

-- Index for trip-specific generation history
CREATE INDEX idx_plan_generations_trip
    ON plan_generations (trip_id, created_at DESC);
```

### Step 7: Update RLS Policies

**Verify RLS policies exist for:**

- `trips` table: Users can only access their own trips
- `profiles` table: Users can only access their own profile
- `plan_generations` table: Users can only access their own generation history

**If missing, create policies:**

```sql
-- RLS policy for plan_generations
ALTER TABLE plan_generations ENABLE ROW LEVEL SECURITY;

CREATE
POLICY "Users can view their own generation history"
ON plan_generations FOR
SELECT
    USING (auth.uid() = user_id);

CREATE
POLICY "Users can insert their own generation records"
ON plan_generations FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

### Step 8: Implement Client-Side Integration

**File:** `src/stores/planStore.ts` (Pinia store)

**State:**

```typescript
{
    candidatePlan: GeneratedPlanDTO | null,
        isGenerating
:
    boolean,
        generationError
:
    ErrorResponse | null
}
```

**Actions:**

```typescript
async
generatePlan(tripId
:
number
):
Promise < void > {
    this.isGenerating = true
    this.generationError = null

    try {
        const response = await fetch(`/api/trips/${tripId}/generate-plan`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${supabase.auth.session()?.access_token}`
            }
        })

        if(!response.ok
)
{
    const error = await response.json()
    this.generationError = error
    return
}

this.candidatePlan = await response.json()
} catch
(error)
{
    this.generationError = {
        error: {
            code: 'NETWORK_ERROR',
            message: 'Failed to connect to server'
        }
    }
}
finally
{
    this.isGenerating = false
}
}

clearCandidatePlan()
:
void {
    this.candidatePlan = null
    this.generationError = null
}
```

## Summary

This implementation plan provides a comprehensive guide for implementing the POST /api/trips/{tripId}/generate-plan
endpoint. The plan emphasizes:

- **Security:** Authentication, authorization, RLS, input validation, API key protection
- **Performance:** Parallel queries, indexing, timeout handling, efficient language detection
- **Error Handling:** Early returns, guard clauses, detailed error responses, centralized error factory
- **Maintainability:** Service layer separation, Zod validation, structured logging, comprehensive testing
- **User Experience:** Clear error messages, quota transparency, language auto-detection

The implementation follows the tech stack (Supabase, Edge Functions, TypeScript) and adheres to the coding guidelines (
early returns, guard clauses, error handling first).

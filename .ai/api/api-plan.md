ok ca# REST API Plan – MyAIGuide

## 1. Resources

| Resource        | Database Table          | Description                                                 |
| --------------- | ----------------------- | ----------------------------------------------------------- |
| Authentication  | `users` (Supabase Auth) | User registration, login, logout, session management        |
| Profile         | `profiles`              | Global user preferences and travel settings (1:1 with user) |
| Trips           | `trips`                 | Trip notes, per-trip preferences, and saved plans           |
| Plan Generation | `plan_generations`      | AI plan generation tracking and rate limiting               |

---

## 2. Endpoints

### 2.1 Authentication

Authentication is handled by **Supabase Auth SDK** on the client side. No custom API endpoints are required for
registration, login, or logout. All subsequent API calls must include a valid Supabase session token in the
`Authorization` header.

**Authentication Header Format:**

```
Authorization: Bearer <supabase_session_token>
```

**Error Response (401 Unauthorized):**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

---

### 2.2 User Management

#### DELETE /api/users/me

**Description:** Permanently delete the current user's account and all associated data (profile, trips, plans,
generation history).

**Authentication:** Required

**Request Payload:** None

**Success Response (200 OK):**

```json
{
  "message": "Account successfully deleted"
}
```

**Error Responses:**

- `401 Unauthorized`: User not authenticated
- `500 Internal Server Error`: Deletion failed

---

### 2.3 Profile Management

#### GET /api/profiles/me

**Description:** Retrieve the current user's global profile with preferences and completeness indicator.

**Authentication:** Required

**Query Parameters:** None

**Success Response (200 OK):**

```json
{
  "id": 123,
  "user_id": "uuid-string",
  "has_kids": false,
  "has_pets": false,
  "has_mobility_issues": false,
  "has_dietary_preferences": true,
  "default_what": ["nature", "foodie"],
  "default_speed": "balance",
  "default_type": "roadtrip",
  "default_budget": "moderate",
  "is_complete": true,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-20T14:45:00Z"
}
```

**Completeness Logic:**

- `is_complete` is `true` if all four boolean flags are set (not null) AND at least one default preference field has a
  value

**Error Responses:**

- `401 Unauthorized`: User not authenticated
- `404 Not Found`: Profile does not exist (should auto-create on user registration)

---

#### PUT /api/profiles/me

**Description:** Update the current user's global profile preferences.

**Authentication:** Required

**Request Payload:**

```json
{
  "has_kids": true,
  "has_pets": false,
  "has_mobility_issues": false,
  "has_dietary_preferences": true,
  "default_what": ["culture_museums", "city_break"],
  "default_speed": "intensive",
  "default_type": "base",
  "default_budget": "luxury"
}
```

**Validation Rules:**

- `has_kids`, `has_pets`, `has_mobility_issues`, `has_dietary_preferences`: boolean
- `default_what`: array, each element must be one of: `nature`, `culture_museums`, `beach_relax`, `city_break`, `foodie`
- `default_speed`: one of `slow_chill`, `balance`, `intensive`
- `default_type`: one of `base`, `roadtrip`
- `default_budget`: one of `budget`, `moderate`, `luxury`

**Success Response (200 OK):**

```json
{
  "id": 123,
  "user_id": "uuid-string",
  "has_kids": true,
  "has_pets": false,
  "has_mobility_issues": false,
  "has_dietary_preferences": true,
  "default_what": ["culture_museums", "city_break"],
  "default_speed": "intensive",
  "default_type": "base",
  "default_budget": "luxury",
  "is_complete": true,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-20T15:00:00Z"
}
```

**Error Responses:**

- `400 Bad Request`: Invalid field values
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid preference values",
      "details": {
        "default_speed": "Must be one of: slow_chill, balance, intensive"
      }
    }
  }
  ```
- `401 Unauthorized`: User not authenticated

---

### 2.4 Trip Management

#### GET /api/trips

**Description:** Retrieve a paginated list of the current user's trips, sorted by last modification date (descending).

**Authentication:** Required

**Query Parameters:**

- `page` (optional, default: 1): Page number (1-based)
- `limit` (optional, default: 20, max: 100): Number of trips per page
- `status` (optional): Filter by trip status (`CREATED`, `DRAFT`, `CONFIRMED`)

**Success Response (200 OK):**

```json
{
  "trips": [
    {
      "id": 456,
      "user_id": "uuid-string",
      "title": "Summer in Croatia",
      "status": "CONFIRMED",
      "created_at": "2024-01-10T09:00:00Z",
      "updated_at": "2024-01-22T16:30:00Z"
    },
    {
      "id": 455,
      "user_id": "uuid-string",
      "title": "Weekend in Paris",
      "status": "DRAFT",
      "created_at": "2024-01-08T12:00:00Z",
      "updated_at": "2024-01-18T10:15:00Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 3,
    "total_count": 45,
    "limit": 20
  }
}
```

**Status Derivation:**

- `CREATED`: `note_body` is NULL AND `plan_json` is NULL
- `DRAFT`: `note_body` is NOT NULL AND `plan_json` is NULL
- `CONFIRMED`: `plan_json` is NOT NULL

**Error Responses:**

- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: User not authenticated

---

#### GET /api/trips/{tripId}

**Description:** Retrieve detailed information about a specific trip, including note, preferences, and saved plan (if
exists).

**Authentication:** Required

**Path Parameters:**

- `tripId`: Trip identifier (integer)

**Success Response (200 OK):**

```json
{
  "id": 456,
  "user_id": "uuid-string",
  "title": "Summer in Croatia",
  "num_days": 10,
  "num_people": 4,
  "what": ["culture_museums", "beach_relax", "foodie"],
  "speed": "balance",
  "type": "roadtrip",
  "budget": "moderate",
  "note_body": "Planning a 10-day trip to Croatia in July. Want to visit Dubrovnik, Split, and Hvar. Interested in historical sites, beaches, and local cuisine. Traveling with family (2 adults, 2 kids aged 8 and 10). Budget is moderate. Looking for a mix of relaxation and cultural experiences...",
  "plan_language": "en",
  "plan_json": {
    "days": [
      {
        "day": 1,
        "activities": [
          {
            "timeOfDay": "morning",
            "locationName": "Dubrovnik Old Town",
            "description": "Explore the historic walled city and walk the city walls",
            "categoryTag": "culture_museums"
          },
          {
            "timeOfDay": "afternoon",
            "locationName": "Banje Beach",
            "description": "Relax at the beach with views of the old town",
            "categoryTag": "beach_relax"
          }
        ]
      }
    ]
  },
  "status": "CONFIRMED",
  "created_at": "2024-01-10T09:00:00Z",
  "updated_at": "2024-01-22T16:30:00Z"
}
```

**Note:** If no plan has been saved, `plan_json` and `plan_language` will be `null`.

**Error Responses:**

- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: Trip belongs to another user
- `404 Not Found`: Trip does not exist

---

#### POST /api/trips

**Description:** Create a new trip with title and optional note.

**Authentication:** Required

**Request Payload:**

```json
{
  "title": "Weekend in Paris",
  "note_body": null,
  "what": ["culture_museums", "foodie"],
  "speed": "intensive",
  "type": "base",
  "budget": "luxury",
  "num_days": 7,
  "num_people": 2
}
```

**Validation Rules:**

- `title`: required, max 255 characters
- `note_body`: optional (can be null), if provided must be 1000-10000 characters
- `what`: optional array, defaults to profile's `default_what`
- `speed`: optional, defaults to profile's `default_speed`
- `type`: optional, defaults to profile's `default_type`
- `budget`: optional, defaults to profile's `default_budget`
- `num_days`: optional (can be null), integer 1–30
- `num_people`: optional (can be null), integer 1–20

**Success Response (201 Created):**

```json
{
  "id": 457,
  "user_id": "uuid-string",
  "title": "Weekend in Paris",
  "num_days": 7,
  "num_people": 2,
  "what": ["culture_museums", "foodie"],
  "speed": "intensive",
  "type": "base",
  "budget": "luxury",
  "note_body": null,
  "plan_language": null,
  "plan_json": null,
  "status": "CREATED",
  "created_at": "2024-01-23T10:00:00Z",
  "updated_at": "2024-01-23T10:00:00Z"
}
```

**Error Responses:**

- `400 Bad Request`: Validation errors
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid trip data",
      "details": {
        "note_body": "Note must be between 1000 and 10000 characters or null",
        "title": "Title is required"
      }
    }
  }
  ```
- `401 Unauthorized`: User not authenticated

---

#### PUT /api/trips/{tripId}

**Description:** Update trip title, note, and/or preferences.

**Authentication:** Required

**Path Parameters:**

- `tripId`: Trip identifier (integer)

**Request Payload (all fields optional):**

```json
{
  "title": "Updated Trip Title",
  "note_body": "Updated note content with at least 1000 characters...",
  "what": ["nature", "beach_relax"],
  "speed": "slow_chill",
  "type": "roadtrip",
  "budget": "budget",
  "num_days": 5,
  "num_people": 3
}
```

**Validation Rules:**

- `title`: max 255 characters
- `note_body`: null OR 1000-10000 characters
- Preference fields follow same validation as profile
- `num_days`: null OR integer 1–30
- `num_people`: null OR integer 1–20

**Success Response (200 OK):**

```json
{
  "id": 457,
  "user_id": "uuid-string",
  "title": "Updated Trip Title",
  "num_days": 5,
  "num_people": 3,
  "what": ["nature", "beach_relax"],
  "speed": "slow_chill",
  "type": "roadtrip",
  "budget": "budget",
  "note_body": "Updated note content...",
  "plan_language": null,
  "plan_json": null,
  "status": "DRAFT",
  "created_at": "2024-01-23T10:00:00Z",
  "updated_at": "2024-01-23T11:30:00Z"
}
```

**Error Responses:**

- `400 Bad Request`: Validation errors
- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: Trip belongs to another user
- `404 Not Found`: Trip does not exist

---

#### DELETE /api/trips/{tripId}

**Description:** Delete a trip and its associated plan and generation history.

**Authentication:** Required

**Path Parameters:**

- `tripId`: Trip identifier (integer)

**Success Response (200 OK):**

```json
{
  "message": "Trip successfully deleted"
}
```

**Error Responses:**

- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: Trip belongs to another user
- `404 Not Found`: Trip does not exist

---

### 2.5 AI Plan Generation

#### GET /api/users/me/generation-quota

**Description:** Check the current user's remaining plan generation quota for the rolling 24-hour window.

**Authentication:** Required

**Success Response (200 OK):**

```json
{
  "used": 7,
  "limit": 10,
  "remaining": 3,
  "reset_at": "2024-01-24T10:00:00Z"
}
```

**Calculation Logic:**

- Count records in `plan_generations` where `user_id = current_user` AND `created_at > (now - 24 hours)`
- `reset_at` is the timestamp of the oldest generation + 24 hours

**Error Responses:**

- `401 Unauthorized`: User not authenticated

---

#### POST /api/trips/{tripId}/generate-plan

**Description:** Generate an AI-powered travel plan based on the trip's note, user profile, and trip preferences.
Returns the plan as a temporary candidate (not saved to database).

**Authentication:** Required

**Path Parameters:**

- `tripId`: Trip identifier (integer)

**Request Payload:** None (uses trip data from database)

**Success Response (200 OK):**

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
          },
          {
            "timeOfDay": "evening",
            "locationName": "Main Market Square",
            "description": "Dinner at a traditional Polish restaurant",
            "categoryTag": "foodie"
          }
        ]
      },
      {
        "day": 2,
        "activities": [
          {
            "timeOfDay": "morning",
            "locationName": "Wieliczka Salt Mine",
            "description": "Tour the UNESCO World Heritage underground salt mine",
            "categoryTag": "culture_museums"
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

**Business Logic:**

1. Validate trip exists and belongs to current user
2. Check generation quota (must have remaining < 10)
3. Validate note_body is not null and between 1000-10000 characters
4. Detect language from note_body
5. Build AI prompt with:
   - Trip note content
   - User profile flags (kids, pets, mobility, dietary)
   - Trip preferences (what, speed, type, budget)
6. Call OpenRouter.ai API via Supabase Edge Function
7. Parse and validate AI response
8. Record generation attempt in `plan_generations` table
9. Return plan JSON (client stores in Pinia, not saved to DB yet)

**Error Responses:**

- `400 Bad Request`: Validation errors
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
- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: Trip belongs to another user
- `404 Not Found`: Trip does not exist
- `429 Too Many Requests`: Generation quota exceeded
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
- `500 Internal Server Error`: AI API error
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

---

#### PUT /api/trips/{tripId}/plan

**Description:** Save a plan (candidate or edited) to the database, associating it 1:1 with the trip. Overwrites any
existing plan.

**Authentication:** Required

**Path Parameters:**

- `tripId`: Trip identifier (integer)

**Request Payload:**

```json
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

**Validation Rules:**

- `plan_json`: required, must be valid JSON object with `days` array
- `plan_language`: required, max 10 characters (e.g., "pl", "en")

**Success Response (200 OK):**

```json
{
  "id": 456,
  "user_id": "uuid-string",
  "title": "Summer in Croatia",
  "num_days": 10,
  "num_people": 2,
  "what": [
    "culture_museums",
    "beach_relax"
  ],
  "speed": "balance",
  "type": "roadtrip",
  "budget": "moderate",
  "note_body": "Planning a 10-day trip...",
  "plan_language": "pl",
  "plan_json": {
    "days": [
      ...
    ]
  },
  "status": "CONFIRMED",
  "created_at": "2024-01-10T09:00:00Z",
  "updated_at": "2024-01-23T12:15:00Z"
}
```

**Error Responses:**

- `400 Bad Request`: Invalid plan JSON structure
- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: Trip belongs to another user
- `404 Not Found`: Trip does not exist

---

### 2.6 Plan Generation History (Optional - for diagnostics)

#### GET /api/trips/{tripId}/generations

**Description:** Retrieve generation history for a specific trip (for debugging/analytics).

**Authentication:** Required

**Path Parameters:**

- `tripId`: Trip identifier (integer)

**Query Parameters:**

- `limit` (optional, default: 10, max: 50): Number of records to return

**Success Response (200 OK):**

```json
{
  "generations": [
    {
      "id": 789,
      "trip_id": 456,
      "status": "success",
      "model_name": "anthropic/claude-3.5-sonnet",
      "error_message": null,
      "created_at": "2024-01-23T12:00:00Z"
    },
    {
      "id": 788,
      "trip_id": 456,
      "status": "api_error",
      "model_name": "openai/gpt-4",
      "error_message": "API timeout after 60 seconds",
      "created_at": "2024-01-22T15:30:00Z"
    }
  ]
}
```

**Error Responses:**

- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: Trip belongs to another user
- `404 Not Found`: Trip does not exist

---

## 3. Authentication and Authorization

### 3.1 Authentication Mechanism

**Supabase Auth** handles all authentication:

- User registration with email/password
- Login and session management
- Password reset
- Session tokens (JWT)

**Client Implementation:**

- Use Supabase JavaScript client SDK
- Store session token in browser (localStorage or sessionStorage)
- Include token in `Authorization: Bearer <token>` header for all API requests

**Server Implementation:**

- Validate session token using Supabase Auth middleware
- Extract `user_id` from validated token
- Use `user_id` to filter queries and enforce data isolation at application layer
- (Future: RLS policies will provide database-level isolation)

### 3.2 Authorization

**Current Implementation (MVP):**

- Authorization is enforced at the **application layer**
- API endpoints validate that the authenticated user owns the requested resource
- All database queries filter by `user_id` matching the authenticated user
- Return `403 Forbidden` for unauthorized access attempts

**Authorization Rules:**

- Users can only view/modify their own profile
- Users can only view/modify/delete their own trips
- Users can only generate plans for their own trips
- Users can only view their own generation history
- Account deletion cascades to all user-owned data

**Implementation Details:**

- Extract `user_id` from validated Supabase session token
- Add `WHERE user_id = <authenticated_user_id>` to all queries
- Validate ownership before UPDATE/DELETE operations
- Return `403 Forbidden` if resource belongs to different user

**Future Enhancement:**

- **Row Level Security (RLS)** will be implemented for defense-in-depth
- RLS policies will enforce data isolation at the database level
- This provides additional security even if application logic has bugs
- RLS policies will use `auth.uid()` to match against `user_id` foreign keys

---

## 4. Validation and Business Logic

### 4.1 Validation Rules by Resource

#### Profile Validation

- **Boolean flags:** Must be boolean values (true/false)
- **default_what:** Array where each element is one of: `nature`, `culture_museums`, `beach_relax`, `city_break`,
  `foodie`
- **default_speed:** One of: `slow_chill`, `balance`, `intensive`
- **default_type:** One of: `base`, `roadtrip`
- **default_budget:** One of: `budget`, `moderate`, `luxury`

#### Trip Validation

- **title:** Required, max 255 characters
- **note_body:** NULL (for new trips) OR 1000-10000 characters
- **what:** Array where each element is one of: `nature`, `culture_museums`, `beach_relax`, `city_break`, `foodie`
- **speed:** One of: `slow_chill`, `balance`, `intensive`
- **type:** One of: `base`, `roadtrip`
- **budget:** One of: `budget`, `moderate`, `luxury`
- **plan_json:** Valid JSON object with `days` array structure
- **plan_language:** Max 10 characters (e.g., "pl", "en")

#### Generation Validation

- **Note length:** Must be 1000-10000 characters (not null)
- **Quota:** User must have < 10 generations in rolling 24-hour window
- **Trip ownership:** Trip must belong to current user

### 4.2 Business Logic Implementation

#### Profile Completeness

**Logic:** Profile is complete if:

- All four boolean flags are set (not null)
- At least one default preference field has a non-null value

**Implementation:** Calculated server-side and returned as `is_complete` boolean in profile responses

#### Trip Status Derivation

**Logic:**

- `CREATED`: `note_body` is NULL AND `plan_json` is NULL
- `DRAFT`: `note_body` is NOT NULL AND `plan_json` is NULL
- `CONFIRMED`: `plan_json` is NOT NULL

**Implementation:** Calculated server-side and returned as `status` field in trip responses

#### Rate Limiting

**Logic:**

1. Query `plan_generations` table for current user
2. Filter by `created_at > (now() - interval '24 hours')`
3. Count records
4. If count >= 10, reject with 429 Too Many Requests
5. If count < 10, proceed with generation
6. Record attempt in `plan_generations` table (status: success/api_error/validation_error)

**Implementation:** Enforced in `POST /api/trips/{tripId}/generate-plan` endpoint

#### Language Detection

**Logic:**

1. Analyze `note_body` text to detect language
2. Use simple heuristics (character sets, common words) or library (e.g., `franc`, `langdetect`)
3. Default to English if detection fails
4. Pass detected language to AI prompt
5. Store in `plan_language` field when plan is saved

**Implementation:** Server-side in generation endpoint

#### Plan Candidate vs Saved Plan

**Logic:**

- **Generation:** Returns plan JSON in response, does NOT save to database
- **Client:** Stores candidate in Pinia state (temporary, lost on refresh)
- **Save:** Client sends plan JSON to `PUT /api/trips/{tripId}/plan` to persist
- **Overwrite:** Saving a new plan overwrites existing `plan_json` (1:1 relationship)

**Implementation:**

- Generation endpoint returns plan in response body
- Save endpoint updates `trips.plan_json` and `trips.plan_language` fields

#### Error Handling

**Logic:**

- **Validation errors:** Return 400 Bad Request with detailed error messages
- **AI API errors:** Record in `plan_generations` with status `api_error`, return 500 with user-friendly message
- **Quota exceeded:** Return 429 Too Many Requests with quota details and reset time
- **Authentication errors:** Return 401 Unauthorized
- **Authorization errors:** Return 403 Forbidden
- **Not found errors:** Return 404 Not Found

**Implementation:** Consistent error response format across all endpoints

---

## 5. Error Response Format

All error responses follow a consistent structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field_name": "Specific validation error",
      "additional_context": "value"
    }
  }
}
```

**Common Error Codes:**

- `UNAUTHORIZED`: Authentication required or invalid token
- `FORBIDDEN`: User lacks permission to access resource
- `NOT_FOUND`: Resource does not exist
- `VALIDATION_ERROR`: Request data failed validation
- `QUOTA_EXCEEDED`: Rate limit exceeded
- `AI_API_ERROR`: AI service error (timeout, API failure)
- `INTERNAL_ERROR`: Unexpected server error

---

## 6. Implementation Notes

### 6.1 Technology Stack Integration

**Supabase:**

- Use Supabase client SDK for authentication
- Use Supabase PostgREST for direct database queries (alternative to custom API)
- Use Supabase Edge Functions for AI generation endpoint (server-side API key management)

**OpenRouter.ai:**

- Call from Supabase Edge Function (not directly from client)
- Store API key in Supabase secrets
- Set timeout (30-60 seconds) for AI API calls
- Handle errors gracefully (timeout, rate limit, API errors)

**Frontend (Vue 3 + Pinia):**

- Store plan candidate in Pinia state (temporary)
- Clear candidate on page refresh or navigation
- Show loading states during API calls
- Display quota counter before generation button

### 6.2 Supabase JS Client Usage

**Implementation Approach:**

- Use **Supabase JS Client** for all database operations (CRUD)
- Client automatically handles authentication tokens and session management
- Standard operations (profiles, trips) use Supabase client methods (`.select()`, `.insert()`, `.update()`, `.delete()`)
- Authorization enforced by filtering queries with authenticated user's ID

**Custom Edge Functions Needed:**

- `POST /api/trips/{tripId}/generate-plan` - AI generation logic with OpenRouter.ai integration
- `GET /api/users/me/generation-quota` - Complex quota calculation (rolling 24-hour window)
- `DELETE /api/users/me` - Account deletion with proper cascade handling

**Recommendation:** Use Supabase JS Client for standard CRUD operations, implement custom Edge Functions only for
complex business logic (AI generation, quota checks, account deletion).

### 6.3 Pagination Strategy

**Default Pagination:**

- Page-based pagination (page number + limit)
- Default limit: 20 items
- Max limit: 100 items
- Return pagination metadata in responses

**Future Enhancement:** Consider cursor-based pagination for better performance with large datasets

## 7. Summary

This REST API plan provides:

✅ **Complete CRUD operations** for profiles and trips
✅ **AI plan generation** with rate limiting and quota management
✅ **Robust authentication** via Supabase Auth
✅ **Strict authorization** at application layer (with future RLS support)
✅ **Comprehensive validation** aligned with database constraints
✅ **Clear error handling** with consistent response format
✅ **Scalable architecture** supporting future enhancements
✅ **Technology stack alignment** with Supabase, Vue 3, and OpenRouter.ai

The API design prioritizes:

- **Security:** Authentication, authorization, data isolation
- **User experience:** Clear error messages, quota visibility, language detection
- **Performance:** Pagination, indexing, caching strategies
- **Maintainability:** RESTful conventions, consistent patterns, clear documentation
- **Extensibility:** Room for future features without breaking changes

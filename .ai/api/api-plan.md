# REST API Plan – MyAIGuide

## 1. Resources

| Resource        | Database Table          | Description                                                        |
| --------------- | ----------------------- | ------------------------------------------------------------------ |
| Authentication  | `auth.users` (Supabase) | User registration, login, logout, password reset, account deletion |
| Profile         | `profiles`              | Global user preferences and traveler flags (1:1 with user)         |
| Trips           | `trips`                 | Trip CRUD with per-trip preferences, notes, and saved plans        |
| Plan Generation | `plan_generations`      | AI plan generation requests and 24-hour rate-limit tracking        |

> **Architecture note:** Authentication is handled by **Supabase Auth SDK** on the client. Simple CRUD endpoints use the Supabase client (PostgREST + RLS). Complex business logic (plan generation, account deletion) is implemented as **Supabase Edge Functions**.
>
> **Base URL for Edge Functions:** `https://{project}.supabase.co/functions/v1`
>
> **Authentication header:** `Authorization: Bearer <supabase_session_token>` is required on every protected endpoint.

---

## 2. Endpoints

### 2.1 Authentication

Authentication is handled by **Supabase Auth SDK** on the client side. No custom backend endpoints are required for registration, login, or session management – the Supabase JS client manages these directly.

**Standard Supabase Auth flows used:**

- `supabase.auth.signUp({ email, password })` – register
- `supabase.auth.signInWithPassword({ email, password })` – login
- `supabase.auth.signOut()` – logout
- `supabase.auth.resetPasswordForEmail(email)` – password reset

**Authentication header format for all protected endpoints:**

```
Authorization: Bearer <supabase_session_token>
```

**Standard 401 error response (unauthenticated):**

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

Permanently delete the current user's account and **all** associated data (`profiles`, `trips`, `plan_generations`) via cascade.

**Authentication:** Required

**Request payload:**

```json
{
  "confirmation": "DELETE MY ACCOUNT"
}
```

> Explicit confirmation string is required to prevent accidental deletion.

**Success response `200 OK`:**

```json
{
  "message": "Account successfully deleted"
}
```

**Error responses:**

| Code  | Condition                                  |
| ----- | ------------------------------------------ |
| `400` | Missing or incorrect `confirmation` string |
| `401` | User not authenticated                     |
| `500` | Deletion failed (server error)             |

---

### 2.3 Profile Management

#### GET /api/profiles/me

Retrieve the current user's global profile with all preferences and traveler flags.

**Authentication:** Required

**Success response `200 OK`:**

```json
{
  "id": 123,
  "user_id": "uuid-string",
  "has_kids": false,
  "has_pets": false,
  "has_mobility_issues": false,
  "has_dietary_preferences": true,
  "dietary_preferences_description": "Fish allergy – please include suitable restaurants",
  "default_what": ["nature", "foodie"],
  "default_speed": "balance",
  "default_type": "roadtrip",
  "default_budget": "moderate",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-20T14:45:00Z"
}
```

> Profile is always present for authenticated users – it is automatically created by the `on_user_created` database trigger on registration.

**Error responses:**

| Code  | Condition                                                     |
| ----- | ------------------------------------------------------------- |
| `401` | User not authenticated                                        |
| `404` | Profile not found (should not occur; created on registration) |

---

#### PATCH /api/profiles/me

Update the current user's global profile. Partial updates are supported – only provided fields are modified.

**Authentication:** Required

**Request payload (all fields optional):**

```json
{
  "has_kids": true,
  "has_pets": false,
  "has_mobility_issues": false,
  "has_dietary_preferences": true,
  "dietary_preferences_description": "Vegetarian – no gluten",
  "default_what": ["culture_museums", "nature"],
  "default_speed": "intensive",
  "default_type": "base",
  "default_budget": "luxury"
}
```

**Validation rules:**

- `has_dietary_preferences = true` requires a non-empty `dietary_preferences_description` (after trimming whitespace)
- `dietary_preferences_description` must be `null` or omitted when `has_dietary_preferences = false`
- `default_what`: array, each element must be one of: `nature`, `culture_museums`, `beach_relax`, `city_break`, `foodie`
- `default_speed`: one of `slow_chill`, `balance`, `intensive`
- `default_type`: one of `base`, `base_with_trips`, `roadtrip`
- `default_budget`: one of `budget`, `moderate`, `luxury`

**Success response `200 OK`:** Full updated profile object (same shape as GET /api/profiles/me).

**Error responses:**

| Code  | Condition                                                                  |
| ----- | -------------------------------------------------------------------------- |
| `400` | Validation failure (invalid enum value, missing dietary description, etc.) |
| `401` | User not authenticated                                                     |

**Example `400` response:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid preference values",
    "details": {
      "dietary_preferences_description": "Required and non-empty when has_dietary_preferences is true",
      "default_speed": "Must be one of: slow_chill, balance, intensive"
    }
  }
}
```

---

### 2.4 Trip Management

#### GET /api/trips

Retrieve a paginated list of the current user's trips, sorted by `updated_at` descending (most recently modified first).

**Authentication:** Required

**Query parameters:**

| Parameter | Type    | Default | Description                                            |
| --------- | ------- | ------- | ------------------------------------------------------ |
| `page`    | integer | `1`     | Page number (1-based)                                  |
| `limit`   | integer | `20`    | Items per page (max 100)                               |
| `status`  | string  | —       | Filter by trip status: `CREATED`, `DRAFT`, `CONFIRMED` |

**Success response `200 OK`:**

```json
{
  "trips": [
    {
      "id": 456,
      "user_id": "uuid-string",
      "title": "Summer in Croatia",
      "destination": "Croatia",
      "num_days": 10,
      "num_people": 4,
      "status": "CONFIRMED",
      "created_at": "2024-01-10T09:00:00Z",
      "updated_at": "2024-01-22T16:30:00Z"
    },
    {
      "id": 455,
      "user_id": "uuid-string",
      "title": "Weekend in Paris",
      "destination": null,
      "num_days": null,
      "num_people": null,
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

**Status derivation (computed server-side):**

| Status      | Condition                                            |
| ----------- | ---------------------------------------------------- |
| `CREATED`   | `note_body` is NULL or empty AND `plan_json` is NULL |
| `DRAFT`     | `note_body` has content AND `plan_json` is NULL      |
| `CONFIRMED` | `plan_json` is NOT NULL                              |

**Error responses:**

| Code  | Condition                |
| ----- | ------------------------ |
| `400` | Invalid query parameters |
| `401` | User not authenticated   |

---

#### GET /api/trips/{tripId}

Retrieve detailed information about a specific trip, including note, preferences, and saved plan (if exists).

**Authentication:** Required

**Path parameters:**

- `tripId`: Trip identifier (integer)

**Success response `200 OK`:**

```json
{
  "id": 456,
  "user_id": "uuid-string",
  "title": "Summer in Croatia",
  "destination": "Croatia",
  "num_days": 10,
  "num_people": 4,
  "what": ["culture_museums", "beach_relax", "foodie"],
  "speed": "balance",
  "type": "roadtrip",
  "budget": "moderate",
  "note_body": "Planning a 10-day trip to Croatia in July. Want to visit Dubrovnik, Split, and Hvar...",
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

> If no plan has been saved, `plan_json` and `plan_language` will be `null`.

**Error responses:**

| Code  | Condition                    |
| ----- | ---------------------------- |
| `401` | User not authenticated       |
| `403` | Trip belongs to another user |
| `404` | Trip does not exist          |

---

#### POST /api/trips

Create a new trip. Preference fields (`what`, `speed`, `type`, `budget`) default to the user's current profile values if omitted. `destination` is optional on creation.

**Authentication:** Required

**Request payload:**

```json
{
  "title": "Weekend in Paris",
  "destination": null,
  "num_days": null,
  "num_people": null,
  "what": ["culture_museums", "foodie"],
  "speed": "intensive",
  "type": "base",
  "budget": "luxury",
  "note_body": null
}
```

> If `what`, `speed`, `type`, or `budget` are omitted, the server copies the values from the user's profile (`default_what`, `default_speed`, `default_type`, `default_budget`).

**Validation rules:**

- `title`: required, non-empty, max 255 characters
- `destination`: optional (nullable), max 50 characters
- `num_days`: null or integer 1–30
- `num_people`: null or integer 1–20
- `what`: array, each element must be one of: `nature`, `culture_museums`, `beach_relax`, `city_break`, `foodie`
- `speed`: one of `slow_chill`, `balance`, `intensive` or null
- `type`: one of `base`, `base_with_trips`, `roadtrip` or null
- `budget`: one of `budget`, `moderate`, `luxury` or null
- `note_body`: null or string **max 10,000 characters** (no minimum)

**Success response `201 Created`:**

```json
{
  "id": 457,
  "user_id": "uuid-string",
  "title": "Weekend in Paris",
  "destination": null,
  "num_days": null,
  "num_people": null,
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

**Error responses:**

| Code  | Condition                                                                   |
| ----- | --------------------------------------------------------------------------- |
| `400` | Validation failure (missing title, invalid enum value, note too long, etc.) |
| `401` | User not authenticated                                                      |

**Example `400` response:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid trip data",
    "details": {
      "title": "Title is required",
      "note_body": "Note must not exceed 10000 characters"
    }
  }
}
```

---

#### PATCH /api/trips/{tripId}

Update trip title, destination, note, and/or preferences. Partial updates supported. Does **not** modify `plan_json` – use `PUT /api/trips/{tripId}/plan` for that.

**Authentication:** Required

**Path parameters:**

- `tripId`: Trip identifier (integer)

**Request payload (all fields optional):**

```json
{
  "title": "Updated Trip Title",
  "destination": "Tuscany, Italy",
  "num_days": 5,
  "num_people": 3,
  "what": ["nature", "beach_relax"],
  "speed": "slow_chill",
  "type": "roadtrip",
  "budget": "budget",
  "note_body": "Updated notes about the trip..."
}
```

**Validation rules:** Same as POST /api/trips (title max 255, destination max 50, num_days 1–30, num_people 1–20, enum constraints, note_body max 10,000 chars or null).

**Success response `200 OK`:** Full updated trip object (same shape as GET /api/trips/{tripId}).

**Error responses:**

| Code  | Condition                    |
| ----- | ---------------------------- |
| `400` | Validation failure           |
| `401` | User not authenticated       |
| `403` | Trip belongs to another user |
| `404` | Trip does not exist          |

---

#### DELETE /api/trips/{tripId}

Delete a trip and its associated plan and generation history (via cascade).

**Authentication:** Required

**Path parameters:**

- `tripId`: Trip identifier (integer)

**Success response `204 No Content`** (no body)

**Error responses:**

| Code  | Condition                    |
| ----- | ---------------------------- |
| `401` | User not authenticated       |
| `403` | Trip belongs to another user |
| `404` | Trip does not exist          |

---

### 2.5 AI Plan Generation

#### GET /api/users/me/generation-quota

Check the current user's plan generation usage for the rolling 24-hour window.

**Authentication:** Required

**Success response `200 OK`:**

```json
{
  "used": 7,
  "limit": 10,
  "remaining": 3,
  "reset_at": "2024-01-24T10:00:00Z"
}
```

> `reset_at` is the timestamp of the oldest counted generation + 24 hours — when the next slot will free up.
>
> Only `success` and `api_error` statuses count toward the quota. `validation_error` records (where AI was not invoked) are excluded.

**Error responses:**

| Code  | Condition              |
| ----- | ---------------------- |
| `401` | User not authenticated |

---

#### POST /api/trips/{tripId}/generate-plan

Generate an AI-powered travel plan for a trip. Implemented as a **Supabase Edge Function**. The generated plan is returned in the response but **not persisted** in the database — the client stores it as a temporary in-memory candidate.

**Authentication:** Required

**Path parameters:**

- `tripId`: Trip identifier (integer)

**Request payload:** None (the server reads the trip record and user profile directly)

```json
{}
```

**Server-side processing:**

1. Fetch trip by `tripId` (verify ownership via RLS)
2. Validate `destination` is set (non-null, non-empty) — required for meaningful generation
3. Validate `note_body` length ≤ 10,000 characters
4. Count `plan_generations` for the user in the last 24h (rolling window); reject if ≥ 10
5. Fetch user profile for global context (dietary flags, mobility, kids, pets)
6. Detect dominant language of `note_body`
7. Build structured AI prompt combining: profile flags, trip preferences, note content, detected language
8. Call OpenRouter.ai API via Edge Function (server-side key, never exposed to client)
9. Parse and validate AI response JSON structure
10. Insert a `plan_generations` record with outcome (`success`, `api_error`, or `validation_error`)
11. Return generated plan to client (not written to `trips.plan_json`)

**Success response `200 OK`:**

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
            "description": "Visit the historic royal castle and cathedral on the Vistula River",
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
  "generated_at": "2024-01-23T12:00:00Z",
  "quota": {
    "used": 4,
    "limit": 10,
    "remaining": 6,
    "reset_at": "2024-01-24T10:00:00Z"
  }
}
```

**Error responses:**

| Code  | Condition                                                  |
| ----- | ---------------------------------------------------------- |
| `400` | `destination` is null or empty on the trip                 |
| `400` | `note_body` exceeds 10,000 characters                      |
| `401` | User not authenticated                                     |
| `403` | Trip belongs to another user                               |
| `404` | Trip does not exist                                        |
| `422` | AI response failed server-side structural validation       |
| `429` | Rate limit exceeded (10 generations in rolling 24h window) |
| `502` | AI API error (timeout, upstream failure)                   |

**`429` error response:**

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

**`502` error response:**

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

Persist the in-memory plan candidate to the database. Overwrites any previously saved plan (1:1 relationship). Updates `trips.plan_json` and `trips.plan_language`.

**Authentication:** Required

**Path parameters:**

- `tripId`: Trip identifier (integer)

**Request payload:**

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

**Validation rules:**

- `plan_json`: required, valid JSON object with a `days` array
- `plan_language`: required, 2–10 character language code (e.g., `"pl"`, `"en"`)
- Each activity must include: `timeOfDay` (`morning | afternoon | evening`), `locationName` (string), `description` (string), `categoryTag` (string)

**Success response `200 OK`:** Full updated trip object (same shape as GET /api/trips/{tripId}), with `plan_json`, `plan_language`, and `status: "CONFIRMED"`.

**Error responses:**

| Code  | Condition                          |
| ----- | ---------------------------------- |
| `400` | Missing or malformed `plan_json`   |
| `400` | Missing or invalid `plan_language` |
| `401` | User not authenticated             |
| `403` | Trip belongs to another user       |
| `404` | Trip does not exist                |

---

### 2.6 Plan Generation History

#### GET /api/trips/{tripId}/generations

Retrieve the generation attempt history for a specific trip (for diagnostics).

**Authentication:** Required

**Path parameters:**

- `tripId`: Trip identifier (integer)

**Query parameters:**

| Parameter | Type    | Default | Description                    |
| --------- | ------- | ------- | ------------------------------ |
| `limit`   | integer | `10`    | Max records to return (max 50) |

**Success response `200 OK`:**

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

**Error responses:**

| Code  | Condition                    |
| ----- | ---------------------------- |
| `401` | User not authenticated       |
| `403` | Trip belongs to another user |
| `404` | Trip does not exist          |

---

## 3. Authentication and Authorization

### 3.1 Authentication Mechanism

**Supabase Auth** handles all authentication:

- User registration with email/password
- Login and session management
- Password reset via email
- JWT session tokens

**Client implementation:**

- Use Supabase JavaScript client SDK (`@supabase/supabase-js`)
- The Supabase client automatically manages token storage and refresh
- Include the JWT as `Authorization: Bearer <token>` in all API requests

**Server implementation:**

- Validate session token using Supabase Auth middleware (Edge Functions receive the token in the Authorization header)
- Extract `user_id` from the validated token
- RLS policies use `auth.uid()` to enforce data isolation at the database level

### 3.2 Authorization

**Row Level Security (RLS)** is enabled on all user-owned tables (`profiles`, `trips`, `plan_generations`) and enforces per-user data isolation at the **database level**:

- `SELECT`, `INSERT`, `UPDATE`, `DELETE` policies check `auth.uid() = user_id`
- Unauthorized access returns empty results (SELECT) or errors (writes) — the API layer converts these to `403 Forbidden` responses
- `plan_generations` has no UPDATE policy (append-only design)

**Authorization rules:**

- Users can only view/modify their own profile
- Users can only view/modify/delete their own trips
- Users can only generate plans for their own trips
- Users can only view their own generation history
- Account deletion cascades to all user-owned data

### 3.3 No OAuth Providers

Per PRD §3.1 / US-002: No external login providers (Google, GitHub, etc.) are used in MVP. Only email/password authentication is supported.

---

## 4. Validation and Business Logic

### 4.1 Profile Validation

| Field                             | Rule                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| `has_dietary_preferences = true`  | `dietary_preferences_description` must be non-null and non-empty (trimmed)              |
| `has_dietary_preferences = false` | `dietary_preferences_description` must be null                                          |
| `default_what`                    | Array; values in `['nature', 'culture_museums', 'beach_relax', 'city_break', 'foodie']` |
| `default_speed`                   | One of `slow_chill \| balance \| intensive`                                             |
| `default_type`                    | One of `base \| base_with_trips \| roadtrip`                                            |
| `default_budget`                  | One of `budget \| moderate \| luxury`                                                   |

### 4.2 Trip Validation

| Field         | Rule                                                                                    |
| ------------- | --------------------------------------------------------------------------------------- |
| `title`       | Required, non-empty, max 255 characters                                                 |
| `destination` | Optional (nullable) on creation; max 50 characters; **required before plan generation** |
| `num_days`    | Null or integer 1–30                                                                    |
| `num_people`  | Null or integer 1–20                                                                    |
| `what`        | Array; values in `['nature', 'culture_museums', 'beach_relax', 'city_break', 'foodie']` |
| `speed`       | One of `slow_chill \| balance \| intensive` or null                                     |
| `type`        | One of `base \| base_with_trips \| roadtrip` or null                                    |
| `budget`      | One of `budget \| moderate \| luxury` or null                                           |
| `note_body`   | Null or string **max 10,000 characters** (no minimum)                                   |

### 4.3 Plan Generation Business Logic

**Rate limiting (10 generations per rolling 24-hour window):**

1. Count rows in `plan_generations` where `user_id = auth.uid()` AND `created_at > NOW() - INTERVAL '24 hours'` AND `status IN ('success', 'api_error')`
2. Only AI-invoking attempts count (`success` and `api_error`); `validation_error` records do **not** count (AI was never called)
3. If count ≥ 10, reject with `429 Too Many Requests`
4. The index `(user_id, created_at DESC)` on `plan_generations` makes this query efficient

**Pre-generation validation (server-side, before AI call):**

1. `destination` must be set (non-null, non-empty) — trip needs a target location for meaningful generation
2. `note_body` length must be ≤ 10,000 characters
3. Rate limit must not be exceeded

**Generation attempt recording:**

| `status`           | When recorded                                 | `model_name` | `error_message`    | Counts toward limit? |
| ------------------ | --------------------------------------------- | ------------ | ------------------ | -------------------- |
| `success`          | AI responded with valid structured plan       | Set          | Null               | ✅ Yes               |
| `api_error`        | AI API call failed (timeout, upstream error)  | Set          | Error details      | ✅ Yes               |
| `validation_error` | Server-side pre-validation failed (steps 1–2) | Null         | Validation failure | ❌ No                |

### 4.4 Profile Auto-Creation

On registration, the `on_user_created` database trigger automatically inserts a `profiles` row with defaults:

- `default_what = ['nature']`
- `default_speed = 'balance'`
- `default_type = 'roadtrip'`
- `default_budget = 'moderate'`
- All boolean flags default to `false`

`GET /api/profiles/me` is therefore always guaranteed to return a profile for authenticated users.

### 4.5 Trip Defaults from Profile

When creating a trip (`POST /api/trips`), if preference fields are omitted or null, the server copies the current profile values (`default_what` → `what`, `default_speed` → `speed`, `default_type` → `type`, `default_budget` → `budget`).

Profile traveler flags (`has_kids`, `has_pets`, `has_mobility_issues`, `has_dietary_preferences`, `dietary_preferences_description`) are **read-only** at the trip level — they are always sourced from the profile during plan generation and are not duplicated in the `trips` table.

### 4.6 Implicit Trip Status

Trip status is never stored in the database. It is always derived server-side and included in API responses:

| Status      | Condition                                                   |
| ----------- | ----------------------------------------------------------- |
| `CREATED`   | `note_body` is null or empty string AND `plan_json` is null |
| `DRAFT`     | `note_body` has content AND `plan_json` is null             |
| `CONFIRMED` | `plan_json` is not null                                     |

### 4.7 Plan Candidate (In-Memory, Not Persisted)

- `POST /api/trips/{tripId}/generate-plan` returns the generated plan in the response body but does **not** write it to the database
- The Vue SPA stores the candidate in Pinia state (temporary)
- The candidate is lost on page refresh or browser close (intentional per PRD §3.6 / US-016)
- `PUT /api/trips/{tripId}/plan` is the only way to persist a plan; it overwrites any previously confirmed plan

### 4.8 Language Detection

1. Analyze `note_body` text to detect dominant language
2. Pass detected language code to the AI prompt instruction
3. Store in `trips.plan_language` when the plan is saved via `PUT /api/trips/{tripId}/plan`
4. Return `language` field in the plan generation response so the client can preview it

### 4.9 Account Deletion

- `DELETE /api/users/me` deletes the authenticated user from `auth.users`
- `ON DELETE CASCADE` propagates to `profiles`, `trips`, and `plan_generations`
- Re-login after deletion is impossible
- A confirmation string is required to prevent accidental deletion

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

**Common error codes:**

| Code               | HTTP Status | Description                                      |
| ------------------ | ----------- | ------------------------------------------------ |
| `UNAUTHORIZED`     | `401`       | Authentication required or invalid token         |
| `FORBIDDEN`        | `403`       | User lacks permission to access the resource     |
| `NOT_FOUND`        | `404`       | Resource does not exist                          |
| `VALIDATION_ERROR` | `400`       | Request data failed validation                   |
| `QUOTA_EXCEEDED`   | `429`       | Generation rate limit exceeded                   |
| `AI_API_ERROR`     | `502`       | AI service error (timeout, upstream API failure) |
| `INTERNAL_ERROR`   | `500`       | Unexpected server error                          |

---

## 6. Implementation Notes

### 6.1 Technology Stack Integration

**Supabase:**

- Use Supabase JS client for authentication session management
- Use Supabase PostgREST (with RLS) for standard CRUD: `profiles`, `trips`
- Use Supabase Edge Functions for AI generation, quota calculation, and account deletion

**OpenRouter.ai:**

- Called exclusively from Supabase Edge Functions (API key is server-side only, never sent to browser)
- API key stored in Supabase secrets
- Configure a request timeout (30–60 seconds) for AI calls
- Handle errors gracefully: record `api_error` in `plan_generations`, return `502` to client

**Frontend (Vue 3 + Pinia):**

- Store plan candidate in Pinia state (temporary, lost on refresh)
- Clear candidate on page navigation away from the trip view
- Show loading state during generation
- Display `X/10` quota counter using data from `GET /api/users/me/generation-quota` or the `quota` field in the generation response

### 6.2 Edge Functions Required

| Endpoint                                 | Reason for Edge Function                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `POST /api/trips/{tripId}/generate-plan` | Calls OpenRouter.ai (server-side API key); enforces rate limiting; orchestrates multi-step logic |
| `GET /api/users/me/generation-quota`     | Rolling 24h window count query with complex filtering                                            |
| `DELETE /api/users/me`                   | Requires admin-level Supabase Auth delete operation                                              |

Standard CRUD endpoints for `profiles` and `trips` can use the Supabase JS client with PostgREST and RLS directly.

### 6.3 Pagination Strategy

- Page-based pagination: `page` (1-based) + `limit` (default 20, max 100)
- Trip list uses `idx_trips_user_updated` index (`user_id, updated_at DESC`) for efficient sorted pagination

### 6.4 Security Summary

| Concern                | Mitigation                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| AI API key exposure    | Stored server-side in Edge Function environment; never sent to client                    |
| Cross-user data access | RLS policies enforce `auth.uid() = user_id` at DB level                                  |
| Rate limiting          | `plan_generations` table tracks attempts; enforced in Edge Function before AI invocation |
| Input injection        | Both API validation layer and DB CHECK constraints validate all inputs                   |
| Session security       | Short-lived JWTs with auto-refresh; managed by Supabase Auth                             |
| Email enumeration      | Password reset always returns `200` regardless of whether the email exists               |

---

## 7. Summary

This REST API plan provides:

✅ **Complete CRUD operations** for profiles and trips
✅ **AI plan generation** with rate limiting (10/24h rolling window) and quota visibility
✅ **Robust authentication** via Supabase Auth (email/password only, no OAuth)
✅ **Database-level authorization** via Row Level Security on all user-owned tables
✅ **Comprehensive validation** aligned with DB schema constraints
✅ **Clear error handling** with consistent response format
✅ **Technology stack alignment** with Supabase Edge Functions, Vue 3 + Pinia, and OpenRouter.ai
✅ **Correct note validation** – max 10,000 characters, no minimum required
✅ **Dietary preferences logic** – description required only when flag is enabled
✅ **Trip destination flow** – nullable on creation, required before AI plan generation

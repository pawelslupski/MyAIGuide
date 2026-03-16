# Database Schema – MyAIGuide

## Overview

This schema is designed for PostgreSQL via Supabase, leveraging Supabase Auth for user management and Row Level
Security (RLS) for per-user data isolation. The design follows the decisions from the planning session and supports all
requirements from the PRD.

**Important:** The `users` table is managed by **Supabase Auth**, not a custom `public.users` table. All user-owned
tables reference `users(id)` via foreign keys.

---

## 1. Tables

### 1.1 `users` (Supabase-managed)

**Purpose:** Source of truth for user identity and authentication.
**Managed by:** Supabase Auth (not created via migration).
**Key fields:**

- `id` (uuid, primary key)
- `email` (varchar(255), unique, not null)
- `encrypted_password` (varchar(255), not null)
- `created_at` (timestamptz, not null, default now())
- `confirmed_at`(timestamptz)

---

### 1.2 `profiles`

**Purpose:** Store global user preferences and flags (1:1 with `users`).

| Column                            | Type          | Constraints                                                                                                                                     | Description                                                                          |
| --------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `id`                              | bigserial     | PRIMARY KEY                                                                                                                                     | Profile identifier                                                                   |
| `user_id`                         | uuid          | UNIQUE NOT NULL, REFERENCES auth.users(id) ON DELETE CASCADE                                                                                    | User identifier (1:1 relationship)                                                   |
| `has_kids`                        | boolean       | NOT NULL DEFAULT false                                                                                                                          | Traveling with children                                                              |
| `has_pets`                        | boolean       | NOT NULL DEFAULT false                                                                                                                          | Traveling with pets                                                                  |
| `has_mobility_issues`             | boolean       | NOT NULL DEFAULT false                                                                                                                          | Has mobility limitations                                                             |
| `has_dietary_preferences`         | boolean       | NOT NULL DEFAULT false                                                                                                                          | Has dietary preferences                                                              |
| `dietary_preferences_description` | text          | CHECK (NOT has_dietary_preferences OR (dietary_preferences_description IS NOT NULL AND char_length(trim(dietary_preferences_description)) > 0)) | Required non-empty description when `has_dietary_preferences = true`; NULL otherwise |
| `default_what`                    | varchar(50)[] | DEFAULT '{}', CHECK (default_what <@ ARRAY['nature', 'culture_museums', 'beach_relax', 'city_break', 'foodie']::varchar[])                      | Default "What?" preferences (multi-choice)                                           |
| `default_speed`                   | varchar(20)   | DEFAULT 'balance', CHECK (default_speed IN ('slow_chill', 'balance', 'intensive'))                                                              | Default "How fast?" preference                                                       |
| `default_type`                    | varchar(20)   | DEFAULT 'roadtrip', CHECK (default_type IN ('base', 'base_with_trips', 'roadtrip'))                                                             | Default trip type                                                                    |
| `default_budget`                  | varchar(20)   | DEFAULT 'moderate', CHECK (default_budget IN ('budget', 'moderate', 'luxury'))                                                                  | Default budget level                                                                 |
| `created_at`                      | timestamptz   | NOT NULL DEFAULT now()                                                                                                                          | Profile creation timestamp                                                           |
| `updated_at`                      | timestamptz   | NOT NULL DEFAULT now()                                                                                                                          | Last update timestamp                                                                |

**Notes:**

- `default_what` is an array to support multi-choice values:
  `['nature', 'culture_museums', 'beach_relax', 'city_break', 'foodie']`
- VARCHAR constraints use CHECK instead of PostgreSQL ENUMs for easier future changes
- `dietary_preferences_description` is enforced non-empty at DB level when the flag is `true`; the UI must also
  prevent saving an empty description when the flag is active (PRD §3.2)
- Internal values for `default_what`: `nature`, `culture_museums`, `beach_relax`, `city_break`, `foodie`
- Internal values for `default_speed`: `slow_chill`, `balance`, `intensive`
- Internal values for `default_type`: `base`, `base_with_trips`, `roadtrip`
- Internal values for `default_budget`: `budget`, `moderate`, `luxury`
- Column defaults for preference fields are set explicitly so that auto-created profiles are immediately usable

---

### 1.3 `trips`

**Purpose:** Store trips, notes, per-trip preferences, and confirmed plans.

| Column          | Type          | Constraints                                                                                                        | Description                                         |
| --------------- | ------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `id`            | bigserial     | PRIMARY KEY                                                                                                        | Trip identifier                                     |
| `user_id`       | uuid          | NOT NULL, REFERENCES auth.users(id) ON DELETE CASCADE                                                              | Owner of the trip                                   |
| `title`         | varchar(255)  | NOT NULL                                                                                                           | Trip name/title                                     |
| `destination`   | varchar(50)   |                                                                                                                    | Trip destination, e.g. "Paris, France"; nullable    |
| `num_days`      | smallint      | CHECK (num_days IS NULL OR (num_days BETWEEN 1 AND 30))                                                            | Planned trip duration in days (1–30); nullable      |
| `num_people`    | smallint      | CHECK (num_people IS NULL OR (num_people BETWEEN 1 AND 20))                                                        | Number of travelers (1–20); nullable                |
| `what`          | varchar(50)[] | DEFAULT '{}', CHECK (what <@ ARRAY['nature', 'culture_museums', 'beach_relax', 'city_break', 'foodie']::varchar[]) | Per-trip "What?" preferences (overrides profile)    |
| `speed`         | varchar(20)   | CHECK (speed IN ('slow_chill', 'balance', 'intensive'))                                                            | Per-trip "How fast?" preference                     |
| `type`          | varchar(20)   | CHECK (type IN ('base', 'base_with_trips', 'roadtrip'))                                                            | Per-trip type                                       |
| `budget`        | varchar(20)   | CHECK (budget IN ('budget', 'moderate', 'luxury'))                                                                 | Per-trip budget                                     |
| `note_body`     | text          | CHECK (note_body IS NULL OR char_length(note_body) <= 10000)                                                       | Trip note: optional free-form text, max 10000 chars |
| `plan_language` | varchar(10)   |                                                                                                                    | Language of the saved plan (e.g., 'pl', 'en')       |
| `plan_json`     | jsonb         |                                                                                                                    | Confirmed/saved plan (NULL if no plan saved)        |
| `created_at`    | timestamptz   | NOT NULL DEFAULT now()                                                                                             | Trip creation timestamp                             |
| `updated_at`    | timestamptz   | NOT NULL DEFAULT now()                                                                                             | Last modification timestamp                         |

**Notes:**

- `note_body` is fully optional (nullable, no minimum length); max 10,000 characters if provided (PRD §3.5 / US-012)
- `destination` is required before plan generation, but not required on initial trip creation; per-trip field for the
  travel goal (e.g.
  city/region/country) per PRD §3.4 / US-011
- Trip status is derived implicitly:
  - **CREATED**: `note_body` is NULL or empty, `plan_json` is NULL
  - **DRAFT**: `note_body` has content, `plan_json` is NULL
  - **CONFIRMED**: `plan_json` is NOT NULL
- Preference fields (`what`, `speed`, `type`, `budget`) override global defaults from `profiles`
- **Realtime:** `REPLICA IDENTITY FULL` is set on this table and it is added to the `supabase_realtime` publication
  (migration `20260316000000`). The frontend subscribes to row-level UPDATE events per trip so all open browser tabs
  stay in sync without polling.
- `plan_json` structure (example):

```json
{
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
}
```

---

### 1.4 `plan_generations`

**Purpose:** Track AI plan generation attempts for rate limiting and diagnostics.

| Column          | Type         | Constraints                                                                        | Description                                           |
| --------------- | ------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `id`            | bigserial    | PRIMARY KEY                                                                        | Generation record identifier                          |
| `user_id`       | uuid         | NOT NULL, REFERENCES auth.users(id) ON DELETE CASCADE                              | User who triggered generation                         |
| `trip_id`       | bigint       | NOT NULL                                                                           | Trip for which plan was generated (no FK — see §6.13) |
| `status`        | varchar(20)  | NOT NULL, CHECK (status IN ('success', 'api_error', 'validation_error','pending')) | Generation outcome                                    |
| `model_name`    | varchar(100) |                                                                                    | AI model used (NULL for validation_error / pending)   |
| `error_message` | text         |                                                                                    | Error details (NULL for successful runs)              |
| `created_at`    | timestamptz  | NOT NULL DEFAULT now()                                                             | Generation attempt timestamp                          |

**Notes:**

- Only AI-invoking attempts (success or API errors) are recorded; pure client-side validation failures are NOT recorded
- Used to enforce 10 generations per user in a rolling 24-hour window
- `status` values:
  - `pending`: Quota slot reserved atomically before the AI call starts; updated to a final status when the call
    completes. Records older than 90 s are treated as stale and excluded from quota counts.
  - `success`: Plan generated successfully → `model_name` is set, `error_message` is NULL
  - `api_error`: AI API call failed (timeout, rate limit, etc.) → `model_name` is set, `error_message` contains error
    details
  - `validation_error`: Server-side validation failed (note too short/long, etc.) → `model_name` is NULL (AI not
    invoked), `error_message` contains validation error
- The `pending` status is managed exclusively by the `try_reserve_generation_slot` / `finalize_generation_slot`
  SECURITY DEFINER functions (see §5.3). Direct UPDATE via RLS is not granted.
- Append-only table designed for potential future partitioning by `created_at`

---

## 2. Relationships

| Relationship                 | Type | Description                                     |
| ---------------------------- | ---- | ----------------------------------------------- |
| `users` ↔ `profiles`         | 1:1  | Each user has exactly one profile               |
| `users` → `trips`            | 1:N  | Each user can have multiple trips               |
| `users` → `plan_generations` | 1:N  | Each user can have multiple generation attempts |
| `trips` → `plan_generations` | 1:N  | Each trip can have multiple generation attempts |

**Cascade deletion:**

- Deleting a user from `users` cascades to `profiles`, `trips`, and `plan_generations`
- Deleting a **trip** does **not** cascade to `plan_generations` — the FK constraint was intentionally dropped
  (migration `20260306000000_fix_plan_generations_trip_cascade`). `trip_id` is kept as a plain `bigint` for
  diagnostic/history purposes. This prevents a quota-bypass attack where deleting a trip would erase generation
  records and allow unlimited re-generation.

---

## 3. Indexes

### 3.1 Primary Keys (automatic indexes)

- `users(id)` - UUID
- `profiles(id)` - BIGSERIAL
- `trips(id)` - BIGSERIAL
- `plan_generations(id)` - BIGSERIAL

### 3.2 Custom Indexes

```sql
-- For profiles: unique constraint on user_id (1:1 relationship with users)
CREATE UNIQUE INDEX idx_profiles_user_id ON profiles (user_id);

-- For dashboard: list trips per user sorted by last modification
CREATE INDEX idx_trips_user_updated ON trips (user_id, updated_at DESC);

-- For rate limiting: count generations per user in rolling 24h window
CREATE INDEX idx_plan_generations_user_created ON plan_generations (user_id, created_at DESC);

-- For trip-specific generation history (do not apply now, it's for future analytics)
CREATE INDEX idx_plan_generations_trip ON plan_generations (trip_id, created_at DESC);
```

**Notes:**

- No JSONB GIN indexes on `trips.plan_json` in MVP (treat plan as write-optimized blob)
- Additional indexes can be added later based on query patterns

---

## 4. Row Level Security (RLS) Policies

All user-owned tables enforce strict per-user isolation using Supabase RLS.

### 4.1 `profiles` Table

```sql
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can view only their own profile
CREATE
POLICY "Users can view own profile"
  ON profiles FOR
SELECT
    USING (auth.uid() = user_id);

-- Users can insert only their own profile
CREATE
POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update only their own profile
CREATE
POLICY "Users can update own profile"
  ON profiles FOR
UPDATE
    USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete only their own profile
CREATE
POLICY "Users can delete own profile"
  ON profiles FOR DELETE
USING (auth.uid() = user_id);
```

### 4.2 `trips` Table

```sql
-- Enable RLS
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- Users can view only their own trips
CREATE
POLICY "Users can view own trips"
  ON trips FOR
SELECT
    USING (auth.uid() = user_id);

-- Users can insert only their own trips
CREATE
POLICY "Users can insert own trips"
  ON trips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update only their own trips
CREATE
POLICY "Users can update own trips"
  ON trips FOR
UPDATE
    USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete only their own trips
CREATE
POLICY "Users can delete own trips"
  ON trips FOR DELETE
USING (auth.uid() = user_id);
```

### 4.3 `plan_generations` Table

```sql
-- Enable RLS
ALTER TABLE plan_generations ENABLE ROW LEVEL SECURITY;

-- Users can view only their own generation records
CREATE
POLICY "Users can view own generations"
  ON plan_generations FOR
SELECT
    USING (auth.uid() = user_id);

-- Users can insert only their own generation records
CREATE
POLICY "Users can insert own generations"
  ON plan_generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users cannot update generation records directly (append-only via RLS)
-- UPDATE is performed only by finalize_generation_slot() SECURITY DEFINER function
-- No direct UPDATE policy

-- Users can delete only their own generation records (via trip cascade)
CREATE
POLICY "Users can delete own generations"
  ON plan_generations FOR DELETE
USING (auth.uid() = user_id);
```

**Notes:**

- RLS ensures users can only access their own data
- Direct UPDATE is not allowed via RLS; the `finalize_generation_slot()` SECURITY DEFINER function updates `pending`
  records to their final status, bypassing RLS safely under controlled conditions (see §5.3)
- All policies use `auth.uid()` to get the current authenticated user's ID

---

## 5. Triggers and Functions

### 5.1 Update `updated_at` Timestamp

```sql
-- Function to update updated_at column
CREATE
OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at
= now();
RETURN NEW;
END;
$$
LANGUAGE plpgsql;

-- Trigger for profiles table
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE
    ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for trips table
CREATE TRIGGER update_trips_updated_at
    BEFORE UPDATE
    ON trips
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 5.2 Profile Auto-Creation Trigger

A new profile row is automatically inserted into `profiles` immediately after a user registers. The trigger populates
all preference defaults so the profile is immediately usable

```sql
CREATE
OR REPLACE FUNCTION create_profile_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
INSERT INTO public.profiles (user_id, default_what, default_speed, default_type, default_budget)
VALUES (NEW.id,
        ARRAY['nature']::varchar[], -- Co? → Przyroda
        'balance', -- Jak szybko? → Balans
        'roadtrip', -- Jaki typ? → Roadtrip
        'moderate' -- Budżet? → Umiarkowanie
       );
RETURN NEW;
END;
$$
LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created
    AFTER INSERT
    ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_profile_for_new_user();
```

**Defaults align with PRD §3.2:** "Profil tworzony automatycznie przy rejestracji z domyślnymi wartościami: Co?
Przyroda, Jak szybko? Balans, Jaki typ? Road trip, Budżet? Umiarkowanie."

### 5.3 Atomic Quota Reservation Functions

Two SECURITY DEFINER functions handle the atomic quota check + reservation pattern (migration `20260316000000`):

#### `try_reserve_generation_slot(p_trip_id BIGINT) → BIGINT`

Atomically checks the caller's quota and, if within the limit, inserts a `pending` record and returns its `id`
(the `reservation_id`).

**Concurrency safety:** `pg_advisory_xact_lock(hashtext(user_id))` serialises all concurrent calls for the same user.
Two simultaneous requests both see each other's `pending` record and the second correctly gets blocked.

**Stale-pending handling:** `pending` records older than 90 s are excluded from the quota count (Edge Function timeout
is 60 s, so any older record is from a crashed invocation).

**Raises:**

- `P0429 QUOTA_EXCEEDED` — user is at their limit and cooldown has not expired
- `P0401 UNAUTHORIZED` — called without an active session

#### `finalize_generation_slot(p_reservation_id BIGINT, p_status VARCHAR, p_model_name VARCHAR, p_error_message TEXT)`

Updates a `pending` record to its final status (`success`, `api_error`, or `validation_error`) once the AI call
completes. Verifies ownership via `auth.uid()`. If the record is not found (already finalised or wrong id) a WARNING
is emitted but no exception is raised, so the caller is never interrupted.

**Call sequence in the Edge Function:**

1. `try_reserve_generation_slot(tripId)` → `reservationId` (or 429)
2. Call OpenRouter AI
3. `finalize_generation_slot(reservationId, 'success'|'api_error', ...)` → void

---

## 6. Design Decisions and Rationale

### 6.1 Primary Key Strategy

- **Decision:** Use `UUID` for `users` table only; use `BIGSERIAL` for all other tables (`profiles`, `trips`,
  `plan_generations`).
- **Rationale:**
  - `UUID` for users: Managed by Supabase Auth, provides global uniqueness and non-enumerable IDs for security
  - `BIGSERIAL` for other tables: Better performance (smaller storage, faster indexing), simpler debugging, and
    sufficient for application-scoped entities
  - Foreign keys reference appropriate types: `user_id` as UUID, `trip_id` as BIGINT
- **Trade-off:** Mixed key types require careful attention in foreign key definitions, but benefits outweigh complexity.

### 6.2 Single `trips` Table for Notes and Plans

- **Decision:** Store both note and confirmed plan in the `trips` table (no separate `trip_plans` table).
- **Rationale:** Strict 1:1 relationship between trip and plan in MVP; simplifies schema and queries.
- **Trade-off:** Future plan versioning would require schema changes, but this is acceptable for MVP.

### 6.3 Implicit Trip Status

- **Decision:** No explicit `status` column; derive status from data (`note_body` and `plan_json` presence).
- **Rationale:** Reduces redundancy and potential inconsistencies; status is always accurate.
- **Implementation:**
  - CREATED: `note_body` is NULL/empty AND `plan_json` is NULL
  - DRAFT: `note_body` has content AND `plan_json` is NULL
  - CONFIRMED: `plan_json` is NOT NULL

### 6.4 VARCHAR + CHECK Constraints Instead of ENUMs

- **Decision:** Use `varchar` columns with `CHECK` constraints for preference fields.
- **Rationale:** PostgreSQL ENUMs are difficult to modify; varchar constraints allow easier future changes and better
  performance than unbounded text.
- **Example:** `CHECK (speed IN ('slow_chill', 'balance', 'intensive'))`

### 6.5 JSONB for Plan Storage

- **Decision:** Store confirmed plan as `JSONB` in `trips.plan_json`.
- **Rationale:**
  - Flexible schema for plan structure evolution
  - No need to query deep into plan structure in MVP
  - Write-optimized (no GIN indexes initially)
- **Future:** Add GIN indexes if plan querying becomes necessary.

### 6.6 Separate `plan_generations` Table

- **Decision:** Track all AI generation attempts in a dedicated table.
- **Rationale:**
  - Enables accurate rate limiting (10 per 24h per user)
  - Provides diagnostics and observability (model used, errors)
  - Append-only design supports future partitioning/pruning
- **What's counted:** Only attempts that invoke AI (success or API errors); client-side validation failures are NOT
  recorded. Active `pending` records (< 90 s old) also count toward the quota to prevent double-spend during
  concurrent requests.

### 6.7 Hard Deletes with Cascades

- **Decision:** Use `ON DELETE CASCADE` from `users` to all dependent tables.
- **Rationale:** PRD requires permanent account deletion; cascades ensure complete data removal.
- **No soft deletes:** MVP does not require audit trails or data recovery.

### 6.8 Validation (DB Level)

- **DB enforces:**
  - Note length: NULL allowed (for new trips), or up to 10,000 chars maximum (via CHECK constraint); no minimum
    required by the PRD
  - Valid preference values (via CHECK constraints)
  - Field length limits (via VARCHAR constraints)
  - Dietary preferences description: non-empty text required when `has_dietary_preferences = true` (via CHECK
    constraint)
- **Rationale:** DB protects data integrity; NULL allows trip creation, length constraint ensures quality when notes are
  saved.

### 6.9 Minimal Indexing Strategy

- **Decision:** Start with only essential indexes for known query patterns.
- **Rationale:** Avoid premature optimization; indexes have write overhead.
- **Essential indexes:**
  - `profiles(user_id)` for 1:1 relationship lookup
  - `trips(user_id, updated_at DESC)` for dashboard sorting
  - `plan_generations(user_id, created_at DESC)` for rate limiting
- **Future:** Add indexes based on actual query performance needs.

### 6.10 No Table Partitioning in MVP

- **Decision:** Keep all tables unpartitioned initially.
- **Rationale:** Simplicity for MVP; partitioning adds complexity.
- **Future:** Consider partitioning `plan_generations` by `created_at` if table grows large.

### 6.11 RLS for Security

- **Decision:** Use Supabase Row Level Security on all user-owned tables.
- **Rationale:**
  - Enforces per-user data isolation at database level
  - Prevents unauthorized access even if application logic has bugs
  - Aligns with PRD requirement US-003 (data isolation)

### 6.13 Dropped FK on `plan_generations.trip_id`

- **Decision:** Remove the `REFERENCES trips(id) ON DELETE CASCADE` foreign key from `plan_generations.trip_id`
  (migration `20260306000000_fix_plan_generations_trip_cascade`).
- **Rationale:** With the cascade in place, deleting a trip would delete its generation records, allowing a user to
  bypass the 10-generations/24h quota by repeatedly creating and deleting trips. Dropping the FK keeps generation
  records intact for accurate rate limiting even after the associated trip is deleted.
- **Trade-off:** `trip_id` becomes an orphaned reference after trip deletion; this is acceptable because the column
  is used for diagnostics only and is never joined from the UI.

---

### 6.12 Conditional Dietary Preferences Description

- **Decision:** Add `dietary_preferences_description` text column to `profiles` with a conditional CHECK constraint.
- **Rationale:** PRD §3.2 requires that when "Mam preferencje żywieniowe" is enabled, the user must provide a
  non-empty description (e.g., "Mam alergię na ryby"). The CHECK ensures this invariant is enforced at the DB level,
  not only in the UI.
- **Constraint:**
  `CHECK (NOT has_dietary_preferences OR (dietary_preferences_description IS NOT NULL AND char_length(trim(dietary_preferences_description)) > 0))`
- **UI behaviour:** The description textarea must be shown and required whenever the dietary toggle is active; the save
  and plan generation button must be disabled while it is empty.

---

## 7. Migration History

### 7.1 Order of Table Creation

1. `update_updated_at_column` function
2. `profiles` table
3. `trips` table
4. `plan_generations` table`
5. Profile auto-creation trigger
6. RLS disable/enable policies
7. Profile preference column defaults
8. `20260306000000_fix_plan_generations_trip_cascade` — drop `plan_generations.trip_id` FK to prevent quota bypass
9. `20260316000000_quota_reservation_and_realtime` — add `pending` status; add `try_reserve_generation_slot` and
   `finalize_generation_slot` SECURITY DEFINER functions; enable Realtime on `trips`

---

## 8. Future Enhancements (Out of MVP Scope)

### 8.1 Plan Versioning

- Add `plan_versions` table to store multiple plan versions per trip
- Migrate `trips.plan_json` to `plan_versions` with version numbers

### 8.2 Plan Search and Filtering

- Add GIN indexes on `trips.plan_json` for JSONB queries
- Enable searching plans by location, category, or other attributes

### 8.3 Data Retention and Archival

- Implement partitioning on `plan_generations` by month
- Add retention policies to prune old generation records

### 8.4 Soft Deletes and Audit Logging

- Add `deleted_at` column for soft deletes
- Create audit tables to track changes to trips and plans

### 8.5 Sharing and Collaboration

- Add `trip_shares` table for sharing trips between users
- Implement read-only access policies for shared trips

### 8.6 Analytics and Reporting

- Add materialized views for user activity metrics
- Track plan generation success rates and model performance

---

## 9. Reference: Preference Field Values

### 9.1 Internal Values Mapping

| Field    | DB value          | UI label (PL)                 |
| -------- | ----------------- | ----------------------------- |
| `what`   | `nature`          | 🌲 Przyroda                   |
| `what`   | `culture_museums` | 🏛️ Kultura/Muzea              |
| `what`   | `beach_relax`     | 🏖️ Plaża/Relaks               |
| `what`   | `city_break`      | 🏙️ City Break                 |
| `what`   | `foodie`          | 🍽️ Foodie                     |
| `speed`  | `slow_chill`      | 🐢 Slow / Chill               |
| `speed`  | `balance`         | ⚖️ Balans                     |
| `speed`  | `intensive`       | 🐇 Intensywnie / Max atrakcji |
| `type`   | `base`            | 📍 Baza wypadowa              |
| `type`   | `base_with_trips` | 📍+ 🚗 Baza z wypadami        |
| `type`   | `roadtrip`        | 🚗 Roadtrip                   |
| `budget` | `budget`          | € Oszczędnie                  |
| `budget` | `moderate`        | €€ Umiarkowanie               |
| `budget` | `luxury`          | €€€ Luksusowo                 |

### 9.2 Note Length Validation

- PRD requirement (US-012): maximum 10,000 characters; no minimum
- DB constraint: `CHECK (note_body IS NULL OR char_length(note_body) <= 10000)`
- NULL is allowed (trip with no note yet written)
- The UI shows a character counter and disables "Generate plan" when length > 10,000

---

## 10. Summary

This schema provides a solid foundation for MyAIGuide MVP with:

- ✅ Strict per-user data isolation via RLS
- ✅ Support for global and per-trip preferences
- ✅ Dietary preferences with mandatory description enforced at DB level
- ✅ Efficient rate limiting for AI generations
- ✅ **Atomic quota reservation** via advisory-lock SECURITY DEFINER functions — eliminates TOCTOU race
- ✅ Flexible plan storage with JSONB
- ✅ Complete data deletion on account removal
- ✅ Minimal but targeted indexing for performance
- ✅ **Realtime sync** — open browser tabs receive trip UPDATE events without polling
- ✅ Room for future enhancements without breaking changes

The design prioritizes simplicity and correctness for MVP while maintaining extensibility for future features.

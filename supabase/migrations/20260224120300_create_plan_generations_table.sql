-- =============================================================================
-- Migration: create_plan_generations_table
-- Purpose:   Create the `plan_generations` table which tracks every AI plan
--            generation attempt for rate-limiting (10 per user per 24 h) and
--            diagnostics (model used, error messages).
-- Affected tables: public.plan_generations
-- Special considerations:
--   - Append-only design: no UPDATE policy is created (by intent, not omission).
--   - Only AI-invoking attempts (success / api_error) are recorded;
--     pure client-side validation failures are NOT inserted here.
--   - `model_name` is null when status = 'validation_error' (AI was never called).
--   - `error_message` is null when status = 'success'.
--   - RLS enabled; explicit policies for both `authenticated` and `anon`.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table definition
-- ---------------------------------------------------------------------------
create table public.plan_generations (
  -- surrogate primary key
  id        bigserial    primary key,

  -- who triggered the generation; cascade from auth.users handles account deletion
  user_id   uuid         not null references auth.users(id) on delete cascade,

  -- which trip was being planned; cascade removes history when a trip is deleted
  trip_id   bigint       not null references public.trips(id) on delete cascade,

  -- generation outcome:
  --   'success'          → plan returned; model_name set, error_message null
  --   'api_error'        → AI API failed; model_name set, error_message contains details
  --   'validation_error' → server-side validation failed before AI call;
  --                        model_name null, error_message contains validation details
  status        varchar(20) not null
    check (status in ('success', 'api_error', 'validation_error')),

  -- AI model identifier (e.g. 'gpt-4o', 'claude-3-5-sonnet');
  -- null when status = 'validation_error' because the AI was never invoked
  model_name    varchar(100),

  -- human-readable error details; null when status = 'success'
  error_message text,

  -- generation attempt timestamp (used for rate-limiting window queries)
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- covers the rate-limit query: count rows for a user within the last 24 hours
-- ordered desc so recent rows are found first (efficient for limit/count)
create index idx_plan_generations_user_created
  on public.plan_generations (user_id, created_at desc);

-- covers trip-level generation history (diagnostics / future analytics)
create index idx_plan_generations_trip
  on public.plan_generations (trip_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

-- enable RLS — without a matching policy all access is denied by default
alter table public.plan_generations enable row level security;

-- ·· authenticated role ···················································

-- authenticated users may only read their own generation records
create policy "authenticated_select_own_generations"
  on public.plan_generations
  for select
  to authenticated
  using (auth.uid() = user_id);

-- authenticated users may only insert generation records for themselves
-- (application server inserts a record after each AI call)
create policy "authenticated_insert_own_generations"
  on public.plan_generations
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- NOTE: no UPDATE policy — plan_generations is intentionally append-only.
-- Omitting this policy (rather than creating a false one) conveys the design intent:
-- once a generation record is written it must never be mutated.

-- authenticated users may only delete their own generation records
-- (direct deletion is rarely needed; cascade from trips/users handles bulk removal)
create policy "authenticated_delete_own_generations"
  on public.plan_generations
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ·· anon role ····························································
-- anonymous users have zero access to generation records

create policy "anon_no_select_generations"
  on public.plan_generations
  for select
  to anon
  using (false);

create policy "anon_no_insert_generations"
  on public.plan_generations
  for insert
  to anon
  with check (false);

create policy "anon_no_delete_generations"
  on public.plan_generations
  for delete
  to anon
  using (false);

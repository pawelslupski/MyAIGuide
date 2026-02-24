-- =============================================================================
-- Migration: create_trips_table
-- Purpose:   Create the `trips` table which holds trip metadata, per-trip
--            preferences, the user's free-form note, and the confirmed AI plan.
-- Affected tables: public.trips
-- Special considerations:
--   - Implicit trip status derived from note_body / plan_json presence (no enum).
--   - Per-trip preference columns override profile defaults at application level.
--   - plan_json stored as JSONB for flexible schema evolution (no GIN index in MVP).
--   - RLS enabled; explicit policies for both `authenticated` and `anon`.
--   - Depends on `update_updated_at_column` function (migration 120000).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table definition
-- ---------------------------------------------------------------------------
create table public.trips (
  -- surrogate primary key
  id        bigserial    primary key,

  -- owner reference; cascade ensures all trips are removed on account deletion
  user_id   uuid         not null references auth.users(id) on delete cascade,

  -- required trip metadata
  title       varchar(255) not null,
  destination varchar(50)  not null, -- e.g. "Paris, France"; required per PRD §3.4 / US-011

  -- optional numeric parameters; null means not yet specified by the user
  num_days    smallint check (num_days   is null or (num_days   between 1 and 30)),
  num_people  smallint check (num_people is null or (num_people between 1 and 20)),

  -- per-trip preferences (override global profile defaults when set)
  -- multi-choice activity array; same allowed values as profiles.default_what
  what        varchar(50)[] not null default '{}'::varchar[]
    check (
      what <@ array['nature', 'culture_museums', 'beach_relax', 'city_break', 'foodie']::varchar[]
    ),

  -- single-choice overrides; nullable so null means "fall back to profile default"
  speed   varchar(20) check (speed  in ('slow_chill', 'balance', 'intensive')),
  type    varchar(20) check (type   in ('base', 'base_with_trips', 'roadtrip')),
  budget  varchar(20) check (budget in ('budget', 'moderate', 'luxury')),

  -- optional free-form note; null = no note written yet; max 10 000 chars (PRD §3.5 / US-012)
  note_body text
    check (note_body is null or char_length(note_body) <= 10000),

  -- language of the saved plan (e.g. 'pl', 'en'); null when no plan saved yet
  plan_language varchar(10),

  -- confirmed/saved AI plan stored as JSONB blob; null when plan has not yet been saved
  -- implicit trip status:
  --   CREATED   → note_body is null/empty  AND plan_json is null
  --   DRAFT     → note_body has content    AND plan_json is null
  --   CONFIRMED → plan_json is not null
  plan_json jsonb,

  -- audit timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- composite index covering the primary dashboard query:
-- "list all trips for a user ordered by most recently modified"
create index idx_trips_user_updated on public.trips (user_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- auto-update `updated_at` on every UPDATE to trips
create trigger update_trips_updated_at
  before update on public.trips
  for each row
  execute function update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

-- enable RLS — without a matching policy all access is denied by default
alter table public.trips enable row level security;

-- ·· authenticated role ···················································

-- authenticated users may only read their own trips
create policy "authenticated_select_own_trips"
  on public.trips
  for select
  to authenticated
  using (auth.uid() = user_id);

-- authenticated users may only create trips owned by themselves
create policy "authenticated_insert_own_trips"
  on public.trips
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- authenticated users may only modify their own trips
create policy "authenticated_update_own_trips"
  on public.trips
  for update
  to authenticated
  using     (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- authenticated users may only delete their own trips
create policy "authenticated_delete_own_trips"
  on public.trips
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ·· anon role ····························································
-- anonymous users have zero access to trips; explicit false policies for clarity

create policy "anon_no_select_trips"
  on public.trips
  for select
  to anon
  using (false);

create policy "anon_no_insert_trips"
  on public.trips
  for insert
  to anon
  with check (false);

create policy "anon_no_update_trips"
  on public.trips
  for update
  to anon
  using (false);

create policy "anon_no_delete_trips"
  on public.trips
  for delete
  to anon
  using (false);

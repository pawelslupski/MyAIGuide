-- =============================================================================
-- Migration: create_profiles_table
-- Purpose:   Create the `profiles` table that stores global user preferences
--            and flags in a strict 1:1 relationship with `auth.users`.
-- Affected tables: public.profiles
-- Special considerations:
--   - References auth.users(id) with ON DELETE CASCADE for full account deletion.
--   - Uses varchar + CHECK constraints (not ENUMs) for easier future value changes.
--   - Dietary preferences description is enforced non-empty at DB level when the
--     flag `has_dietary_preferences` is true (PRD §3.2).
--   - RLS enabled; explicit policies created for both `authenticated` and `anon`.
--   - Depends on `update_updated_at_column` function (migration 120000).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table definition
-- ---------------------------------------------------------------------------
create table public.profiles (
  -- surrogate primary key (bigserial = auto-incrementing bigint)
  id         bigserial    primary key,

  -- 1:1 link to the Supabase Auth user; cascade ensures profile is removed when
  -- the user account is permanently deleted
  user_id    uuid         unique not null references auth.users(id) on delete cascade,

  -- traveller characteristic flags (all default false)
  has_kids               boolean not null default false,
  has_pets               boolean not null default false,
  has_mobility_issues    boolean not null default false,
  has_dietary_preferences boolean not null default false,

  -- when has_dietary_preferences = true this field MUST be a non-empty, non-blank string;
  -- when has_dietary_preferences = false the field may be null (or contain stale text that
  -- the application should ignore / clear before next save)
  dietary_preferences_description text
    check (
      not has_dietary_preferences
      or (
        dietary_preferences_description is not null
        and char_length(trim(dietary_preferences_description)) > 0
      )
    ),

  -- multi-choice array; allowed values are the five activity categories
  -- an empty array ('{}') is valid (user hasn't chosen anything yet)
  default_what   varchar(50)[] not null default '{}'::varchar[]
    check (
      default_what <@ array['nature', 'culture_museums', 'beach_relax', 'city_break', 'foodie']::varchar[]
    ),

  -- single-choice preference fields; CHECK constraints replace ENUMs for flexibility
  default_speed  varchar(20)  not null default 'balance'
    check (default_speed  in ('slow_chill', 'balance', 'intensive')),

  default_type   varchar(20)  not null default 'roadtrip'
    check (default_type   in ('base', 'base_with_trips', 'roadtrip')),

  default_budget varchar(20)  not null default 'moderate'
    check (default_budget in ('budget', 'moderate', 'luxury')),

  -- audit timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- unique index on user_id backs the UNIQUE constraint and speeds up
-- single-row profile lookups by user (used on every authenticated request)
create unique index idx_profiles_user_id on public.profiles (user_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- auto-update `updated_at` on every UPDATE to profiles
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row
  execute function update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

-- enable RLS — without at least one matching policy all access is denied by default
alter table public.profiles enable row level security;

-- ·· authenticated role ···················································

-- authenticated users may only read their own profile row
create policy "authenticated_select_own_profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

-- authenticated users may only insert a profile row for themselves
-- (the profile auto-creation trigger also relies on SECURITY DEFINER, not this policy)
create policy "authenticated_insert_own_profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- authenticated users may only modify their own profile row
create policy "authenticated_update_own_profile"
  on public.profiles
  for update
  to authenticated
  using     (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- authenticated users may only delete their own profile row
-- (cascade from auth.users is handled at DB level and bypasses RLS)
create policy "authenticated_delete_own_profile"
  on public.profiles
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ·· anon role ····························································
-- anonymous (unauthenticated) users have zero access to profiles;
-- explicit false policies make the intent clear and are more auditable than
-- relying solely on the RLS default-deny behaviour

create policy "anon_no_select_profiles"
  on public.profiles
  for select
  to anon
  using (false);

create policy "anon_no_insert_profiles"
  on public.profiles
  for insert
  to anon
  with check (false);

create policy "anon_no_update_profiles"
  on public.profiles
  for update
  to anon
  using (false);

create policy "anon_no_delete_profiles"
  on public.profiles
  for delete
  to anon
  using (false);

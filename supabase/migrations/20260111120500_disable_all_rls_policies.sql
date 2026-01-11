-- migration: disable all rls policies and rls
-- purpose: drop all row level security policies and disable rls on profiles, trips, and plan_generations tables
-- affected tables: profiles, trips, plan_generations
-- considerations:
--   - this is a destructive operation - removes all access control
--   - disabling rls allows unrestricted access to all rows in these tables
--   - use with caution: all authenticated users will have full access to all data
--   - warning: this removes the per-user data isolation security layer

-- drop all policies from profiles table
-- note: dropping policies in reverse order of dependencies (delete, update, insert, select)
drop policy if exists "Users can delete own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Users can insert own profile" on profiles;
drop policy if exists "Users can view own profile" on profiles;

-- drop all policies from trips table
drop policy if exists "Users can delete own trips" on trips;
drop policy if exists "Users can update own trips" on trips;
drop policy if exists "Users can insert own trips" on trips;
drop policy if exists "Users can view own trips" on trips;

-- drop all policies from plan_generations table
-- note: no update policy exists (append-only table)
drop policy if exists "Users can delete own generations" on plan_generations;
drop policy if exists "Users can insert own generations" on plan_generations;
drop policy if exists "Users can view own generations" on plan_generations;

-- disable row level security on profiles table
-- warning: this allows unrestricted access to all profile data
alter table profiles disable row level security;

-- disable row level security on trips table
-- warning: this allows unrestricted access to all trip data
alter table trips disable row level security;

-- disable row level security on plan_generations table
-- warning: this allows unrestricted access to all generation records
alter table plan_generations disable row level security;

-- add comments documenting the rls removal
comment on table profiles is 'User profiles storing global preferences and flags (1:1 with auth.users) - RLS FULLY DISABLED';
comment on table trips is 'User trips with notes, preferences, and confirmed plans - RLS FULLY DISABLED';
comment on table plan_generations is 'AI plan generation attempts for rate limiting and diagnostics (append-only) - RLS FULLY DISABLED';


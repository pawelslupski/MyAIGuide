-- =============================================================================
-- Migration: create_profile_auto_creation_trigger
-- Purpose:   Automatically create a `profiles` row with sensible defaults
--            immediately after a new user registers via Supabase Auth.
-- Affected tables: public.profiles (via trigger on auth.users)
-- Special considerations:
--   - Trigger fires on auth.users (Supabase-managed schema), not a public table.
--   - Function uses SECURITY DEFINER so it can write to public.profiles while
--     bypassing RLS (the trigger runs in the auth context, not a user session).
--   - Default values align with PRD §3.2:
--       Co?        → Przyroda        (nature)
--       Jak szybko? → Balans         (balance)
--       Jaki typ?   → Road trip      (roadtrip)
--       Budżet?     → Umiarkowanie   (moderate)
--   - Depends on public.profiles table existing (migration 120100).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Function: create_profile_for_new_user
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER: executes with the privileges of the function owner (postgres),
-- not the calling role. This is required because:
--   (a) the trigger fires in the auth schema context where the caller is the
--       internal Supabase service role, not an authenticated end-user, and
--   (b) public.profiles has RLS enabled that would otherwise block the insert.
create or replace function public.create_profile_for_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    user_id,
    default_what,
    default_speed,
    default_type,
    default_budget
  ) values (
    new.id,
    array['nature']::varchar[],  -- Co? → Przyroda (PRD §3.2 default)
    'balance',                   -- Jak szybko? → Balans
    'roadtrip',                  -- Jaki typ? → Road trip
    'moderate'                   -- Budżet? → Umiarkowanie
  );
  return new;
end;
$$ language plpgsql security definer;

-- ---------------------------------------------------------------------------
-- Trigger: on_user_created
-- ---------------------------------------------------------------------------
-- Fires AFTER each new row is inserted into auth.users (i.e. on every
-- successful registration / sign-up). Using AFTER INSERT ensures the auth.users
-- row is fully committed before we reference new.id in the profile insert.
create trigger on_user_created
  after insert on auth.users
  for each row
  execute function public.create_profile_for_new_user();

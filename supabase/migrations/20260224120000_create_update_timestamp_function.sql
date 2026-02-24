-- =============================================================================
-- Migration: create_update_timestamp_function
-- Purpose:   Create a reusable PL/pgSQL trigger function that automatically
--            sets the `updated_at` column to now() before every UPDATE.
-- Affected:  Function `update_updated_at_column` (used by profiles & trips triggers)
-- Notes:     Must be created before any table that depends on it (profiles, trips).
-- =============================================================================

-- create (or replace) the shared trigger function
-- it overwrites `new.updated_at` with the current timestamp and returns the modified row
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

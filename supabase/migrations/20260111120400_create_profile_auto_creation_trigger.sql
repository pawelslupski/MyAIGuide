-- migration: create profile auto-creation trigger
-- purpose: automatically create a profile when a new user registers
-- affected tables: profiles (inserts), auth.users (trigger source)
-- dependencies: profiles table must exist
-- considerations:
--   - uses security definer to allow trigger to insert into profiles
--   - creates profile with default values (all booleans false, no preferences set)
--   - ensures 1:1 relationship between users and profiles is maintained
--   - prevents need for manual profile creation on first login

-- create function to auto-create profile for new users
-- security definer allows the function to insert into profiles table
-- even though the trigger runs in the context of auth schema
create or replace function create_profile_for_new_user()
returns trigger as $$
begin
  -- insert a new profile with default values for the new user
  -- only user_id is set; all other fields use their default values
  insert into public.profiles (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- add comment to document the function's purpose
comment on function create_profile_for_new_user() is 'Trigger function to automatically create a profile when a new user registers';

-- create trigger on auth.users table
-- fires after a new user is inserted (registration)
-- automatically creates a corresponding profile record
create trigger on_user_created
  after insert on auth.users
  for each row
  execute function create_profile_for_new_user();

-- add comment to document the trigger's purpose
comment on trigger on_user_created on auth.users is 'Automatically creates a profile for newly registered users';


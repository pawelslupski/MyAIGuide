-- migration: create update_updated_at_column function
-- purpose: create a reusable trigger function to automatically update the updated_at column
-- affected: profiles, trips tables will use this function
-- considerations: this function must be created before any tables that use it

-- create function to update updated_at column on row updates
-- this function will be used by triggers on profiles and trips tables
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- add comment to document the function's purpose
comment on function update_updated_at_column() is 'Trigger function to automatically set updated_at to current timestamp on row updates';


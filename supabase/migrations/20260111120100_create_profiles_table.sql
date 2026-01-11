-- migration: create profiles table
-- purpose: store global user preferences and flags (1:1 with auth.users)
-- affected tables: profiles (new table)
-- dependencies: auth.users (managed by supabase auth)
-- considerations: 
--   - uses bigserial for primary key (better performance than uuid for app-scoped entities)
--   - user_id references auth.users(id) with cascade delete
--   - varchar + check constraints instead of enums for easier future modifications
--   - default_what is an array to support multi-choice preferences

-- create profiles table
create table profiles (
  id bigserial primary key,
  user_id uuid unique not null references auth.users(id) on delete cascade,
  has_kids boolean not null default false,
  has_pets boolean not null default false,
  has_mobility_issues boolean not null default false,
  has_dietary_preferences boolean not null default false,
  default_what varchar(50)[] default '{}',
  default_speed varchar(20),
  default_type varchar(20),
  default_budget varchar(20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- check constraint for default_what array values
  constraint profiles_default_what_check 
    check (default_what <@ array['nature', 'culture_museums', 'beach_relax', 'city_break', 'foodie']::varchar[]),
  
  -- check constraint for default_speed values
  constraint profiles_default_speed_check 
    check (default_speed in ('slow_chill', 'balance', 'intensive')),
  
  -- check constraint for default_type values
  constraint profiles_default_type_check 
    check (default_type in ('base', 'roadtrip')),
  
  -- check constraint for default_budget values
  constraint profiles_default_budget_check 
    check (default_budget in ('budget', 'moderate', 'luxury'))
);

-- create unique index on user_id for 1:1 relationship enforcement and fast lookups
create unique index idx_profiles_user_id on profiles (user_id);

-- create trigger to automatically update updated_at on row updates
create trigger update_profiles_updated_at
  before update on profiles
  for each row
  execute function update_updated_at_column();

-- add table comment for documentation
comment on table profiles is 'User profiles storing global preferences and flags (1:1 with auth.users)';
comment on column profiles.user_id is 'Foreign key to auth.users, enforces 1:1 relationship';
comment on column profiles.default_what is 'Multi-choice array of trip preferences: nature, culture_museums, beach_relax, city_break, foodie';
comment on column profiles.default_speed is 'Default trip speed preference: slow_chill, balance, intensive';
comment on column profiles.default_type is 'Default trip type: base (base camp), roadtrip';
comment on column profiles.default_budget is 'Default budget level: budget, moderate, luxury';

-- enable row level security
-- rls ensures users can only access their own profile data
alter table profiles enable row level security;

-- rls policy: users can view only their own profile
-- rationale: strict per-user data isolation
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = user_id);

-- rls policy: users can insert only their own profile
-- rationale: prevent users from creating profiles for other users
create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = user_id);

-- rls policy: users can update only their own profile
-- rationale: prevent unauthorized modifications to other users' profiles
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- rls policy: users can delete only their own profile
-- rationale: prevent unauthorized deletion of other users' profiles
-- note: cascade delete from auth.users will handle cleanup on account deletion
create policy "Users can delete own profile"
  on profiles for delete
  using (auth.uid() = user_id);


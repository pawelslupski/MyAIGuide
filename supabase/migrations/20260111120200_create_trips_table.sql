-- migration: create trips table
-- purpose: store trips, notes, per-trip preferences, and confirmed plans
-- affected tables: trips (new table)
-- dependencies: auth.users (managed by supabase auth)
-- considerations:
--   - uses bigserial for primary key
--   - note_body is optional (nullable, no minimum length); max 10000 chars
--   - trip status is implicit: derived from note_body and plan_json presence
--   - plan_json stores confirmed plan as jsonb (flexible schema, write-optimized)
--   - preference fields override global defaults from profiles table

-- create trips table
create table trips (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title varchar(255) not null,
  num_days smallint,
  num_people smallint,
  what varchar(50)[] default '{}',
  speed varchar(20),
  type varchar(20),
  budget varchar(20),
  note_body text,
  plan_language varchar(10),
  plan_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- check constraint for note_body max length (no minimum — note is optional)
  constraint trips_note_body_length_check
    check (note_body is null or char_length(note_body) <= 10000),

  -- check constraint for num_days range
  constraint trips_num_days_check
    check (num_days is null or (num_days between 1 and 30)),

  -- check constraint for num_people range
  constraint trips_num_people_check
    check (num_people is null or (num_people between 1 and 20)),

  -- check constraint for what array values
  constraint trips_what_check
    check (what <@ array['nature', 'culture_museums', 'beach_relax', 'city_break', 'foodie']::varchar[]),

  -- check constraint for speed values
  constraint trips_speed_check
    check (speed in ('slow_chill', 'balance', 'intensive')),

  -- check constraint for type values
  constraint trips_type_check
    check (type in ('base', 'base_with_trips', 'roadtrip')),

  -- check constraint for budget values
  constraint trips_budget_check
    check (budget in ('budget', 'moderate', 'luxury'))
);

-- create index for dashboard: list trips per user sorted by last modification
-- composite index on user_id and updated_at for efficient filtering and sorting
create index idx_trips_user_updated on trips (user_id, updated_at desc);

-- create trigger to automatically update updated_at on row updates
create trigger update_trips_updated_at
  before update on trips
  for each row
  execute function update_updated_at_column();

-- add table and column comments for documentation
comment on table trips is 'User trips with notes, preferences, and confirmed plans';
comment on column trips.num_days is 'Planned trip duration in days (1–30); null if not specified';
comment on column trips.num_people is 'Number of travelers (1–20); null if not specified';
comment on column trips.note_body is 'Trip note: optional free-form text, max 10000 characters';
comment on column trips.what is 'Per-trip preferences (overrides profile defaults): nature, culture_museums, beach_relax, city_break, foodie';
comment on column trips.speed is 'Per-trip speed (overrides profile default): slow_chill, balance, intensive';
comment on column trips.type is 'Per-trip type (overrides profile default): base, base_with_trips, roadtrip';
comment on column trips.budget is 'Per-trip budget (overrides profile default): budget, moderate, luxury';
comment on column trips.plan_json is 'Confirmed plan stored as jsonb (null if no plan saved)';
comment on column trips.plan_language is 'Language code of the saved plan (e.g., pl, en)';

-- enable row level security
-- rls ensures users can only access their own trips
alter table trips enable row level security;

-- rls policy: users can view only their own trips
create policy "Users can view own trips"
  on trips for select
  using (auth.uid() = user_id);

-- rls policy: users can insert only their own trips
create policy "Users can insert own trips"
  on trips for insert
  with check (auth.uid() = user_id);

-- rls policy: users can update only their own trips
create policy "Users can update own trips"
  on trips for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- rls policy: users can delete only their own trips
create policy "Users can delete own trips"
  on trips for delete
  using (auth.uid() = user_id);

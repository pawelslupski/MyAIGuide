-- migration: create plan_generations table
-- purpose: track ai plan generation attempts for rate limiting and diagnostics
-- affected tables: plan_generations (new table)
-- dependencies: auth.users, trips
-- considerations:
--   - append-only table (no update policy in rls)
--   - records only ai-invoking attempts (success or api errors)
--   - client-side validation failures are not recorded
--   - used for rate limiting: 10 generations per user per rolling 24h window
--   - designed for potential future partitioning by created_at

-- create plan_generations table
create table plan_generations (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id bigint not null references trips(id) on delete cascade,
  status varchar(20) not null,
  model_name varchar(100),
  error_message text,
  created_at timestamptz not null default now(),
  
  -- check constraint for status values
  -- only success, api_error, and validation_error are allowed
  constraint plan_generations_status_check 
    check (status in ('success', 'api_error', 'validation_error'))
);

-- create index for rate limiting: count generations per user in rolling 24h window
-- composite index on user_id and created_at for efficient filtering and counting
create index idx_plan_generations_user_created on plan_generations (user_id, created_at desc);

-- create index for trip-specific generation history
-- useful for future analytics and debugging
create index idx_plan_generations_trip on plan_generations (trip_id, created_at desc);

-- add table and column comments for documentation
comment on table plan_generations is 'AI plan generation attempts for rate limiting and diagnostics (append-only)';
comment on column plan_generations.status is 'Generation outcome: success, api_error, validation_error';
comment on column plan_generations.model_name is 'AI model used for generation (e.g., gpt-4, claude-3); NULL for validation_error when AI was not invoked';
comment on column plan_generations.error_message is 'Error details for failed generations (null for success)';

-- enable row level security
-- rls ensures users can only access their own generation records
alter table plan_generations enable row level security;

-- rls policy: users can view only their own generation records
-- rationale: strict per-user data isolation for diagnostics and rate limiting
create policy "Users can view own generations"
  on plan_generations for select
  using (auth.uid() = user_id);

-- rls policy: users can insert only their own generation records
-- rationale: prevent users from creating generation records for other users
create policy "Users can insert own generations"
  on plan_generations for insert
  with check (auth.uid() = user_id);

-- note: no update policy - this is an append-only table
-- generation records should never be modified after creation

-- rls policy: users can delete only their own generation records
-- rationale: allow cleanup via trip cascade deletion
-- note: direct deletion is rare; most deletions happen via cascade from trips
create policy "Users can delete own generations"
  on plan_generations for delete
  using (auth.uid() = user_id);


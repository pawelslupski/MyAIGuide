-- =============================================================================
-- Migration: quota_reservation_and_realtime
-- Purpose:
--   1. Add 'pending' status to plan_generations for atomic quota reservation.
--   2. Create try_reserve_generation_slot() — acquires a per-user advisory lock,
--      replicates the fixed-batch quota logic, and inserts a 'pending' record if
--      the user is within their limit. Raises P0429 (QUOTA_EXCEEDED) otherwise.
--   3. Create finalize_generation_slot() — updates a 'pending' record to its
--      final status (success / api_error / validation_error) after the AI call.
--   4. Enable Realtime on the trips table so all open browser tabs receive
--      row-level UPDATE events and stay in sync.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend status constraint to include 'pending'
--    The original inline CHECK was auto-named plan_generations_status_check.
-- ---------------------------------------------------------------------------
ALTER TABLE public.plan_generations
  DROP CONSTRAINT plan_generations_status_check;

ALTER TABLE public.plan_generations
  ADD CONSTRAINT plan_generations_status_check
  CHECK (status IN ('success', 'api_error', 'validation_error', 'pending'));

-- ---------------------------------------------------------------------------
-- 2. try_reserve_generation_slot
--
--    Atomically checks the caller's quota and, if within the limit, inserts a
--    'pending' record and returns its id (the reservation_id).
--
--    Concurrency safety:
--      pg_advisory_xact_lock serialises all calls for the same user_id.
--      The lock is held for the lifetime of the calling transaction (a single
--      RPC round-trip), so two simultaneous requests from the same account
--      will execute sequentially rather than both seeing the same quota count.
--
--    Stale-pending handling:
--      'pending' records older than 90 s are considered stale (the Edge
--      Function timeout is 60 s) and are excluded from the quota count so a
--      crashed generation does not permanently consume a slot.
--
--    Returns: BIGINT — the id of the newly inserted pending record.
--    Raises:  P0429  — QUOTA_EXCEEDED when the user is at their limit.
--             P0401  — UNAUTHORIZED when called without an active session.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.try_reserve_generation_slot(p_trip_id BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id        UUID      := auth.uid();
  v_quota_limit    CONSTANT INT      := 10;
  v_window_ms      CONSTANT BIGINT   := 86400000;            -- 24 h in ms
  v_stale_cutoff   CONSTANT INTERVAL := INTERVAL '90 seconds';
  v_now            TIMESTAMPTZ       := now();
  v_rows           TIMESTAMPTZ[];
  v_quota_used     INT;
  v_oldest         TIMESTAMPTZ;
  v_cooldown_end   TIMESTAMPTZ;
  v_batch_start    TIMESTAMPTZ;
  v_reservation_id BIGINT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'P0401';
  END IF;

  -- Serialise concurrent requests for the same user.
  -- Lock is scoped to this transaction and released automatically on commit/rollback.
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text)::bigint);

  -- Collect the most recent QUOTA_LIMIT quota-consuming rows (newest first).
  -- Active 'pending' records (< 90 s old) count as reserved slots.
  SELECT ARRAY_AGG(created_at ORDER BY created_at DESC)
  INTO   v_rows
  FROM (
    SELECT created_at
    FROM   public.plan_generations
    WHERE  user_id = v_user_id
      AND  (
             status IN ('success', 'api_error')
             OR (status = 'pending' AND created_at > v_now - v_stale_cutoff)
           )
    ORDER BY created_at DESC
    LIMIT  v_quota_limit
  ) sub;

  v_quota_used := COALESCE(array_length(v_rows, 1), 0);

  IF v_quota_used >= v_quota_limit THEN
    -- The oldest row in the fetched batch marks the start of the cooldown.
    v_oldest       := v_rows[v_quota_limit];
    v_cooldown_end := v_oldest + (v_window_ms || ' milliseconds')::INTERVAL;

    IF v_now < v_cooldown_end THEN
      -- Still within the cooldown window — block.
      RAISE EXCEPTION 'QUOTA_EXCEEDED' USING ERRCODE = 'P0429';
    END IF;

    -- Cooldown has expired — count only rows created after it ended.
    v_batch_start := v_cooldown_end;
    SELECT COUNT(*)::INT
    INTO   v_quota_used
    FROM   public.plan_generations
    WHERE  user_id = v_user_id
      AND  (
             status IN ('success', 'api_error')
             OR (status = 'pending' AND created_at > v_now - v_stale_cutoff)
           )
      AND  created_at >= v_batch_start;

    IF v_quota_used >= v_quota_limit THEN
      RAISE EXCEPTION 'QUOTA_EXCEEDED' USING ERRCODE = 'P0429';
    END IF;
  END IF;

  -- Quota OK — reserve the slot by inserting a pending record.
  INSERT INTO public.plan_generations (user_id, trip_id, status)
  VALUES (v_user_id, p_trip_id, 'pending')
  RETURNING id INTO v_reservation_id;

  RETURN v_reservation_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. finalize_generation_slot
--
--    Updates a 'pending' record to its final status once the AI call completes.
--    Only the owning user can finalize their own pending records (enforced via
--    auth.uid() inside the SECURITY DEFINER function).
--
--    If the record is not found (already finalized or reservation_id wrong),
--    a WARNING is emitted but no error is raised so callers are not interrupted.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_generation_slot(
  p_reservation_id BIGINT,
  p_status         VARCHAR(20),
  p_model_name     VARCHAR(100) DEFAULT NULL,
  p_error_message  TEXT         DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'P0401';
  END IF;

  IF p_status NOT IN ('success', 'api_error', 'validation_error') THEN
    RAISE EXCEPTION 'INVALID_STATUS: must be success, api_error, or validation_error'
      USING ERRCODE = 'P0400';
  END IF;

  UPDATE public.plan_generations
  SET    status        = p_status,
         model_name    = p_model_name,
         error_message = p_error_message
  WHERE  id      = p_reservation_id
    AND  user_id = v_user_id
    AND  status  = 'pending';

  IF NOT FOUND THEN
    RAISE WARNING
      'finalize_generation_slot: reservation % not found or already finalized (user=%)',
      p_reservation_id, v_user_id;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Enable Realtime on trips
--    REPLICA IDENTITY FULL guarantees the complete row is included in UPDATE
--    payloads so clients can reconstruct the TripDTO without an extra round-trip.
-- ---------------------------------------------------------------------------
ALTER TABLE public.trips REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;

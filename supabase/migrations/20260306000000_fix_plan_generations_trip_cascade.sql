-- =============================================================================
-- Migration: fix_plan_generations_trip_cascade
-- Purpose:   Prevent quota bypass via trip deletion.
--            Previously, deleting a trip cascaded to plan_generations, removing
--            generation records and allowing the user to generate more than the
--            allowed 10 plans per 24-hour window.
--            Fix: drop the foreign key constraint entirely so plan_generations
--            rows are completely unaffected by trip deletion. trip_id is kept
--            as a plain bigint for diagnostic/history purposes.
-- Affected tables: public.plan_generations
-- =============================================================================

-- Drop the foreign key — plan_generations rows now survive trip deletion intact.
alter table public.plan_generations
  drop constraint plan_generations_trip_id_fkey;

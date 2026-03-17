-- Migration: relax num_days and num_people constraints
-- Previously: smallint with CHECK between 1 and 30 / 1 and 20
-- Now: integer with only a minimum of 1 (no upper bound)
-- Upper-bound validation is handled exclusively in UI (generate button blocked, error shown under input)

ALTER TABLE trips
  ALTER COLUMN num_days   TYPE integer,
  ALTER COLUMN num_people TYPE integer;

ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_num_days_check;
ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_num_people_check;

ALTER TABLE trips
  ADD CONSTRAINT trips_num_days_min   CHECK (num_days   IS NULL OR num_days   >= 1),
  ADD CONSTRAINT trips_num_people_min CHECK (num_people IS NULL OR num_people >= 1);

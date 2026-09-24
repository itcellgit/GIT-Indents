-- Allow a single bus booking to hold more than one bus and more than one driver.
-- The existing scalar bus_id / driver_id columns are kept in sync (first element
-- of the array) so any code/reporting that still reads them keeps working.
ALTER TABLE public.bus_bookings
  ADD COLUMN IF NOT EXISTS bus_ids BIGINT[] NOT NULL DEFAULT ARRAY[]::BIGINT[];

ALTER TABLE public.bus_bookings
  ADD COLUMN IF NOT EXISTS driver_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill existing rows from their single bus_id / driver_id
UPDATE public.bus_bookings
  SET bus_ids = ARRAY[bus_id]
  WHERE bus_id IS NOT NULL AND cardinality(bus_ids) = 0;

UPDATE public.bus_bookings
  SET driver_ids = ARRAY[driver_id]
  WHERE driver_id IS NOT NULL AND cardinality(driver_ids) = 0;

CREATE INDEX IF NOT EXISTS idx_bus_bookings_bus_ids ON public.bus_bookings USING GIN (bus_ids);
CREATE INDEX IF NOT EXISTS idx_bus_bookings_driver_ids ON public.bus_bookings USING GIN (driver_ids);

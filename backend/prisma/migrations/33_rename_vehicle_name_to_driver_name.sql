-- The "Vehicle List" master record tracked a free-text vehicle model/name
-- (e.g. "Toyota Innova"). Each vehicle in this fleet has one regularly
-- assigned driver, so that field is repurposed to hold the driver's name
-- instead, and a phone number column is added alongside it.
-- NOTE: existing rows keep their old vehicle-model text in what is now the
-- driver_name column until an admin edits each vehicle to enter the actual
-- driver's name — this migration does not attempt to guess/convert that data.
ALTER TABLE public.vehicles RENAME COLUMN vehicle_name TO driver_name;

ALTER TABLE public.vehicles
    ADD COLUMN IF NOT EXISTS driver_phone_no VARCHAR(20);

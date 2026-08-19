ALTER TABLE public.vehicles
    DROP COLUMN IF EXISTS driver_name,
    DROP COLUMN IF EXISTS driver_phone_number;

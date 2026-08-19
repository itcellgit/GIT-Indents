
ALTER TABLE public.vehicles
    ADD COLUMN IF NOT EXISTS driver_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS driver_phone_number VARCHAR(20);

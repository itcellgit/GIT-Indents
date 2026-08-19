ALTER TABLE public.bus_bookings
    ADD COLUMN IF NOT EXISTS attachment_path TEXT;

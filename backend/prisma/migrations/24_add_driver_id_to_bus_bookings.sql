ALTER TABLE public.bus_bookings
    ADD COLUMN IF NOT EXISTS driver_id TEXT;

ALTER TABLE public.bus_bookings
    ADD CONSTRAINT fk_bus_booking_driver FOREIGN KEY (driver_id) REFERENCES "Driver"(id) ON DELETE SET NULL;

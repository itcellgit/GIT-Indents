ALTER TABLE public.vehicle_bookings
    ADD COLUMN IF NOT EXISTS driver_id TEXT;

ALTER TABLE public.vehicle_bookings
    ADD CONSTRAINT fk_vehicle_booking_driver FOREIGN KEY (driver_id) REFERENCES "Driver"(id) ON DELETE SET NULL;

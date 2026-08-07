ALTER TABLE hall_bookings
ADD COLUMN IF NOT EXISTS booked_by_email VARCHAR(255);
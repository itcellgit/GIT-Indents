-- Add status column to hall_bookings for approve/reject workflow
ALTER TABLE hall_bookings
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PENDING';

-- Backfill any existing rows that have NULL status
UPDATE hall_bookings SET status = 'PENDING' WHERE status IS NULL;

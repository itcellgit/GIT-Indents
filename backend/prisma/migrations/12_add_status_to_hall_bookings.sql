-- Add status column to hall_bookings for approve/reject workflow
-- Possible values: PENDING, APPROVED, REJECTED, CANCELLED
-- PENDING = newly created, awaiting review (no email notification)
-- APPROVED = approved by receptionist (email notification sent)
-- REJECTED = rejected by receptionist (email notification sent)
-- CANCELLED = cancelled by the booker themselves (email notification sent)
ALTER TABLE hall_bookings
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PENDING';

-- Backfill any existing rows that have NULL status
UPDATE hall_bookings SET status = 'PENDING' WHERE status IS NULL;

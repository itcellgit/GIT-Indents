-- Set when an Admin resets a user's password to a generated temporary one
-- (POST /api/admin/users/:id/reset-password). While true, `protect` only lets
-- the user reach /auth/me and /auth/change-password, and the frontend shows a
-- forced "set a new password" screen; changing the password clears it.
-- Existing users default to false, so nobody is affected until a reset happens.

ALTER TABLE public."User"
    ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

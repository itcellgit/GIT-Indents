-- Persist pending registrations (previously an in-memory Map, lost on restart)
-- and OTP/reset-password attempt-lockout state (previously in-memory too).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetPasswordAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetPasswordLockedUntil" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "PendingRegistration" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "department" TEXT,
    "role" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "otpAttempts" INTEGER NOT NULL DEFAULT 0,
    "otpLockedUntil" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingRegistration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PendingRegistration_email_key" ON "PendingRegistration"("email");

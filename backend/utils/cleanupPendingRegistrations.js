const prisma = require('../prismaClient');

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // hourly

// Removes abandoned signups (OTP expired, user never verified) so the table
// doesn't grow unbounded. Safe to run repeatedly/concurrently — it's just a
// delete on an already-expired condition.
const cleanupExpiredPendingRegistrations = async () => {
  try {
    const { count } = await prisma.pendingRegistration.deleteMany({
      where: { expiresAt: { lt: new Date() } }
    });
    if (count > 0) {
      console.log(`Cleaned up ${count} expired pending registration(s).`);
    }
  } catch (err) {
    console.error('Failed to clean up expired pending registrations:', err.message);
  }
};

const startPendingRegistrationCleanup = () => {
  cleanupExpiredPendingRegistrations();
  setInterval(cleanupExpiredPendingRegistrations, CLEANUP_INTERVAL_MS);
};

module.exports = { startPendingRegistrationCleanup };

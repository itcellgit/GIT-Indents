const prisma = require('../prismaClient');

// The transport booking forms populate their driver dropdown from GET /drivers,
// which returns the underlying User id as `id`. The bookings tables, however,
// carry a FK to "Driver"(id) (a separate uuid). So an incoming driver value may
// be either the Driver.id or the User.id - resolve it to the real Driver.id
// before writing, and reject anything that matches neither.
//
// Returns:
//   { ok: true, driverId: <Driver.id> | null }  - null means "no driver selected"
//   { ok: false, message }                       - a value was supplied but is not a valid driver
const resolveDriverId = async (rawValue) => {
  const value = rawValue === undefined || rawValue === null ? '' : String(rawValue).trim();
  if (!value) {
    return { ok: true, driverId: null };
  }

  const rows = await prisma.$queryRawUnsafe(
    `SELECT id FROM "Driver" WHERE id = $1 OR "userId" = $1 LIMIT 1`,
    value
  );

  if (!rows.length) {
    return { ok: false, message: 'Selected driver is not valid' };
  }

  return { ok: true, driverId: rows[0].id };
};

module.exports = { resolveDriverId };

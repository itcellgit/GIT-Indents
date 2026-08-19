const prisma = require('../prismaClient');

const mapDriverRow = (row) => ({
  id: row.id,
  userId: row.userId,
  name: row.name || '',
  email: row.email || '',
  staff_phone_no: row.staff_phone_no || '',
  department: row.department || '',
});

const getDrivers = async (req, res) => {
  try {
    const drivers = await prisma.$queryRawUnsafe(
      `SELECT d.id, d."userId", u.name, u.email, u.staff_phone_no, u.department
       FROM "Driver" d
       INNER JOIN "User" u ON u.id = d."userId"
       ORDER BY u.name ASC`
    );

    res.json({ success: true, drivers: drivers.map(mapDriverRow) });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getDrivers,
};

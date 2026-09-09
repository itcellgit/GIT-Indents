const prisma = require('../prismaClient');

const mapDriverRow = (row) => ({
  id: row.id,
  driverId: row.driverId || null,
  name: row.name || '',
  email: row.email || '',
  staff_phone_no: row.staff_phone_no || '',
  department: row.department || '',
  roles: Array.isArray(row.roles) ? row.roles : [],
  isDriver: Boolean(row.isDriver),
});

const getDrivers = async (req, res) => {
  try {
    const drivers = await prisma.$queryRawUnsafe(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.staff_phone_no,
         u.department,
         COALESCE(
           json_agg(
             json_build_object(
               'roleId', ur.role_id,
               'roleName', r.role_name
             ) ORDER BY r.id
           ) FILTER (WHERE r.role_name IS NOT NULL),
           '[]'::json
         ) AS roles,
         EXISTS (
           SELECT 1
           FROM "Driver" d
           WHERE d."userId" = u.id
         ) AS "isDriver",
         (
           SELECT d.id
           FROM "Driver" d
           WHERE d."userId" = u.id
           LIMIT 1
         ) AS "driverId"
       FROM "User" u
       LEFT JOIN public.user_roles ur ON ur.user_id = u.id
       LEFT JOIN public.roles r ON r.id = ur.role_id
       WHERE LOWER(COALESCE(u.department, '')) = LOWER($1)
       GROUP BY u.id, u.name, u.email, u.staff_phone_no, u.department
       ORDER BY u.name ASC`,
      'Vehicle Maintenance'
    );

    res.json({ success: true, drivers: drivers.map(mapDriverRow) });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const toggleDriverAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { isDriver } = req.body;
    const shouldAssign = Boolean(isDriver);

    const userRows = await prisma.$queryRawUnsafe(
      `SELECT id, department FROM "User" WHERE id = $1 LIMIT 1`,
      id
    );
    const user = userRows[0];

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (String(user.department || '').toLowerCase() !== 'vehicle maintenance') {
      return res.status(400).json({ message: 'Only Vehicle Maintenance users can be assigned as drivers' });
    }

    const existingDriver = await prisma.driver.findUnique({ where: { userId: id } });

    if (shouldAssign && !existingDriver) {
      await prisma.driver.create({ data: { userId: id } });
    } else if (!shouldAssign && existingDriver) {
      await prisma.driver.delete({ where: { userId: id } });
    }

    res.json({
      success: true,
      message: shouldAssign ? 'Driver assigned successfully' : 'Driver unassigned successfully',
      isDriver: shouldAssign,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getDrivers,
  toggleDriverAssignment,
};

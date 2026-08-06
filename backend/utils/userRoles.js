// backend/utils/userRoles.js
// Shared helpers for reading/writing a user's role via the user_roles/roles tables
// (the users table no longer has a `role` column).

const getRoleIdByName = async (prismaClient, roleName) => {
  const rows = await prismaClient.$queryRawUnsafe(
    `SELECT id
     FROM public.roles
     WHERE role_name = $1
     LIMIT 1`,
    roleName
  );

  return rows[0]?.id || null;
};

const getPrimaryRoleByUserId = async (prismaClient, userId) => {
  const rows = await prismaClient.$queryRawUnsafe(
    `SELECT r.role_name
     FROM public.user_roles ur
     INNER JOIN public.roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1
     ORDER BY r.id ASC
     LIMIT 1`,
    userId
  );

  return rows[0]?.role_name || null;
};

// Replaces all of a user's roles with a single role.
const setUserRole = async (tx, userId, roleName) => {
  const roleId = await getRoleIdByName(tx, roleName);
  if (!roleId) {
    return null;
  }

  await tx.$executeRawUnsafe(
    `DELETE FROM public.user_roles WHERE user_id = $1`,
    userId
  );

  await tx.$executeRawUnsafe(
    `INSERT INTO public.user_roles (user_id, role_id) VALUES ($1, $2)`,
    userId,
    roleId
  );

  return roleId;
};

module.exports = { getRoleIdByName, getPrimaryRoleByUserId, setUserRole };

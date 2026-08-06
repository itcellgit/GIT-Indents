require('dotenv').config();
const prisma = require('./prismaClient');
const { normalizeRole } = require('./utils/roles');

async function main() {
  console.log("Starting role normalization process...");
  const [roleColumnRows, roleRows] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'User'
         AND column_name = 'role'
       LIMIT 1`
    ),
    prisma.$queryRawUnsafe(
      `SELECT id, role_name
       FROM public.roles`
    )
  ]);

  const roleIdByName = new Map(
    roleRows.map((role) => [String(role.role_name).trim(), role.id])
  );

  const resolveRoleId = (roleName) => {
    const normalizedRole = normalizeRole(roleName);
    return roleIdByName.get(normalizedRole) || null;
  };

  let updatedCount = 0;

  if (roleColumnRows.length) {
    const users = await prisma.$queryRawUnsafe(
      `SELECT id, email, role
       FROM "User"`
    );

    for (const user of users) {
      const roleId = resolveRoleId(user.role);
      if (!roleId) {
        console.log(`Skipping ${user.email}: unknown role ${user.role}`);
        continue;
      }

      const existingRoleRows = await prisma.$queryRawUnsafe(
        `SELECT role_id
         FROM public.user_roles
         WHERE user_id = $1
         ORDER BY role_id ASC`,
        user.id
      );

      const alreadyMapped = existingRoleRows.some((row) => String(row.role_id) === String(roleId));
      if (alreadyMapped) {
        continue;
      }

      if (existingRoleRows.length === 0) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO public.user_roles (user_id, role_id)
           VALUES ($1, $2)`,
          user.id,
          roleId
        );
      } else {
        await prisma.$executeRawUnsafe(
          `UPDATE public.user_roles
           SET role_id = $2
           WHERE user_id = $1`,
          user.id,
          roleId
        );
      }

      console.log(`Normalized ${user.email}: ${user.role} -> role_id ${roleId}`);
      updatedCount++;
    }
  } else {
    const userRoles = await prisma.$queryRawUnsafe(
      `SELECT ur.user_id, ur.role_id, r.role_name
       FROM public.user_roles ur
       INNER JOIN public.roles r ON r.id = ur.role_id`
    );

    for (const assignment of userRoles) {
      const normalizedRole = normalizeRole(assignment.role_name);
      const roleId = roleIdByName.get(normalizedRole);

      if (!roleId || String(roleId) === String(assignment.role_id)) {
        continue;
      }

      await prisma.$executeRawUnsafe(
        `UPDATE public.user_roles
         SET role_id = $2
         WHERE user_id = $1 AND role_id = $3`,
        assignment.user_id,
        roleId,
        assignment.role_id
      );

      console.log(`Normalized user ${assignment.user_id}: ${assignment.role_name} -> ${normalizedRole}`);
      updatedCount++;
    }
  }

  console.log(`Role normalization complete. Updated ${updatedCount} assignments.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

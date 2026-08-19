// backend/controllers/adminController.js
const prisma = require('../prismaClient');
const bcrypt = require('bcryptjs');
const { departments: departmentList } = require('../utils/departments');
const { ROLES, ROLE_VALUES, normalizeRole } = require('../utils/roles');
const { PASSWORD_POLICY_MESSAGE, isPasswordValid } = require('../utils/passwordPolicy');
const { sendNotification } = require('../utils/notificationService');

const resolveDepartmentName = (value) => {
  if (!value) return null;

  const normalized = String(value).trim().toLowerCase();
  const match = departmentList.find((department) =>
    department.name.toLowerCase() === normalized ||
    department.shortName.toLowerCase() === normalized
  );

  return match ? match.name : String(value).trim();
};

const resolveDepartmentValue = (value) => {
  if (!value) return null;

  const departmentName = resolveDepartmentName(value);
  return departmentName || String(value).trim();
};

const normalizeRoleList = (roles) => {
  const inputRoles = Array.isArray(roles) ? roles : roles ? [roles] : [];
  const normalizedRoles = inputRoles
    .map((role) => String(role).trim())
    .filter((role, index, array) => role && array.indexOf(role) === index);

  return normalizedRoles;
};

const getRoleRows = async () => {
  return prisma.$queryRawUnsafe('SELECT id, role_name FROM public.roles');
};

const getRoleIdsByName = async (roleNames) => {
  const roleRows = await getRoleRows();
  const roleMap = new Map(roleRows.map((role) => [String(role.role_name).trim(), role.id]));

  return roleNames
    .map((roleName) => ({ roleName, roleId: roleMap.get(roleName) }))
    .filter(({ roleId }) => roleId !== undefined && roleId !== null);
};

// Roles are admin-extensible (see createRole/updateRole below), so this checks
// against the live roles table rather than the fixed ROLES constant. Without this,
// an unrecognized role name silently passes normalizeRoleList (which only trims/dedupes)
// and then gets silently dropped by syncUserRoles's DB lookup — the API would report
// success with the requested role while the user is actually persisted with no role
// assigned at all.
const getInvalidRoleNames = async (roleNames) => {
  const resolved = await getRoleIdsByName(roleNames);
  const resolvedNames = new Set(resolved.map((r) => r.roleName));
  return roleNames.filter((name) => !resolvedNames.has(name));
};

const getRoleNamesByIds = async (roleIds) => {
  const inputRoleIds = Array.isArray(roleIds) ? roleIds : roleIds ? [roleIds] : [];
  if (inputRoleIds.length === 0) {
    return [];
  }

  const roleRows = await getRoleRows();
  const roleMap = new Map(roleRows.map((role) => [String(role.id), String(role.role_name).trim()]));

  return inputRoleIds
    .map((roleId) => roleMap.get(String(roleId)))
    .filter(Boolean);
};

const getPrimaryRoleFromRoleIds = async (roleIds) => {
  const selectedRoleNames = await getRoleNamesByIds(roleIds);
  return selectedRoleNames[0] || ROLES.FACULTY;
};

const getFacilityProviderRoleId = async () => {
  const role = await prisma.$queryRawUnsafe(
    `SELECT id FROM public.roles WHERE role_name = $1 LIMIT 1`,
    ROLES.FACILITY_PROVIDER
  );

  return role[0]?.id || null;
};

const getUserRolesByUserId = async (userId) => {
  const roleRows = await prisma.$queryRawUnsafe(
    `SELECT ur.role_id, r.role_name
     FROM public.user_roles ur
     INNER JOIN public.roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1
     ORDER BY r.id ASC`,
    userId
  );

  return roleRows.map((role) => ({
    roleId: role.role_id,
    roleName: role.role_name
  }));
};

// Category-incharge assignment replaces a user's entire role set with Facility
// Provider (behavior intentionally left as-is — see TECHNICAL_AUDIT_REPORT.md 3.1).
// This just makes that change visible: logged server-side with who/whom/before-after,
// and the affected user gets an in-app notification so it's no longer silent.
const logAndNotifyRoleReplacement = async ({ adminUser, targetUser, previousRoles, newRoleName }) => {
  const previousRoleNames = previousRoles.map((role) => role.roleName);
  console.warn(
    `[ROLE CHANGE] Admin ${adminUser?.email || adminUser?.id} set ${targetUser.email} (${targetUser.id}) ` +
    `as a category incharge, replacing role(s) [${previousRoleNames.join(', ') || 'none'}] with [${newRoleName}].`
  );

  try {
    await sendNotification(
      targetUser.id,
      `An administrator assigned you as a maintenance department incharge. Your access role has been changed to "${newRoleName}"` +
      (previousRoleNames.length ? ` (previously: ${previousRoleNames.join(', ')}).` : '.'),
      adminUser?.id || null
    );
  } catch (notifyErr) {
    console.error('Failed to notify user about role change:', notifyErr.message);
  }
};

const getUserWithPrimaryRoleByEmail = async (email) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT
       u.id,
       u.name,
       u.email,
       u.department,
       COALESCE(
         (
           SELECT r.role_name
           FROM public.user_roles ur
           INNER JOIN public.roles r ON r.id = ur.role_id
           WHERE ur.user_id = u.id
           ORDER BY r.id ASC
           LIMIT 1
         ),
         '${ROLES.FACULTY}'
       ) AS role
     FROM "User" u
     WHERE LOWER(u.email) = LOWER($1)
     LIMIT 1`,
    email
  );

  return rows[0] || null;
};

const getUsersByEmailAndRoles = async (email) => {
  return prisma.$queryRawUnsafe(
    `SELECT
       u.id,
       u.name,
       u.email,
       COALESCE(
         (
           SELECT r.role_name
           FROM public.user_roles ur
           INNER JOIN public.roles r ON r.id = ur.role_id
           WHERE ur.user_id = u.id
           ORDER BY r.id ASC
           LIMIT 1
         ),
         '${ROLES.FACULTY}'
       ) AS role
     FROM "User" u
     WHERE LOWER(u.email) LIKE LOWER($1)
       AND EXISTS (
         SELECT 1
         FROM public.user_roles ur
         INNER JOIN public.roles r ON r.id = ur.role_id
         WHERE ur.user_id = u.id
           AND r.role_name IN ('${ROLES.FACULTY}', '${ROLES.HOD}', '${ROLES.NON_TEACHING}', '${ROLES.FACILITY_PROVIDER}')
       )
     ORDER BY u.name ASC`,
    `%${email}%`
  );
};

// @desc    Get system-wide statistics for the admin dashboard
// @route   GET /api/admin/stats
// @access  Private/Admin
const getSystemStats = async (req, res) => {
  try {
    const totalDepartments = await prisma.category.count();
    const totalUsers = await prisma.user.count();
    
    // Active: Not Completed and not Rejected
    const activeComplaints = await prisma.indent.count({ 
      where: { 
        status: { 
          notIn: ['Completed', 'Rejected by Dept HOD', 'Rejected by Maintenance HOD', 'Rejected by Principal'] 
        } 
      }
    });
    
    // Resolved: Completed
    const resolvedComplaints = await prisma.indent.count({ 
      where: { status: 'Completed' }
    });


    res.json({
      success: true,
      stats: {
        totalDepartments,
        totalUsers,
        activeComplaints,
        resolvedComplaints
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all users (for Admin User Management)
// @route   GET /api/admin/users
// @access  Private/Admin
const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.$queryRawUnsafe(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.department,
        u.staff_phone_no,
        u."isActive" AS "isActive",
        u."createdAt" AS "createdAt",
        EXISTS (SELECT 1 FROM "Driver" d WHERE d."userId" = u.id) AS "isDriver",
        COALESCE(
          json_agg(
            json_build_object(
              'roleId', ur.role_id,
              'roleName', r.role_name
            ) ORDER BY r.id
          ) FILTER (WHERE r.role_name IS NOT NULL),
          '[]'::json
        ) AS roles
      FROM "User" u
      LEFT JOIN public.user_roles ur ON ur.user_id = u.id
      LEFT JOIN public.roles r ON r.id = ur.role_id
      GROUP BY u.id, u.name, u.email, u.department, u.staff_phone_no, u."isActive", u."createdAt"
      ORDER BY u."createdAt" DESC
    `);

    const normalizedUsers = users.map((user) => ({
      ...user,
      roles: Array.isArray(user.roles) ? user.roles : []
    }));
    
    res.json({ 
      success: true,
      users: normalizedUsers 
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const syncUserRoles = async (tx, userId, roleNames) => {
  await tx.$executeRawUnsafe('DELETE FROM public.user_roles WHERE user_id = $1', userId);

  const selectedRoleRows = await getRoleIdsByName(roleNames);
  if (selectedRoleRows.length === 0) {
    return;
  }

  const valuesClause = selectedRoleRows.map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`).join(', ');
  const queryParams = selectedRoleRows.flatMap(({ roleId }) => [userId, roleId]);

  await tx.$executeRawUnsafe(
    `INSERT INTO public.user_roles (user_id, role_id) VALUES ${valuesClause}`,
    ...queryParams
  );
};

const mapRoleRow = (row) => ({
  id: Number(row.id),
  name: row.role_name,
  created_at: row.created_at,
  updated_at: row.Updated_at
});

// @desc    Get all roles from roles table
// @route   GET /api/admin/roles
// @access  Private/Admin
const getAllRoles = async (req, res) => {
  try {
    const roles = await prisma.$queryRawUnsafe(
      'SELECT id, role_name FROM public.roles ORDER BY id ASC'
    );

    res.json({
      success: true,
      roles: roles.map((role) => ({
        id: role.id,
        name: role.role_name
      }))
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create role
// @route   POST /api/admin/roles
// @access  Private/Admin
const createRole = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Role name is required' });
    }

    const roleName = String(name).trim();

    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.roles WHERE LOWER(role_name) = LOWER($1)`,
      roleName
    );
    if (existing && existing.length > 0) {
      return res.status(400).json({ message: 'A role with this name already exists' });
    }

    const rows = await prisma.$queryRawUnsafe(
      `INSERT INTO public.roles (role_name, created_at, "Updated_at")
       VALUES ($1, NOW(), NOW())
       RETURNING id, role_name, created_at, "Updated_at"`,
      roleName
    );

    res.status(201).json({ success: true, role: mapRoleRow(rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update role
// @route   PUT /api/admin/roles/:id
// @access  Private/Admin
const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Role name is required' });
    }

    const roleName = String(name).trim();

    const existingRole = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.roles WHERE id = $1`,
      Number(id)
    );
    if (!existingRole || existingRole.length === 0) {
      return res.status(404).json({ message: 'Role not found' });
    }

    const duplicate = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.roles WHERE LOWER(role_name) = LOWER($1) AND id != $2`,
      roleName,
      Number(id)
    );
    if (duplicate && duplicate.length > 0) {
      return res.status(400).json({ message: 'A role with this name already exists' });
    }

    const rows = await prisma.$queryRawUnsafe(
      `UPDATE public.roles
       SET role_name = $2,
           "Updated_at" = NOW()
       WHERE id = $1
       RETURNING id, role_name, created_at, "Updated_at"`,
      Number(id),
      roleName
    );

    res.json({ success: true, role: mapRoleRow(rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete role
// @route   DELETE /api/admin/roles/:id
// @access  Private/Admin
const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    const existingRole = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.roles WHERE id = $1`,
      Number(id)
    );
    if (!existingRole || existingRole.length === 0) {
      return res.status(404).json({ message: 'Role not found' });
    }

    const inUse = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.user_roles WHERE role_id = $1 LIMIT 1`,
      Number(id)
    );
    if (inUse && inUse.length > 0) {
      return res.status(400).json({ message: 'Cannot delete a role that is assigned to users' });
    }

    await prisma.$executeRawUnsafe(`DELETE FROM public.roles WHERE id = $1`, Number(id));

    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create user (by Admin)
// @route   POST /api/admin/users
// @access  Private/Admin
const createUser = async (req, res) => {
  try {
    const { name, email, password, department, role, roles, staff_phone_no, is_driver } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    if (!isPasswordValid(password)) {
      return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
    }

    const userExists = await getUserWithPrimaryRoleByEmail(email);
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    const selectedRoles = normalizeRoleList(roles || role);
    if (selectedRoles.length === 0) {
      return res.status(400).json({ message: 'At least one role is required' });
    }

    const invalidRoles = await getInvalidRoleNames(selectedRoles);
    if (invalidRoles.length > 0) {
      return res.status(400).json({ message: `Invalid role(s): ${invalidRoles.join(', ')}` });
    }

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          department: department || '',
          staff_phone_no: staff_phone_no ? String(staff_phone_no).trim() : null,
          isActive: true
        },
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          staff_phone_no: true,
          isActive: true,
          createdAt: true
        }
      });

      await syncUserRoles(tx, createdUser.id, selectedRoles);

      if ((department || '') === 'Vehicle Maintenance' && is_driver) {
        await tx.driver.create({ data: { userId: createdUser.id } });
      }

      return createdUser;
    });

    res.status(201).json({ success: true, user: { ...user, isDriver: (department || '') === 'Vehicle Maintenance' && Boolean(is_driver) }, roles: normalizeRoleList(roles || role) });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update user (by Admin)
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, department, roles, roleIds, role, password, staff_phone_no, is_driver } = req.body;

    const existingUserRows = await prisma.$queryRawUnsafe(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.department,
         u.staff_phone_no,
         u."isActive" AS "isActive",
         u."createdAt" AS "createdAt",
         COALESCE(
           (
             SELECT r.role_name
             FROM public.user_roles ur
             INNER JOIN public.roles r ON r.id = ur.role_id
             WHERE ur.user_id = u.id
             ORDER BY r.id ASC
             LIMIT 1
           ),
           '${ROLES.FACULTY}'
         ) AS role
       FROM "User" u
       WHERE u.id = $1
       LIMIT 1`,
      id
    );
    const existingUser = existingUserRows[0] || null;
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existingRoles = await getUserRolesByUserId(id);
    const existingRoleNames = existingRoles.map((role) => role.roleName);
    const roleNamesFromIds = await getRoleNamesByIds(roleIds);
    const selectedRoles = normalizeRoleList(roleNamesFromIds.length > 0 ? roleNamesFromIds : roles || role || existingRoleNames);
    if (selectedRoles.length === 0) {
      return res.status(400).json({ message: 'At least one role is required' });
    }

    const invalidRoles = await getInvalidRoleNames(selectedRoles);
    if (invalidRoles.length > 0) {
      return res.status(400).json({ message: `Invalid role(s): ${invalidRoles.join(', ')}` });
    }

    const duplicateEmailUser = email
      ? await prisma.user.findFirst({ where: { email, NOT: { id } } })
      : null;
    if (duplicateEmailUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const resolvedDepartment = department !== undefined ? department : existingUser.department || '';

    const updateData = {
      name: name !== undefined ? name : existingUser.name,
      email: email !== undefined ? email : existingUser.email,
      department: resolvedDepartment,
      staff_phone_no: staff_phone_no !== undefined ? (staff_phone_no ? String(staff_phone_no).trim() : null) : existingUser.staff_phone_no
    };

    if (password && String(password).trim()) {
      if (!isPasswordValid(password)) {
        return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
      }
      const salt = await bcrypt.genSalt(12);
      updateData.password = await bcrypt.hash(password, salt);
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const userRecord = await tx.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          staff_phone_no: true,
          isActive: true,
          createdAt: true
        }
      });

      await syncUserRoles(tx, id, selectedRoles);

      const shouldBeDriver = resolvedDepartment === 'Vehicle Maintenance' && Boolean(is_driver);
      const existingDriver = await tx.driver.findUnique({ where: { userId: id } });
      if (shouldBeDriver && !existingDriver) {
        await tx.driver.create({ data: { userId: id } });
      } else if (!shouldBeDriver && existingDriver) {
        await tx.driver.delete({ where: { userId: id } });
      }

      return { ...userRecord, isDriver: shouldBeDriver };
    });

    res.json({ success: true, user: updatedUser, roles: selectedRoles });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Bulk create users (by Admin)
// @route   POST /api/admin/users/bulk
// @access  Private/Admin
const bulkCreateUsers = async (req, res) => {
  try {
    const { users } = req.body;

    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ message: 'Valid users array is required' });
    }

    const defaultPassword = 'Password@123';
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(defaultPassword, salt);

    const formattedUsers = users.map(user => ({
      name: user.Name || user.name,
      email: user.Email || user.email,
      department: user.Department || user.department || '',
      staff_phone_no: user.Phone || user.phone || user.staff_phone_no || null,
      role: normalizeRole(user.Role || user.role),
      password: hashedPassword,
      isActive: true
    }));

    // Filter out invalid users
    const validUsers = formattedUsers.filter(u => u.name && u.email);

    if (validUsers.length === 0) {
      return res.status(400).json({ message: 'No valid user data found in the upload' });
    }

    let createdCount = 0;
    for (const validUser of validUsers) {
      const { role, ...userData } = validUser;

      await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.createMany({
          data: [userData],
          skipDuplicates: true // Will skip if email already exists
        });

        if (createdUser.count === 0) {
          return;
        }

        createdCount += 1;
        const newUser = await tx.user.findUnique({ where: { email: userData.email } });
        await syncUserRoles(tx, newUser.id, [role]);
      });
    }

    res.status(201).json({
      success: true,
      message: `Successfully added ${createdCount} users. Any existing emails were skipped.`
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error during bulk upload' });
  }
};

// @desc    Get all complaints/indents (for Admin Monitoring)
// @route   GET /api/admin/complaints
// @access  Private/Admin
const getAllComplaints = async (req, res) => {
  try {
    const indents = await prisma.indent.findMany({
      include: {
        requester: { select: { name: true } },
        category: { select: { name: true } },
        statusHistory: { orderBy: { timestamp: 'asc' } },
        materialsUsed: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ 
      success: true,
      complaints: indents 
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a new maintenance department (Category)
// @route   POST /api/admin/departments
// @access  Private/Admin
const createDepartment = async (req, res) => {
  try {
    const { name, description, inchargeEmail } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Department name is required' });
    }

    let inchargeId = null;
    
    // If an incharge email is provided, verify they exist and are Faculty/HOD
    if (inchargeEmail) {
      const user = await getUserWithPrimaryRoleByEmail(inchargeEmail);
      if (!user) {
        return res.status(404).json({ message: 'User with this email not found' });
      }
      if (
        user.role !== ROLES.FACULTY &&
        user.role !== ROLES.HOD &&
        user.role !== ROLES.NON_TEACHING &&
        user.role !== ROLES.FACILITY_PROVIDER
      ) {
        return res.status(400).json({ message: 'Assigned incharge must be Faculty, Non-Teaching, or HOD' });
      }

      // Category incharges are their own role ('Facility Provider'), distinct from
      // an academic Dept HOD, so upgrade Faculty/Non-Teaching/HOD to it here.
      if (user.role !== ROLES.FACILITY_PROVIDER) {
        const facilityProviderRoleId = await getFacilityProviderRoleId();

        if (facilityProviderRoleId) {
          const previousRoles = await getUserRolesByUserId(user.id);

          await prisma.$executeRawUnsafe(
            `DELETE FROM public.user_roles WHERE user_id = $1`,
            user.id
          );
          await prisma.$executeRawUnsafe(
            `INSERT INTO public.user_roles (user_id, role_id) VALUES ($1, $2)`,
            user.id,
            facilityProviderRoleId
          );

          await logAndNotifyRoleReplacement({
            adminUser: req.user,
            targetUser: user,
            previousRoles,
            newRoleName: ROLES.FACILITY_PROVIDER
          });
        }
      }

      inchargeId = user.id;
    }

    // Check if category already exists
    const categoryExists = await prisma.category.findUnique({ where: { name } });
    if (categoryExists) {
      return res.status(400).json({ message: 'Department already exists' });
    }

    const category = await prisma.category.create({
      data: {
        name,
        description,
        inchargeId
      },
      include: {
        incharge: { select: { name: true, email: true } }
      }
    });

    res.status(201).json({
      success: true,
      department: category
    });
  } catch (err) {
    console.error('createDepartment error:', err);
    if (err.code === 'P2002') {
      return res.status(400).json({ message: 'Department already exists' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update a maintenance department (Category)
// @route   PUT /api/admin/departments/:id
// @access  Private/Admin
const updateDepartment = async (req, res) => {
  try {
    const { name, description, inchargeEmail } = req.body;
    const { id } = req.params;

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const updateData = {};
    if (name) {
      const duplicate = await prisma.category.findUnique({ where: { name } });
      if (duplicate && duplicate.id !== id) {
        return res.status(400).json({ message: 'Department already exists' });
      }
      updateData.name = name;
    }
    if (description !== undefined) updateData.description = description;

    // Handle incharge update
    if (inchargeEmail !== undefined) {
      if (!inchargeEmail) {
        updateData.inchargeId = null;
      } else {
        const user = await getUserWithPrimaryRoleByEmail(inchargeEmail);
        if (!user) {
          return res.status(404).json({ message: 'User with this email not found' });
        }
        if (
          user.role !== ROLES.FACULTY &&
          user.role !== ROLES.HOD &&
          user.role !== ROLES.NON_TEACHING &&
          user.role !== ROLES.FACILITY_PROVIDER
        ) {
          return res.status(400).json({ message: 'Assigned incharge must be Faculty, Non-Teaching, or HOD' });
        }

        // Category incharges are their own role ('Facility Provider'), distinct from
        // an academic Dept HOD, so upgrade Faculty/Non-Teaching/HOD to it here.
        if (user.role !== ROLES.FACILITY_PROVIDER) {
          const facilityProviderRoleId = await getFacilityProviderRoleId();
          if (facilityProviderRoleId) {
            const previousRoles = await getUserRolesByUserId(user.id);

            await prisma.$executeRawUnsafe(`DELETE FROM public.user_roles WHERE user_id = $1`, user.id);
            await prisma.$executeRawUnsafe(`INSERT INTO public.user_roles (user_id, role_id) VALUES ($1, $2)`, user.id, facilityProviderRoleId);

            await logAndNotifyRoleReplacement({
              adminUser: req.user,
              targetUser: user,
              previousRoles,
              newRoleName: ROLES.FACILITY_PROVIDER
            });
          }
        }

        updateData.inchargeId = user.id;
      }
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: updateData,
      include: {
        incharge: { select: { name: true, email: true } }
      }
    });
    
    res.json({
      success: true,
      department: updatedCategory
    });
  } catch (err) {
    console.error('updateDepartment error:', err);
    if (err.code === 'P2002') {
      return res.status(400).json({ message: 'Department already exists' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Search for users by email (For assigning HODs/Incharge)
// @route   GET /api/admin/users/search?email=...
// @access  Private/Admin
const searchUsers = async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ message: 'Email query parameter is required' });
    }

    const users = await getUsersByEmailAndRoles(email);

    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all Departments/Categories (Admin View)
// @route   GET /api/admin/departments
// @access  Private/Admin
const getDepartmentsAdmin = async (req, res) => {
  try {
    const departments = await prisma.$queryRawUnsafe(
      `SELECT
         c.id,
         c.name,
         c.description,
         c."inchargeId",
         c."createdAt",
         c."updatedAt",
         CASE
           WHEN u.id IS NULL THEN NULL
           ELSE json_build_object(
             'name', u.name,
             'email', u.email,
             'role', COALESCE(
               (
                 SELECT r.role_name
                 FROM public.user_roles ur
                 INNER JOIN public.roles r ON r.id = ur.role_id
                 WHERE ur.user_id = u.id
                 ORDER BY r.id ASC
                 LIMIT 1
               ),
               '${ROLES.FACULTY}'
             )
           )
         END AS incharge
       FROM "Category" c
       LEFT JOIN "User" u ON u.id = c."inchargeId"
       ORDER BY c."createdAt" DESC`
    );
    res.json({ departments });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const mapStationaryRow = (row) => ({
  id: Number(row.id),
  name: row.name,
  specification: row.specification,
  created_at: row.created_at,
  updated_at: row.updated_at
});

// @desc    Get all stationery items
// @route   GET /api/admin/stationaries
// @access  Private/Admin
const getAllStationaries = async (req, res) => {
  try {
    const stationaries = await prisma.$queryRawUnsafe(
      `SELECT id, name, specification, created_at, updated_at
       FROM public.stationaries
       ORDER BY created_at DESC NULLS LAST, id DESC`
    );

    res.json({ success: true, stationaries: stationaries.map(mapStationaryRow) });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create stationery item
// @route   POST /api/admin/stationaries
// @access  Private/Admin
const createStationary = async (req, res) => {
  try {
    const { name, specification } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Item name is required' });
    }

    if (!specification || !String(specification).trim()) {
      return res.status(400).json({ message: 'Specification is required' });
    }

    const rows = await prisma.$queryRawUnsafe(
      `INSERT INTO public.stationaries (name, specification, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING id, name, specification, created_at, updated_at`,
      String(name).trim(),
      String(specification).trim()
    );

    res.status(201).json({ success: true, stationary: mapStationaryRow(rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update stationery item
// @route   PUT /api/admin/stationaries/:id
// @access  Private/Admin
const updateStationary = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, specification } = req.body;

    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.stationaries WHERE id = $1 LIMIT 1`,
      Number(id)
    );

    if (!existing || existing.length === 0) {
      return res.status(404).json({ message: 'Stationary item not found' });
    }

    const rows = await prisma.$queryRawUnsafe(
      `UPDATE public.stationaries
       SET name = COALESCE($2, name),
           specification = COALESCE($3, specification),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, specification, created_at, updated_at`,
      Number(id),
      name !== undefined ? String(name).trim() : null,
      specification !== undefined ? String(specification).trim() : null
    );

    res.json({ success: true, stationary: mapStationaryRow(rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete stationery item
// @route   DELETE /api/admin/stationaries/:id
// @access  Private/Admin
const deleteStationary = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await prisma.$executeRawUnsafe(
      `DELETE FROM public.stationaries WHERE id = $1`,
      Number(id)
    );

    if (!deleted) {
      return res.status(404).json({ message: 'Stationary item not found' });
    }

    res.json({ success: true, message: 'Stationary item deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get data for monthly report
// @route   GET /api/admin/reports
// @access  Private/Admin
const getMonthlyReport = async (req, res) => {
  try {
    const { months, years, departments, statuses, month, year, status } = req.query;

    const query = {};

    // Note: Prisma does not have $expr $month natively inside findMany where clause easily without raw queries.
    // Instead of raw query, let's fetch all (or filter by indexable fields) and filter in memory, or use raw if needed.
    // Given the previous code, let's construct native where clauses for status and department
    
    const statusesArr = statuses ? statuses.split(',').filter(Boolean) : (status && status !== 'All' ? [status] : null);
    if (statusesArr && statusesArr.length > 0 && !statusesArr.includes('All')) {
      query.status = { in: statusesArr };
    }

    const deptsArr = departments ? departments.split(',').filter(Boolean) : null;
    if (deptsArr && deptsArr.length > 0 && !deptsArr.includes('All')) {
      query.categoryId = { in: deptsArr };
    }

    const indents = await prisma.indent.findMany({
      where: query,
      include: {
        requester: { select: { name: true } },
        category: { select: { name: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Handle months and years filtering in JS
    const monthsArr = months ? months.split(',').map(Number) : (month ? [parseInt(month)] : null);
    const yearsArr = years ? years.split(',').map(Number) : (year ? [parseInt(year)] : null);

    let filteredIndents = indents;
    if (monthsArr || yearsArr) {
      filteredIndents = indents.filter(i => {
        const date = new Date(i.createdAt);
        const m = date.getMonth() + 1; // 1-12
        const y = date.getFullYear();
        let match = true;
        if (monthsArr && monthsArr.length > 0 && !monthsArr.includes(m)) match = false;
        if (yearsArr && yearsArr.length > 0 && !yearsArr.includes(y)) match = false;
        return match;
      });
    }

    const reportData = filteredIndents.map(i => ({
      indentNumber: i.indentNumber || i.id.substring(0, 8),
      isrNo: i.isrNo || '',
      date: new Date(i.createdAt).toLocaleDateString(),
      generatedBy: i.requester?.name || 'N/A',
      assignedToDept: i.category?.name || 'Unassigned',
      status: i.status,
      description: i.description || 'No description'
    }));

    res.json({ success: true, reportData });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const mapCoordinatorRow = (row) => ({
  id: Number(row.id),
  name: row.name,
  employee_type: row.employee_type,
  created_at: row.created_at,
  updated_at: row.updated_at
});

const mapCoordinatorStaffRow = (row) => ({
  id: Number(row.id),
  coordinator_id: Number(row.coordinator_id),
  staff_id: row.staff_id,
  department_id: row.department_id,
  start_date: row.start_date,
  end_date: row.end_date,
  level: row.level,
  status: row.status,
  created_at: row.created_at,
  updated_at: row.updated_at,
  staff_name: row.staff_name,
  staff_email: row.staff_email,
  department_name: row.department_name,
  coordinator_name: row.coordinator_name
});

// @desc    Get assignments for a coordinator
// @route   GET /api/admin/coordinators/:id/assignments
// @access  Private/Admin
const getCoordinatorAssignments = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await prisma.$queryRawUnsafe(
      `SELECT cs.id,
              cs.coordinator_id,
              cs.staff_id,
              cs.department_id,
              cs.start_date,
              cs.end_date,
              cs.level,
              cs.status,
              cs.created_at,
              cs.updated_at,
              c.name AS coordinator_name,
              u.name AS staff_name,
              u.email AS staff_email,
              d.name AS department_name
       FROM public.coordinator_staffs cs
       LEFT JOIN public.coordinators c ON c.id = cs.coordinator_id
      LEFT JOIN public."User" u ON u.id = cs.staff_id::text
      LEFT JOIN public."Category" d ON d.id = cs.department_id::text
       WHERE cs.coordinator_id = $1
       ORDER BY cs.created_at DESC NULLS LAST, cs.id DESC`,
      Number(id)
    );

    res.json({
      success: true,
      assignments: rows.map((row) => ({
        ...mapCoordinatorStaffRow(row),
        department_name: resolveDepartmentName(row.department_name) || resolveDepartmentName(row.department_id)
      }))
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Assign staff to coordinator
// @route   POST /api/admin/coordinators/:id/assignments
// @access  Private/Admin
const createCoordinatorAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { staff_id, department_id, start_date, end_date, level, status } = req.body;

    if (!staff_id || !start_date) {
      return res.status(400).json({ message: 'Staff and start date are required' });
    }

    let resolvedDepartmentId = resolveDepartmentValue(department_id);

    if (!resolvedDepartmentId) {
      const staffRows = await prisma.$queryRawUnsafe(
        `SELECT id, department
         FROM public."User"
         WHERE id = $1
         LIMIT 1`,
        String(staff_id)
      );

      const staffUser = staffRows && staffRows[0];
      resolvedDepartmentId = resolveDepartmentValue(staffUser?.department);

      if (!resolvedDepartmentId) {
        return res.status(400).json({
          message: 'Unable to resolve a valid department for this staff member'
        });
      }
    }

    const coordinator = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.coordinators WHERE id = $1 LIMIT 1`,
      Number(id)
    );
    if (!coordinator || coordinator.length === 0) {
      return res.status(404).json({ message: 'Coordinator not found' });
    }

    const rows = await prisma.$queryRawUnsafe(
      `INSERT INTO public.coordinator_staffs
         (coordinator_id, staff_id, department_id, start_date, end_date, level, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id, coordinator_id, staff_id, department_id, start_date, end_date, level, status, created_at, updated_at`,
      Number(id),
      String(staff_id),
      String(resolvedDepartmentId),
      start_date,
      end_date || null,
      level || null,
      status || 'Active'
    );

    const assignmentRows = await prisma.$queryRawUnsafe(
      `SELECT cs.id,
              cs.coordinator_id,
              cs.staff_id,
              cs.department_id,
              cs.start_date,
              cs.end_date,
              cs.level,
              cs.status,
              cs.created_at,
              cs.updated_at,
              c.name AS coordinator_name,
              u.name AS staff_name,
              u.email AS staff_email,
              d.name AS department_name
       FROM public.coordinator_staffs cs
       LEFT JOIN public.coordinators c ON c.id = cs.coordinator_id
      LEFT JOIN public."User" u ON u.id = cs.staff_id::text
      LEFT JOIN public."Category" d ON d.id = cs.department_id::text
       WHERE cs.id = $1
       LIMIT 1`,
      Number(rows[0].id)
    );

    const assignment = assignmentRows[0] ? {
      ...mapCoordinatorStaffRow(assignmentRows[0]),
      department_name: resolveDepartmentName(assignmentRows[0].department_name) || resolveDepartmentName(assignmentRows[0].department_id)
    } : null;

    res.status(201).json({ success: true, assignment });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update coordinator assignment
// @route   PUT /api/admin/coordinators/assignments/:assignmentId
// @access  Private/Admin
const updateCoordinatorAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { staff_id, department_id, start_date, end_date, level, status } = req.body;

    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.coordinator_staffs WHERE id = $1 LIMIT 1`,
      Number(assignmentId)
    );

    if (!existing || existing.length === 0) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const rows = await prisma.$queryRawUnsafe(
      `UPDATE public.coordinator_staffs
       SET staff_id = COALESCE($2, staff_id),
           department_id = COALESCE($3, department_id),
           start_date = COALESCE($4, start_date),
           end_date = COALESCE($5, end_date),
           level = COALESCE($6, level),
           status = COALESCE($7, status),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, coordinator_id, staff_id, department_id, start_date, end_date, level, status, created_at, updated_at`,
      Number(assignmentId),
      staff_id ? Number(staff_id) : null,
      department_id ? String(department_id) : null,
      start_date || null,
      end_date || null,
      level || null,
      status || null
    );

    const assignmentRows = await prisma.$queryRawUnsafe(
      `SELECT cs.id,
              cs.coordinator_id,
              cs.staff_id,
              cs.department_id,
              cs.start_date,
              cs.end_date,
              cs.level,
              cs.status,
              cs.created_at,
              cs.updated_at,
              c.name AS coordinator_name,
              u.name AS staff_name,
              u.email AS staff_email,
              d.name AS department_name
       FROM public.coordinator_staffs cs
       LEFT JOIN public.coordinators c ON c.id = cs.coordinator_id
      LEFT JOIN public."User" u ON u.id = cs.staff_id::text
      LEFT JOIN public."Category" d ON d.id = cs.department_id::text
       WHERE cs.id = $1
       LIMIT 1`,
      Number(rows[0].id)
    );

    const assignment = assignmentRows[0] ? {
      ...mapCoordinatorStaffRow(assignmentRows[0]),
      department_name: resolveDepartmentName(assignmentRows[0].department_name) || resolveDepartmentName(assignmentRows[0].department_id)
    } : null;

    res.json({ success: true, assignment });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all coordinators
// @route   GET /api/admin/coordinators
// @access  Private/Admin
const getAllCoordinators = async (req, res) => {
  try {
    const coordinators = await prisma.$queryRawUnsafe(`
      SELECT id, name, employee_type, created_at, updated_at
      FROM public.coordinators
      ORDER BY created_at DESC NULLS LAST, id DESC
    `);

    res.json({ success: true, coordinators: coordinators.map(mapCoordinatorRow) });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create coordinator
// @route   POST /api/admin/coordinators
// @access  Private/Admin
const createCoordinator = async (req, res) => {
  try {
    const { name, employee_type } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Coordinator name is required' });
    }

    const allowedTypes = ['Teaching', 'Non-Teaching', 'Both', ''];
    const safeEmployeeType = employee_type !== undefined ? String(employee_type) : 'Teaching';
    if (!allowedTypes.includes(safeEmployeeType)) {
      return res.status(400).json({ message: 'Invalid employee type' });
    }

    const rows = await prisma.$queryRawUnsafe(
      `INSERT INTO public.coordinators (name, employee_type, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING id, name, employee_type, created_at, updated_at`,
      String(name).trim(),
      safeEmployeeType
    );

    res.status(201).json({ success: true, coordinator: mapCoordinatorRow(rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update coordinator
// @route   PUT /api/admin/coordinators/:id
// @access  Private/Admin
const updateCoordinator = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, employee_type } = req.body;

    const allowedTypes = ['Teaching', 'Non-Teaching', 'Both', ''];
    const safeEmployeeType = employee_type !== undefined ? String(employee_type) : undefined;
    if (safeEmployeeType !== undefined && !allowedTypes.includes(safeEmployeeType)) {
      return res.status(400).json({ message: 'Invalid employee type' });
    }

    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.coordinators WHERE id = $1`,
      Number(id)
    );
    if (!existing || existing.length === 0) {
      return res.status(404).json({ message: 'Coordinator not found' });
    }

    const updateName = name !== undefined ? String(name).trim() : null;
    const updateType = safeEmployeeType !== undefined ? safeEmployeeType : null;

    const rows = await prisma.$queryRawUnsafe(
      `UPDATE public.coordinators
       SET name = COALESCE($2, name),
           employee_type = COALESCE($3, employee_type),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, employee_type, created_at, updated_at`,
      Number(id),
      updateName,
      updateType
    );

    res.json({ success: true, coordinator: mapCoordinatorRow(rows[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete coordinator
// @route   DELETE /api/admin/coordinators/:id
// @access  Private/Admin
const deleteCoordinator = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await prisma.$executeRawUnsafe(
      `DELETE FROM public.coordinators WHERE id = $1`,
      Number(id)
    );

    if (!result) {
      return res.status(404).json({ message: 'Coordinator not found' });
    }

    res.json({ success: true, message: 'Coordinator deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get coordinator by id
// @route   GET /api/admin/coordinators/:id
// @access  Private/Admin
const getCoordinatorById = async (req, res) => {
  try {
    const { id } = req.params;
    const coordinators = await prisma.$queryRawUnsafe(
      `SELECT id, name, employee_type, created_at, updated_at
       FROM public.coordinators
       WHERE id = $1
       LIMIT 1`,
      Number(id)
    );

    if (!coordinators || coordinators.length === 0) {
      return res.status(404).json({ message: 'Coordinator not found' });
    }

    res.json({ success: true, coordinator: mapCoordinatorRow(coordinators[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Toggle user active status
// @route   PUT /api/admin/users/:id/status
// @access  Private/Admin
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userRows = await prisma.$queryRawUnsafe(
      `SELECT id, name, email, "isActive" FROM "User" WHERE id = $1 LIMIT 1`,
      id
    );
    const user = userRows[0] || null;
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Prevent admin from disabling themselves
    if (req.user && req.user.id === id && user && user.email === req.user.email) {
      return res.status(400).json({ message: 'Cannot disable your own admin account' });
    }
    
    const newStatus = !user.isActive;
    
    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "isActive" = $2 WHERE id = $1`,
      id,
      newStatus
    );
    
    res.json({ success: true, isActive: newStatus, message: `User ${newStatus ? 'enabled' : 'disabled'} successfully` });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getSystemStats,
  getAllUsers,
  getAllRoles,
  createRole,
  updateRole,
  deleteRole,
  createUser,
  updateUser,
  getAllComplaints,
  createDepartment,
  updateDepartment,
  searchUsers,
  getDepartmentsAdmin,
  getAllStationaries,
  createStationary,
  updateStationary,
  deleteStationary,
  getMonthlyReport,
  toggleUserStatus,
  bulkCreateUsers,
  getAllCoordinators,
  getCoordinatorById,
  getCoordinatorAssignments,
  createCoordinatorAssignment,
  updateCoordinatorAssignment,
  createCoordinator,
  updateCoordinator,
  deleteCoordinator
};

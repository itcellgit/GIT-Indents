// backend/controllers/hodController.js
const prisma = require('../prismaClient');
const generateIndentNumber = require('../utils/generateIndentNumber');
const { sendNotification, escapeHtml } = require('../utils/notificationService');
const { ROLES } = require('../utils/roles');
const { getPrimaryRoleByUserId, getRoleIdByName, setUserRole: setUserRoleShared } = require('../utils/userRoles');
const { PASSWORD_POLICY_MESSAGE, isPasswordValid } = require('../utils/passwordPolicy');

const setUserRole = (tx, userId, roleName) => setUserRoleShared(tx, userId, roleName);

const HOD_DASHBOARD_INCLUDE = {
  category: { select: { name: true, incharge: { select: { id: true } } } },
  requester: { select: { name: true, email: true, department: true } },
  statusHistory: { orderBy: { timestamp: 'asc' } },
  materialsUsed: true
};

const DEPT_APPROVAL_STATUSES = ['Indent Created', 'Rejected by Principal'];
const MAINTENANCE_APPROVAL_STATUSES = [
  'Indent Created',
  'Approved by Dept HOD',
  'Approved by Principal',
  'Rejected by Maintenance HOD',
  'Rejected by Principal'
];
const ACTIVE_MAINTENANCE_STATUSES = ['Approved by Maintenance HOD', 'In Progress'];

// @desc    Get dashboard indents for HOD
// @route   GET /api/hod/complaints
// @access  Private (HOD view)
const getHODComplaints = async (req, res) => {
  try {
    let maintenanceIndents = [];
    let approvalRequests = [];
    let deptTrackIndents = [];
    let deptFacilityProviderIndents = [];
    let hasDeptFacilityProvider = false;
    let isCategoryIncharge = false;

    if (req.user.role === ROLES.PRINCIPAL) {
      isCategoryIncharge = true;
      // Principal's Global Queue is a read-only view of every indent in the
      // system, with no status filter — approval/rejection is handled by the
      // Facility Provider for each category, not the Principal.
      maintenanceIndents = await prisma.indent.findMany({
        include: HOD_DASHBOARD_INCLUDE
      });
    } else {
      // 1. Find all categories where the current user is the incharge (Maintenance HOD role)
      const categories = await prisma.category.findMany({ where: { inchargeId: req.user.id } });
      const categoryIds = categories.map(cat => cat.id);
      isCategoryIncharge = categoryIds.length > 0;

      // 2. Fetch Maintenance Indents managed by this incharge
      maintenanceIndents = await prisma.indent.findMany({ 
        where: {
          categoryId: { in: categoryIds },
          status: { in: ACTIVE_MAINTENANCE_STATUSES }
        },
        include: HOD_DASHBOARD_INCLUDE
      });

      // 3. Fetch department approval requests for this HOD's department
      // Guard against req.user.department being blank/null: without this, Prisma
      // would translate department: null/'' into an IS NULL/= '' match that pulls
      // in every OTHER requester whose department is also unset, leaking indents
      // across departments instead of scoping to just this HOD's own department.
      const departmentApprovalRequests = req.user.department
        ? await prisma.indent.findMany({
            where: {
              requester: { department: req.user.department },
              status: { in: DEPT_APPROVAL_STATUSES }
            },
            include: HOD_DASHBOARD_INCLUDE
          })
        : [];

      // 4. Fetch approval items that still need Maintenance HOD review
      const maintenanceApprovalRequests = await prisma.indent.findMany({
        where: {
          categoryId: { in: categoryIds },
          status: { in: MAINTENANCE_APPROVAL_STATUSES }
        },
        include: HOD_DASHBOARD_INCLUDE
      });

      approvalRequests = Array.from(
        new Map(
          [...departmentApprovalRequests, ...maintenanceApprovalRequests].map(indent => [indent.id, indent])
        ).values()
      );
        
      deptTrackIndents = req.user.department
        ? await prisma.indent.findMany({
            where: { requester: { department: req.user.department } },
            include: HOD_DASHBOARD_INCLUDE
          })
        : [];

      // 5. For a Dept HOD, also surface everything handled by the Facility
      // Providers assigned to this same department (their category-incharge work),
      // regardless of who raised it.
      if (req.user.role === ROLES.HOD && req.user.department) {
        const facilityProvidersInDept = await prisma.$queryRawUnsafe(
          `SELECT u.id
           FROM "User" u
           INNER JOIN public.user_roles ur ON ur.user_id = u.id
           INNER JOIN public.roles r ON r.id = ur.role_id
           WHERE r.role_name = $1 AND u.department = $2`,
          ROLES.FACILITY_PROVIDER,
          req.user.department
        );
        const facilityProviderIds = facilityProvidersInDept.map((u) => u.id);
        hasDeptFacilityProvider = facilityProviderIds.length > 0;

        if (hasDeptFacilityProvider) {
          const facilityCategories = await prisma.category.findMany({
            where: { inchargeId: { in: facilityProviderIds } }
          });
          const facilityCategoryIds = facilityCategories.map((cat) => cat.id);

          deptFacilityProviderIndents = await prisma.indent.findMany({
            where: { categoryId: { in: facilityCategoryIds } },
            include: HOD_DASHBOARD_INCLUDE
          });
        }
      }
    }

    const myRaisedIndents = await prisma.indent.findMany({ 
      where: { requesterId: req.user.id },
      include: HOD_DASHBOARD_INCLUDE
    });

    const sortFn = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);

    maintenanceIndents.sort(sortFn);
    approvalRequests.sort(sortFn);
    myRaisedIndents.sort(sortFn);
    deptFacilityProviderIndents.sort(sortFn);

    res.status(200).json({
      success: true,
      departmentIndents: maintenanceIndents,
      approvalRequests,
      myRaisedIndents,
      deptTrackIndents,
      deptFacilityProviderIndents,
      hasDeptFacilityProvider,
      isCategoryIncharge
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update complaint status
// @route   PUT /api/hod/complaints/:id/status
// @access  Private (HOD view)
const updateComplaintStatus = async (req, res) => {
  try {
    const { 
      status, 
      assignedWorkerNames, 
      durationRequiredHours, 
      materialsUsed, 
      remarksByIncharge, 
      remarksByCoordinator, 
      remarksByHOD, 
      reasonForIncompleteWork, 
      reasonForDelayedWork,
      rejectionReason,
      rejectedBy,
      natureOfWork,
      location,
      description
    } = req.body;
    
    // Ensure the indent exists
    const indent = await prisma.indent.findUnique({ 
      where: { id: req.params.id },
      include: {
        requester: { select: { id: true, department: true } },
        category: { select: { id: true, inchargeId: true } }
      }
    });
    if (!indent) {
      return res.status(404).json({ message: 'Indent not found' });
    }

    // PERMISSION CHECK for maintenance review flow
    // Principal is deliberately excluded: approval/rejection of maintenance
    // indents is the Facility Provider's responsibility only. Principal's
    // Global Queue is read-only.
    const isMaintenanceIncharge = await prisma.category.findFirst({ where: { id: indent.categoryId, inchargeId: req.user.id } });
    const isDeptHOD = req.user.role === ROLES.HOD && indent.requester?.department && req.user.department === indent.requester.department;

    if (!isMaintenanceIncharge && !isDeptHOD) {
      return res.status(403).json({
        message: 'Forbidden: You are not authorized to update this indent.'
      });
    }

    if (status === 'Completed') {
      return res.status(403).json({
        message: 'Completion is restricted to the assigned Maintainer.'
      });
    }

    // Approving/rejecting an indent is exclusively the Facility Provider's
    // call. A Dept HOD reaches this endpoint only to edit an indent's own
    // fields (via isDeptHOD above), never to change its status — block any
    // attempted status change from a non-incharge caller.
    if (status && status !== indent.status && !isMaintenanceIncharge) {
      return res.status(403).json({
        message: 'Only the Facility Provider can approve or reject indents.'
      });
    }

    const updateData = {};
    if (status) {
      updateData.status = status;
      // Also add to statusHistory
      updateData.statusHistory = { create: [{ status }] };
    }
    if (assignedWorkerNames) updateData.assignedWorkerNames = assignedWorkerNames;
    if (durationRequiredHours !== undefined) updateData.durationRequiredHours = durationRequiredHours;
    
    // Handle materialsUsed creation if provided. (Assuming it replaces existing or just adds)
    if (materialsUsed !== undefined) {
      // In Prisma, we delete existing materials and recreate if list is non-empty
      await prisma.materialUsed.deleteMany({ where: { indentId: indent.id } });
      if (materialsUsed.length > 0) {
        updateData.materialsUsed = {
          create: materialsUsed.map(m => ({ itemName: m.itemName, quantity: m.quantity, unit: m.unit }))
        };
      }
    }

    if (remarksByIncharge !== undefined) updateData.remarksByIncharge = remarksByIncharge;
    if (remarksByCoordinator !== undefined) updateData.remarksByCoordinator = remarksByCoordinator;
    if (remarksByHOD !== undefined) updateData.remarksByHOD = remarksByHOD;
    if (reasonForIncompleteWork !== undefined) updateData.reasonForIncompleteWork = reasonForIncompleteWork;
    if (reasonForDelayedWork !== undefined) updateData.reasonForDelayedWork = reasonForDelayedWork;
    
    // Approval Flow additions
    if (rejectionReason !== undefined) updateData.rejectionReason = rejectionReason;
    if (rejectedBy !== undefined) updateData.rejectedBy = rejectedBy;
    if (natureOfWork) updateData.natureOfWork = natureOfWork;
    if (location) updateData.location = location;
    if (description) updateData.description = description;

    const updatedIndent = await prisma.indent.update({
      where: { id: indent.id },
      data: updateData,
      include: {
        category: { select: { name: true, inchargeId: true, incharge: { select: { id: true } } } },
        requester: { select: { name: true, email: true, department: true } },
        materialsUsed: true,
        statusHistory: { orderBy: { timestamp: 'asc' } }
      }
    });

    // -- NOTIFICATIONS --
    // 1. Maintenance HOD -> Principal (Rejection)
    if (status === 'Rejected by Maintenance HOD' && isMaintenanceIncharge) {
      const principalUsers = await prisma.$queryRawUnsafe(
        `SELECT u.id
         FROM "User" u
         INNER JOIN public.user_roles ur ON ur.user_id = u.id
         INNER JOIN public.roles r ON r.id = ur.role_id
         WHERE r.role_name = $1
         ORDER BY r.id ASC, u."createdAt" ASC
         LIMIT 1`,
        ROLES.PRINCIPAL
      );
      const principal = principalUsers[0];
      if (principal) {
        await sendNotification(
          principal.id,
          `Indent ${indent.indentNumber} was rejected by Maintenance HOD. Review required.`,
          req.user.id,
          indent.id,
          indent.indentNumber
        );
      }
    }
    // 2. Resolved -> Faculty
    if (status === 'Completed') {
      await sendNotification(
        indent.requesterId,
        `Your indent ${indent.indentNumber} has been marked as Completed.`,
        req.user.id,
        indent.id,
        indent.indentNumber
      );
    }

    res.status(200).json({
      success: true,
      complaint: updatedIndent
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Raise a new indent (as HOD/Maintenance)
// @route   POST /api/hod/complaints
// @access  Private (HOD/Admin)
const createHODIndent = async (req, res) => {
  try {
    const { category, nature, location, description, isrNo } = req.body;

    if (!category || !nature || !location || !description) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const categoryRecord = await prisma.category.findUnique({
      where: { id: category },
      select: { id: true, name: true, inchargeId: true }
    });

    if (!categoryRecord) {
      return res.status(400).json({ message: 'Invalid department selected.' });
    }

    let imagePath = null;
    if (req.file) {
      const uploadDir = process.env.UPLOAD_DIR || 'uploads';
      imagePath = `/${uploadDir}/${req.file.filename}`;
    }

    const indentNumber = await generateIndentNumber(req.user.id, category);

    // Approval always sits with the Facility Provider incharge of the target
    // category. The only exception is a Facility Provider raising an indent
    // for a category they themselves are incharge of, in which case there's
    // no one else left to approve it, so it's auto-approved straight to
    // "Approved by Maintenance HOD" (ready for assignment). Everyone else —
    // HOD, Admin, Principal, or a Facility Provider raising for a different
    // category — goes through the normal Facility Provider approval queue,
    // same as a Faculty-raised indent.
    const isSelfIncharge = categoryRecord.inchargeId && categoryRecord.inchargeId === req.user.id;
    const initialStatus = isSelfIncharge ? 'Approved by Maintenance HOD' : 'Indent Created';

    const newIndent = await prisma.indent.create({
      data: {
        indentNumber,
        isrNo: isrNo ? String(isrNo).trim() : null,
        requesterId: req.user.id,
        categoryId: categoryRecord.id,
        natureOfWork: nature,
        location,
        description,
        imagePath,
        status: initialStatus,
        statusHistory: {
          create: [
            { status: initialStatus }
          ]
        }
      },
      include: {
        category: { select: { name: true, inchargeId: true } },
        requester: { select: { name: true, email: true, department: true } },
        statusHistory: { orderBy: { timestamp: 'asc' } },
        materialsUsed: true
      }
    });

    if (!isSelfIncharge && categoryRecord.inchargeId) {
      try {
        await sendNotification(
          categoryRecord.inchargeId,
          `New indent ${newIndent.indentNumber} raised by ${escapeHtml(req.user.name)} requires your approval.`,
          req.user.id,
          newIndent.id,
          newIndent.indentNumber
        );
      } catch (notifyErr) {
        console.error('Failed to notify Facility Provider about new HOD-raised indent:', notifyErr);
      }
    }

    res.status(201).json({
      success: true,
      complaint: newIndent
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get maintainers in HOD's department
// @route   GET /api/hod/maintainers
// @access  Private (HOD view)
const getMaintainers = async (req, res) => {
  try {
    const maintainers = await prisma.$queryRawUnsafe(
      `SELECT u.id, u.name, u.email, u.department
       FROM "User" u
       INNER JOIN public.user_roles ur ON ur.user_id = u.id
       INNER JOIN public.roles r ON r.id = ur.role_id
       WHERE r.role_name = $1 AND u.department = $2`,
      ROLES.MAINTAINER,
      req.user.department
    );
    res.status(200).json({ success: true, maintainers });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get Faculty/Non-Teaching staff in HOD's department (eligible for Maintainer role)
// @route   GET /api/hod/faculty
// @access  Private (HOD view)
const getDepartmentFaculty = async (req, res) => {
  try {
    const faculty = await prisma.$queryRawUnsafe(
      `SELECT u.id, u.name, u.email, r.role_name AS role
       FROM "User" u
       INNER JOIN public.user_roles ur ON ur.user_id = u.id
       INNER JOIN public.roles r ON r.id = ur.role_id
       WHERE r.role_name IN ($1, $2)
         AND u.department = $3
         AND NOT EXISTS (
           SELECT 1 FROM public.user_roles ur2
           INNER JOIN public.roles r2 ON r2.id = ur2.role_id
           WHERE ur2.user_id = u.id AND r2.role_name = $4
         )
       ORDER BY u.name ASC`,
      ROLES.FACULTY,
      ROLES.NON_TEACHING,
      req.user.department,
      ROLES.MAINTAINER
    );
    res.status(200).json({ success: true, faculty });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get Stationary Coordinator in HOD's department
// @route   GET /api/hod/coordinator-staffs
// @access  Private (HOD view)
const getCoordinatorStaffs = async (req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT cs.id, cs.coordinator_id, cs.staff_id, cs.department_id, cs.start_date, cs.end_date, cs.level, cs.status,
              u.name, u.email,
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
       FROM public.coordinator_staffs cs
       LEFT JOIN public."User" u ON u.id = cs.staff_id
       WHERE cs.coordinator_id = $1
       ORDER BY cs.created_at DESC NULLS LAST, cs.id DESC`,
      String(req.user.id)
    );

    res.status(200).json({
      success: true,
      coordinatorStaffs: rows.map((row) => ({
        id: Number(row.id),
        coordinatorId: String(row.coordinator_id),
        staffId: String(row.staff_id),
        departmentId: String(row.department_id),
        startDate: row.start_date,
        endDate: row.end_date,
        level: row.level,
        status: row.status,
        name: row.name,
        email: row.email,
        role: row.role
      }))
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Add Stationary Coordinator for HOD's department
// @route   POST /api/hod/coordinator-staffs
// @access  Private (HOD view)
const addCoordinatorStaff = async (req, res) => {
  try {
    const { name, email, password, level, status, startDate, endDate } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.user.update({
        where: { email },
        data: {
          name,
          department: req.user.department
        }
      });
      await setUserRole(prisma, user.id, (await getPrimaryRoleByUserId(prisma, user.id)) === ROLES.NON_TEACHING ? ROLES.NON_TEACHING : ROLES.FACULTY);
    } else {
      if (!isPasswordValid(password)) {
        return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
      }

      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);

      user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          department: req.user.department
        }
      });

      await setUserRole(prisma, user.id, ROLES.FACULTY);
    }

    const existingAssignment = await prisma.$queryRawUnsafe(
      `SELECT id
       FROM public.coordinator_staffs
       WHERE coordinator_id = $1 AND staff_id = $2 AND department_id = $3
       LIMIT 1`,
      String(req.user.id),
      String(user.id),
      String(req.user.department || '')
    );

    let assignmentRow;
    if (existingAssignment.length > 0) {
      const rows = await prisma.$queryRawUnsafe(
        `UPDATE public.coordinator_staffs
         SET level = COALESCE($4, level),
             status = COALESCE($5, status),
             start_date = COALESCE($6, start_date),
             end_date = COALESCE($7, end_date),
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, coordinator_id, staff_id, department_id, start_date, end_date, level, status`,
        Number(existingAssignment[0].id),
        String(req.user.id),
        String(user.id),
        level || null,
        status || null,
        startDate || null,
        endDate || null
      );
      assignmentRow = rows[0];
    } else {
      const rows = await prisma.$queryRawUnsafe(
        `INSERT INTO public.coordinator_staffs
         (coordinator_id, staff_id, department_id, start_date, end_date, level, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING id, coordinator_id, staff_id, department_id, start_date, end_date, level, status`,
        String(req.user.id),
        String(user.id),
        String(req.user.department || ''),
        startDate || null,
        endDate || null,
        level || null,
        status || 'Active'
      );
      assignmentRow = rows[0];
    }

    res.status(201).json({
      success: true,
      coordinatorStaff: {
        id: Number(assignmentRow.id),
        coordinatorId: String(assignmentRow.coordinator_id),
        staffId: String(assignmentRow.staff_id),
        departmentId: String(assignmentRow.department_id),
        startDate: assignmentRow.start_date,
        endDate: assignmentRow.end_date,
        level: assignmentRow.level,
        status: assignmentRow.status,
        name: user.name,
        email: user.email,
        role: await getPrimaryRoleByUserId(prisma, user.id)
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Remove Stationary Coordinator from HOD's department
// @route   DELETE /api/hod/coordinator-staffs/:id
// @access  Private (HOD view)
const removeCoordinatorStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.coordinator_staffs WHERE id = $1 AND coordinator_id = $2 LIMIT 1`,
      Number(id),
      String(req.user.id)
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Stationary Coordinator not found or unauthorized' });
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM public.coordinator_staffs WHERE id = $1`,
      Number(id)
    );

    res.status(200).json({ success: true, message: 'Stationary Coordinator removed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Promote an existing Faculty member in HOD's department to Maintainer
// @route   POST /api/hod/maintainers
// @access  Private (HOD view)
const addMaintainer = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'Please select a staff member' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.department !== req.user.department) {
      return res.status(404).json({ message: 'Staff member not found in your department' });
    }

    // Add the Maintainer role alongside the user's existing role (Faculty/Non-Teaching)
    // instead of replacing it, so removing them later can restore their original role.
    const maintainerRoleId = await getRoleIdByName(prisma, ROLES.MAINTAINER);
    if (!maintainerRoleId) {
      return res.status(500).json({ message: 'Maintainer role is not configured' });
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO public.user_roles (user_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      user.id,
      maintainerRoleId
    );

    res.status(201).json({ success: true, maintainer: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Assign an indent to a maintainer
// @route   PUT /api/hod/complaints/:id/assign
// @access  Private (HOD view)
const assignMaintainer = async (req, res) => {
  try {
    const { maintainerId } = req.body;
    if (!maintainerId) {
      return res.status(400).json({ message: 'Maintainer ID is required' });
    }

    const indent = await prisma.indent.findUnique({
      where: { id: req.params.id },
      include: { requester: { select: { department: true } } }
    });
    if (!indent) return res.status(404).json({ message: 'Indent not found' });

    // Same scoping as updateComplaintStatus above: only the category's maintenance
    // incharge or the requester's own Dept HOD may act on this indent — without this,
    // any HOD/Facility Provider could reassign the maintainer on any indent by ID.
    const isMaintenanceIncharge = await prisma.category.findFirst({ where: { id: indent.categoryId, inchargeId: req.user.id } });
    const isDeptHOD = req.user.role === ROLES.HOD && indent.requester?.department && req.user.department === indent.requester.department;

    if (!isMaintenanceIncharge && !isDeptHOD) {
      return res.status(403).json({ message: 'Forbidden: You are not authorized to assign a maintainer for this indent.' });
    }

    // Validate if the maintainer exists
    const maintainer = await prisma.user.findUnique({ where: { id: maintainerId } });
    const maintainerRole = maintainer ? await getPrimaryRoleByUserId(prisma, maintainer.id) : null;
    if (!maintainer || maintainerRole !== ROLES.MAINTAINER) {
      return res.status(400).json({ message: 'Invalid maintainer selected' });
    }

    const updatedIndent = await prisma.indent.update({
      where: { id: indent.id },
      data: { maintainerId: maintainerId },
      include: {
        category: { select: { name: true, inchargeId: true } },
        requester: { select: { name: true, email: true, department: true } },
        statusHistory: { orderBy: { timestamp: 'asc' } },
        materialsUsed: true
      }
    });

    // Notify Maintainer
    await sendNotification(
      maintainerId,
      `You have been assigned to Indent ${indent.indentNumber} by your HOD.`,
      req.user.id,
      indent.id,
      indent.indentNumber
    );

    res.status(200).json({ success: true, complaint: updatedIndent });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Remove a maintainer
// @route   DELETE /api/hod/maintainers/:id
// @access  Private (HOD view)
const removeMaintainer = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await prisma.user.findUnique({ where: { id } });
    const userRole = user ? await getPrimaryRoleByUserId(prisma, user.id) : null;
    if (!user || userRole !== ROLES.MAINTAINER || user.department !== req.user.department) {
      return res.status(404).json({ message: 'Maintainer not found or unauthorized' });
    }

    // Drop only the Maintainer role so the user's original role (Faculty/Non-Teaching)
    // resurfaces as primary. Legacy maintainers with no underlying role fall back to Faculty.
    const maintainerRoleId = await getRoleIdByName(prisma, ROLES.MAINTAINER);
    await prisma.$executeRawUnsafe(
      `DELETE FROM public.user_roles WHERE user_id = $1 AND role_id = $2`,
      user.id,
      maintainerRoleId
    );

    const remainingRole = await getPrimaryRoleByUserId(prisma, user.id);
    if (!remainingRole) {
      await setUserRole(prisma, user.id, ROLES.FACULTY);
    }

    res.status(200).json({ success: true, message: 'Maintainer removed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getHODComplaints,
  updateComplaintStatus,
  createHODIndent,
  getMaintainers,
  addMaintainer,
  getDepartmentFaculty,
  getCoordinatorStaffs,
  addCoordinatorStaff,
  removeCoordinatorStaff,
  assignMaintainer,
  removeMaintainer
};

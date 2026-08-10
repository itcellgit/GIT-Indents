// backend/controllers/hodController.js
const prisma = require('../prismaClient');
const generateIndentNumber = require('../utils/generateIndentNumber');
const { sendNotification } = require('../utils/notificationService');
const { ROLES } = require('../utils/roles');
const { getPrimaryRoleByUserId, setUserRole: setUserRoleShared } = require('../utils/userRoles');

const setUserRole = (tx, userId, roleName) => setUserRoleShared(tx, userId, roleName);

// @desc    Get dashboard indents for HOD
// @route   GET /api/hod/complaints
// @access  Private (HOD view)
const getHODComplaints = async (req, res) => {
  try {
    let maintenanceIndents = [];
    let approvalRequests = [];
    let deptTrackIndents = [];
    
    if (req.user.role === ROLES.PRINCIPAL) {
      // Principal sees everything
      maintenanceIndents = await prisma.indent.findMany({ 
        where: { status: { notIn: ['Indent Created', 'Rejected by Maintenance HOD', 'Rejected by Dept HOD', 'Rejected by Principal'] } },
        include: {
          category: { select: { name: true, incharge: { select: { id: true } } } },
          requester: { select: { name: true, email: true, department: true } },
          statusHistory: { orderBy: { timestamp: 'asc' } },
          materialsUsed: true
        }
      });

      approvalRequests = await prisma.indent.findMany({ 
        where: { status: { in: ['Rejected by Maintenance HOD', 'Rejected by Principal'] } },
        include: {
          category: { select: { name: true, incharge: { select: { id: true } } } },
          requester: { select: { name: true, email: true, department: true } },
          statusHistory: { orderBy: { timestamp: 'asc' } },
          materialsUsed: true
        }
      });
    } else {
      // 1. Find all categories where the current user is the incharge (Maintenance HOD role)
      const categories = await prisma.category.findMany({ where: { inchargeId: req.user.id } });
      const categoryIds = categories.map(cat => cat.id);

      // 2. Fetch Maintenance Indents managed by this incharge
      maintenanceIndents = await prisma.indent.findMany({ 
        where: {
          categoryId: { in: categoryIds },
          status: { notIn: ['Completed', 'Rejected by Dept HOD'] }
        },
        include: {
          category: { select: { name: true, incharge: { select: { id: true } } } },
          requester: { select: { name: true, email: true, department: true } },
          statusHistory: { orderBy: { timestamp: 'asc' } },
          materialsUsed: true
        }
      });

      // 3. Fetch department approval requests for this HOD's department
      approvalRequests = await prisma.indent.findMany({ 
        where: {
          requester: { department: req.user.department },
          status: { in: ['Indent Created', 'Rejected by Principal'] }
        },
        include: {
          category: { select: { name: true, incharge: { select: { id: true } } } },
          requester: { select: { name: true, email: true, department: true } },
          statusHistory: { orderBy: { timestamp: 'asc' } },
          materialsUsed: true
        }
      });
        
      deptTrackIndents = await prisma.indent.findMany({
        where: { requester: { department: req.user.department } },
        include: {
          category: { select: { name: true, incharge: { select: { id: true } } } },
          requester: { select: { name: true, email: true, department: true } },
          statusHistory: { orderBy: { timestamp: 'asc' } },
          materialsUsed: true
        }
      });
    }

    const myRaisedIndents = await prisma.indent.findMany({ 
      where: { requesterId: req.user.id },
      include: {
        category: { select: { name: true, incharge: { select: { id: true } } } },
        requester: { select: { name: true, email: true, department: true } },
        statusHistory: { orderBy: { timestamp: 'asc' } },
        materialsUsed: true
      }
    });

    const sortFn = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);

    maintenanceIndents.sort(sortFn);
    approvalRequests.sort(sortFn);
    myRaisedIndents.sort(sortFn);

    res.status(200).json({
      success: true,
      departmentIndents: maintenanceIndents,
      approvalRequests,
      myRaisedIndents,
      deptTrackIndents
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
    const isMaintenanceIncharge = await prisma.category.findFirst({ where: { id: indent.categoryId, inchargeId: req.user.id } });
    const isDeptHOD = req.user.role === ROLES.HOD && indent.requester?.department && req.user.department === indent.requester.department;
    const isPrincipal = req.user.role === ROLES.PRINCIPAL;

    if (!isMaintenanceIncharge && !isDeptHOD && !isPrincipal) {
      return res.status(403).json({ 
        message: 'Forbidden: You are not authorized to update this indent.' 
      });
    }

    if (status === 'Completed') {
      return res.status(403).json({
        message: 'Completion is restricted to the assigned Maintainer.'
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
    // 1. Dept HOD or Principal -> Maintenance HOD
    if ((status === 'Approved by Dept HOD' || status === 'Approved by Principal') && !isMaintenanceIncharge) {
      const categoryInfo = await prisma.category.findUnique({ where: { id: indent.categoryId } });
      if (categoryInfo && categoryInfo.inchargeId) {
        sendNotification(
          categoryInfo.inchargeId,
          `Indent ${indent.indentNumber} was approved by ${isPrincipal ? 'Principal' : 'Department HOD'} and requires maintenance assessment.`,
          req.user.id,
          indent.id,
          indent.indentNumber
        );
      }
    }
    // 2. Department HOD -> Service Provider HOD (Rejection)
    if (status === 'Rejected by Dept HOD' && isDeptHOD) {
      const categoryInfo = await prisma.category.findUnique({ where: { id: indent.categoryId } });
      if (categoryInfo && categoryInfo.inchargeId) {
        sendNotification(
          categoryInfo.inchargeId,
          `Indent ${indent.indentNumber} was rejected by the Department HOD and returned to the service provider HOD review queue.`,
          req.user.id,
          indent.id,
          indent.indentNumber
        );
      }
    }
    // 3. Maintenance HOD -> Principal (Rejection)
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
        sendNotification(
          principal.id,
          `Indent ${indent.indentNumber} was rejected by Maintenance HOD. Review required.`,
          req.user.id,
          indent.id,
          indent.indentNumber
        );
      }
    }
    // 4. Resolved -> Faculty
    if (status === 'Completed') {
      sendNotification(
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
    const { category, nature, location, description } = req.body;

    if (!category || !nature || !location || !description) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    let imagePath = null;
    if (req.file) {
      const uploadDir = process.env.UPLOAD_DIR || 'uploads';
      imagePath = `/${uploadDir}/${req.file.filename}`;
    }

    const indentNumber = await generateIndentNumber(req.user.id, category);

    // Auto-approve if HOD is raising for their own department
    const newIndent = await prisma.indent.create({
      data: {
        indentNumber,
        requesterId: req.user.id,
        categoryId: category,
        natureOfWork: nature,
        location,
        description,
        imagePath,
        status: 'Approved by Dept HOD', // HOD raised indents are auto-approved
        statusHistory: {
          create: [
            { status: 'Approved by Dept HOD' }
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

// @desc    Get coordinator staff in HOD's department
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
                'Faculty'
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

// @desc    Add coordinator staff for HOD's department
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
      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
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

// @desc    Remove coordinator staff from HOD's department
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
      return res.status(404).json({ message: 'Coordinator staff not found or unauthorized' });
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM public.coordinator_staffs WHERE id = $1`,
      Number(id)
    );

    res.status(200).json({ success: true, message: 'Coordinator staff removed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Add a new maintainer (or promote existing user to Maintainer in dept)
// @route   POST /api/hod/maintainers
// @access  Private (HOD view)
const addMaintainer = async (req, res) => {
  try {
    const { email, name, password } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ message: 'Email, name, and password are required' });
    }

    // Check if user exists
    let user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.user.update({
        where: { email },
        data: { department: req.user.department }
      });
    } else {
      // Import bcrypt dynamically here or use plain text if testing (best to use bcrypt like authController)
      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          department: req.user.department
        }
      });
    }

    await setUserRole(prisma, user.id, ROLES.MAINTAINER);

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

    const indent = await prisma.indent.findUnique({ where: { id: req.params.id } });
    if (!indent) return res.status(404).json({ message: 'Indent not found' });

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
    sendNotification(
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

    await setUserRole(prisma, user.id, ROLES.FACULTY);

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
  getCoordinatorStaffs,
  addCoordinatorStaff,
  removeCoordinatorStaff,
  assignMaintainer,
  removeMaintainer
};

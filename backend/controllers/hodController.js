// backend/controllers/hodController.js
const prisma = require('../prismaClient');
const generateIndentNumber = require('../utils/generateIndentNumber');

// @desc    Get dashboard indents for HOD
// @route   GET /api/hod/complaints
// @access  Private (HOD view)
const getHODComplaints = async (req, res) => {
  try {
    let maintenanceIndents = [];
    let approvalRequests = [];
    let deptTrackIndents = [];
    
    if (req.user.role === 'Principal') {
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

      // 2. Fetch Maintenance Indents (Approved and managed by this HOD)
      maintenanceIndents = await prisma.indent.findMany({ 
        where: {
          categoryId: { in: categoryIds },
          status: { notIn: ['Indent Created', 'Rejected by Maintenance HOD', 'Rejected by Dept HOD'] }
        },
        include: {
          category: { select: { name: true, incharge: { select: { id: true } } } },
          requester: { select: { name: true, email: true, department: true } },
          statusHistory: { orderBy: { timestamp: 'asc' } },
          materialsUsed: true
        }
      });

      // 3. Fetch Department Approval Requests (Dept HOD role)
      const usersInDept = await prisma.user.findMany({ where: { department: req.user.department }, select: { id: true } });
      const userIdsInDept = usersInDept.map(u => u.id);
      
      approvalRequests = await prisma.indent.findMany({ 
        where: {
          requesterId: { in: userIdsInDept },
          status: { in: ['Indent Created', 'Rejected by Maintenance HOD', 'Rejected by Dept HOD'] }
        },
        include: {
          category: { select: { name: true, incharge: { select: { id: true } } } },
          requester: { select: { name: true, email: true, department: true } },
          statusHistory: { orderBy: { timestamp: 'asc' } },
          materialsUsed: true
        }
      });
        
      deptTrackIndents = await prisma.indent.findMany({
        where: { requesterId: { in: userIdsInDept } },
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
    console.error('Error fetching HOD complaints:', err.message);
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
    const indent = await prisma.indent.findUnique({ where: { id: req.params.id } });
    if (!indent) {
      return res.status(404).json({ message: 'Indent not found' });
    }

    // PERMISSION CHECK for Multi-Stage Approval
    const userRole = req.user.role;
    const isMaintenanceIncharge = await prisma.category.findFirst({ where: { id: indent.categoryId, inchargeId: req.user.id } });
    
    // Fetch requester to check department
    const requester = await prisma.user.findUnique({ where: { id: indent.requesterId } });
    const isDeptHOD = req.user.role === 'HOD' && requester && requester.department === req.user.department;
    const isPrincipal = req.user.role === 'Principal';

    if (!isMaintenanceIncharge && !isDeptHOD && !isPrincipal) {
      return res.status(403).json({ 
        message: 'Forbidden: You are not authorized to update this indent.' 
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
        await prisma.notification.create({
          data: {
            recipientId: categoryInfo.inchargeId,
            senderId: req.user.id,
            indentId: indent.id,
            message: `Indent ${indent.indentNumber} was approved by ${isPrincipal ? 'Principal' : 'Department HOD'} and requires maintenance assessment.`
          }
        });
      }
    }
    // 2. Maintenance HOD -> Principal (Rejection)
    if (status === 'Rejected by Maintenance HOD' && isMaintenanceIncharge) {
      const principal = await prisma.user.findFirst({ where: { role: 'Principal' } });
      if (principal) {
        await prisma.notification.create({
          data: {
            recipientId: principal.id,
            senderId: req.user.id,
            indentId: indent.id,
            message: `Indent ${indent.indentNumber} was rejected by Maintenance HOD. Review required.`
          }
        });
      }
    }
    // 3. Resolved -> Faculty
    if (status === 'Completed') {
      await prisma.notification.create({
        data: {
          recipientId: indent.requesterId,
          senderId: req.user.id,
          indentId: indent.id,
          message: `Your indent ${indent.indentNumber} has been marked as Completed.`
        }
      });
    }

    res.status(200).json({
      success: true,
      complaint: updatedIndent
    });
  } catch (err) {
    console.error('Error updating complaint:', err.message);
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
    console.error('Error creating HOD indent:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get maintainers in HOD's department
// @route   GET /api/hod/maintainers
// @access  Private (HOD view)
const getMaintainers = async (req, res) => {
  try {
    const maintainers = await prisma.user.findMany({
      where: {
        role: 'Maintainer',
        department: req.user.department
      },
      select: { id: true, name: true, email: true, department: true }
    });
    res.status(200).json({ success: true, maintainers });
  } catch (err) {
    console.error('Error fetching maintainers:', err.message);
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
      // Update existing user to Maintainer
      user = await prisma.user.update({
        where: { email },
        data: { role: 'Maintainer', department: req.user.department }
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
          role: 'Maintainer',
          department: req.user.department
        }
      });
    }

    res.status(201).json({ success: true, maintainer: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('Error adding maintainer:', err.message);
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
    if (!maintainer || maintainer.role !== 'Maintainer') {
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
    await prisma.notification.create({
      data: {
        recipientId: maintainerId,
        senderId: req.user.id,
        indentId: indent.id,
        message: `You have been assigned to Indent ${indent.indentNumber} by your HOD.`
      }
    });

    res.status(200).json({ success: true, complaint: updatedIndent });
  } catch (err) {
    console.error('Error assigning maintainer:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getHODComplaints,
  updateComplaintStatus,
  createHODIndent,
  getMaintainers,
  addMaintainer,
  assignMaintainer
};

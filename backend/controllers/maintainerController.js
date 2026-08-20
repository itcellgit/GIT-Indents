const prisma = require('../prismaClient');
const { sendNotification, escapeHtml } = require('../utils/notificationService');

const parseJsonField = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
};

// @desc    Get dashboard indents for Maintainer
// @route   GET /api/maintainer/dashboard
// @access  Private (Maintainer view)
const DASHBOARD_INCLUDE = {
  category: { select: { name: true, incharge: { select: { id: true, name: true } } } },
  requester: { select: { name: true, email: true, department: true, staff_phone_no: true } },
  statusHistory: { orderBy: { timestamp: 'asc' } },
  materialsUsed: true
};

// Statuses awaiting review in the Maintainer Approval Queue (any Maintainer can act on these)
const APPROVAL_QUEUE_STATUSES = [
  'Indent Created',
  'Approved by Dept HOD',
  'Rejected by Maintenance HOD',
  'Rejected by Dept HOD',
  'Approved by Principal',
  'Rejected by Principal'
];

const getDashboardData = async (req, res) => {
  try {
    const assignedIndents = await prisma.indent.findMany({
      where: { maintainerId: req.user.id },
      include: DASHBOARD_INCLUDE,
      orderBy: { createdAt: 'desc' }
    });

    const approvalRequests = await prisma.indent.findMany({
      where: { status: { in: APPROVAL_QUEUE_STATUSES } },
      include: DASHBOARD_INCLUDE,
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({
      success: true,
      assignedIndents,
      approvalRequests
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update complaint details by Maintainer
// @route   PUT /api/maintainer/complaints/:id
// @access  Private (Maintainer view)
const updateComplaint = async (req, res) => {
  try {
    const { 
      assignedWorkerNames, 
      durationRequiredHours, 
      materialsUsed, 
      isMaintainerCompleted
    } = req.body;
    
    // Ensure the indent exists and is assigned to this maintainer
    const indent = await prisma.indent.findUnique({ 
      where: { id: req.params.id },
      include: { category: true }
    });
    
    if (!indent) {
      return res.status(404).json({ message: 'Indent not found' });
    }

    if (indent.maintainerId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You are not assigned to this indent.' });
    }

    const updateData = {};
    if (assignedWorkerNames) updateData.assignedWorkerNames = assignedWorkerNames;
    if (durationRequiredHours !== undefined) updateData.durationRequiredHours = durationRequiredHours;
    if (isMaintainerCompleted !== undefined) updateData.isMaintainerCompleted = isMaintainerCompleted;
    
    // Handle materialsUsed creation if provided
    if (materialsUsed !== undefined) {
      await prisma.materialUsed.deleteMany({ where: { indentId: indent.id } });
      if (materialsUsed.length > 0) {
        updateData.materialsUsed = {
          create: materialsUsed.map(m => ({ itemName: m.itemName, quantity: m.quantity, unit: m.unit }))
        };
      }
    }

    const updatedIndent = await prisma.indent.update({
      where: { id: indent.id },
      data: updateData,
      include: {
        category: { select: { name: true, inchargeId: true, incharge: { select: { id: true } } } },
        requester: { select: { name: true, email: true, department: true, staff_phone_no: true } },
        materialsUsed: true,
        statusHistory: { orderBy: { timestamp: 'asc' } }
      }
    });

    // Notify Maintenance HOD if the maintainer marked it as completed
    if (isMaintainerCompleted && !indent.isMaintainerCompleted) {
      if (indent.category && indent.category.inchargeId) {
        await sendNotification(
          indent.category.inchargeId,
          `Maintainer ${escapeHtml(req.user.name)} has completed work on Indent ${indent.indentNumber}. Please review and finalize.`,
          req.user.id,
          indent.id,
          indent.indentNumber
        );
      }
    }

    res.status(200).json({
      success: true,
      complaint: updatedIndent
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// Statuses a Maintainer is allowed to set an indent to via the review action
const REVIEW_TARGET_STATUSES = [
  'Approved by Dept HOD',
  'Approved by Maintenance HOD',
  'Rejected by Dept HOD',
  'Rejected by Maintenance HOD'
];

// @desc    Approve/Reject an indent from the Maintainer Approval Queue
// @route   PUT /api/maintainer/complaints/:id/review
// @access  Private (Maintainer view) - any Maintainer may act on any pending indent
const reviewIndent = async (req, res) => {
  try {
    const { status, rejectionReason, rejectedBy, location, natureOfWork, description } = req.body;

    if (!status || !REVIEW_TARGET_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid review status' });
    }

    const indent = await prisma.indent.findUnique({ where: { id: req.params.id } });
    if (!indent) {
      return res.status(404).json({ message: 'Indent not found' });
    }

    const updateData = {
      status,
      statusHistory: { create: [{ status }] }
    };
    if (rejectionReason !== undefined) updateData.rejectionReason = rejectionReason;
    if (rejectedBy !== undefined) updateData.rejectedBy = rejectedBy;
    if (location) updateData.location = location;
    if (natureOfWork) updateData.natureOfWork = natureOfWork;
    if (description) updateData.description = description;

    const updatedIndent = await prisma.indent.update({
      where: { id: indent.id },
      data: updateData,
      include: DASHBOARD_INCLUDE
    });

    const isRejection = status.startsWith('Rejected');
    await sendNotification(
      indent.requesterId,
      isRejection
        ? `Your indent ${indent.indentNumber} was rejected by a Maintainer. Reason: ${escapeHtml(rejectionReason || 'No reason provided')}`
        : `Your indent ${indent.indentNumber} was approved by a Maintainer and is progressing.`,
      req.user.id,
      indent.id,
      indent.indentNumber
    );

    res.status(200).json({
      success: true,
      complaint: updatedIndent
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Mark indent as completed by Maintainer with optional completion photo
// @route   PUT /api/maintainer/complaints/:id/complete
// @access  Private (Maintainer view)
const completeIndent = async (req, res) => {
  try {
    const indent = await prisma.indent.findUnique({
      where: { id: req.params.id },
      include: { category: true }
    });

    if (!indent) {
      return res.status(404).json({ message: 'Indent not found' });
    }

    if (indent.maintainerId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You are not assigned to this indent.' });
    }

    const assignedWorkerNames = parseJsonField(req.body.assignedWorkerNames, []);
    const materialsUsed = parseJsonField(req.body.materialsUsed, []);
    const durationRequiredHours = req.body.durationRequiredHours !== undefined && req.body.durationRequiredHours !== ''
      ? parseFloat(req.body.durationRequiredHours)
      : null;

    const updateData = {
      status: 'Completed',
      isMaintainerCompleted: true,
      assignedWorkerNames: Array.isArray(assignedWorkerNames) ? assignedWorkerNames : indent.assignedWorkerNames,
      durationRequiredHours,
      reasonForDelayedWork: req.body.reasonForDelayedWork !== undefined ? req.body.reasonForDelayedWork : indent.reasonForDelayedWork,
      remarksByIncharge: req.body.remarksByIncharge !== undefined ? req.body.remarksByIncharge : indent.remarksByIncharge,
      remarksByCoordinator: req.body.remarksByCoordinator !== undefined ? req.body.remarksByCoordinator : indent.remarksByCoordinator,
      statusHistory: { create: [{ status: 'Completed' }] }
    };

    if (req.file) {
      const uploadDir = process.env.UPLOAD_DIR || 'uploads';
      updateData.completionImagePath = `/${uploadDir}/${req.file.filename}`;
    }

    if (Array.isArray(materialsUsed)) {
      await prisma.materialUsed.deleteMany({ where: { indentId: indent.id } });
      const validMaterials = materialsUsed
        .filter(m => m && ((m.itemName && String(m.itemName).trim() !== '') || (m.quantity && String(m.quantity).trim() !== '')))
        .map(m => ({
          itemName: String(m.itemName || '').trim(),
          quantity: parseFloat(m.quantity) || 0,
          unit: m.unit || null
        }));

      if (validMaterials.length > 0) {
        updateData.materialsUsed = { create: validMaterials };
      }
    }

    const updatedIndent = await prisma.indent.update({
      where: { id: indent.id },
      data: updateData,
      include: {
        category: { select: { name: true, inchargeId: true, incharge: { select: { id: true, name: true } } } },
        requester: { select: { name: true, email: true, department: true, staff_phone_no: true } },
        materialsUsed: true,
        statusHistory: { orderBy: { timestamp: 'asc' } }
      }
    });

    await sendNotification(
      indent.requesterId,
      `Your indent ${indent.indentNumber} has been marked as Completed by Maintainer ${escapeHtml(req.user.name)}.`,
      req.user.id,
      indent.id,
      indent.indentNumber
    );

    if (indent.category && indent.category.inchargeId) {
      await sendNotification(
        indent.category.inchargeId,
        `Indent ${indent.indentNumber} has been completed by Maintainer ${escapeHtml(req.user.name)}.`,
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

module.exports = {
  getDashboardData,
  updateComplaint,
  reviewIndent,
  completeIndent
};

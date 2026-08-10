const prisma = require('../prismaClient');
const { sendNotification } = require('../utils/notificationService');

// @desc    Get dashboard indents for Maintainer
// @route   GET /api/maintainer/dashboard
// @access  Private (Maintainer view)
const DASHBOARD_INCLUDE = {
  category: { select: { name: true, incharge: { select: { id: true, name: true } } } },
  requester: { select: { name: true, email: true, department: true } },
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
        requester: { select: { name: true, email: true, department: true } },
        materialsUsed: true,
        statusHistory: { orderBy: { timestamp: 'asc' } }
      }
    });

    // Notify Maintenance HOD if the maintainer marked it as completed
    if (isMaintainerCompleted && !indent.isMaintainerCompleted) {
      if (indent.category && indent.category.inchargeId) {
        sendNotification(
          indent.category.inchargeId,
          `Maintainer ${req.user.name} has completed work on Indent ${indent.indentNumber}. Please review and finalize.`,
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
    sendNotification(
      indent.requesterId,
      isRejection
        ? `Your indent ${indent.indentNumber} was rejected by a Maintainer. Reason: ${rejectionReason || 'No reason provided'}`
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

module.exports = {
  getDashboardData,
  updateComplaint,
  reviewIndent
};

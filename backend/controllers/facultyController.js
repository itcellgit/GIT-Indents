const prisma = require('../prismaClient');
const generateIndentNumber = require('../utils/generateIndentNumber');
const { sendNotification, escapeHtml } = require('../utils/notificationService');
const { ROLES } = require('../utils/roles');

// @desc    Get dashboard data for a faculty user
// @route   GET /api/faculty/dashboard
// @access  Private (Faculty only)
const getDashboardData = async (req, res) => {
  try {
    const complaints = await prisma.indent.findMany({
      where: { requesterId: req.user.id },
      include: { 
        category: { select: { name: true } },
        requester: { select: { name: true } },
        statusHistory: { orderBy: { timestamp: 'asc' } },
        materialsUsed: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.status(200).json({
      success: true,
      user: {
        id: req.user.id,
        name: req.user.name,
        department: req.user.department,
        email: req.user.email
      },
      complaints
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Raise a new indent/complaint
// @route   POST /api/faculty/complaints
// @access  Private (Faculty only)
const createComplaint = async (req, res) => {
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
        statusHistory: {
          create: [
            { status: 'Indent Created' }
          ]
        }
      },
      include: { 
        category: { select: { name: true } },
        requester: { select: { name: true } },
        statusHistory: { orderBy: { timestamp: 'asc' } },
        materialsUsed: true
      }
    });

    try {
      if (categoryRecord.inchargeId) {
        await sendNotification(
          categoryRecord.inchargeId,
          `New indent ${newIndent.indentNumber} raised by ${escapeHtml(req.user.name)} requires your approval.`,
          req.user.id,
          newIndent.id,
          newIndent.indentNumber
        );
      }
    } catch (notifyErr) {
      console.error('Failed to notify Maintenance HOD in-charge about new faculty indent:', notifyErr);
    }

    try {
      const deptHODRows = await prisma.$queryRawUnsafe(
        `SELECT u.id
         FROM "User" u
         INNER JOIN public.user_roles ur ON ur.user_id = u.id
         INNER JOIN public.roles r ON r.id = ur.role_id
         WHERE r.role_name = $1 AND u.department = $2
         LIMIT 1`,
        ROLES.HOD,
        req.user.department
      );
      const deptHOD = deptHODRows[0] || null;

      if (deptHOD) {
        await sendNotification(
          deptHOD.id,
          `New indent ${newIndent.indentNumber} was raised by ${escapeHtml(req.user.name)} in your department.`,
          req.user.id,
          newIndent.id,
          newIndent.indentNumber
        );
      }
    } catch (notifyErr) {
      console.error('Failed to notify Dept HOD about new faculty indent:', notifyErr);
    }

    res.status(201).json({
      success: true,
      complaint: newIndent
    });
  } catch (err) {
    console.error('Faculty complaint creation failed:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getDashboardData,
  createComplaint
};

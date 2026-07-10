const prisma = require('../prismaClient');
const generateIndentNumber = require('../utils/generateIndentNumber');
const { sendNotification } = require('../utils/notificationService');

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
    console.error('Error fetching dashboard data:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Raise a new indent/complaint
// @route   POST /api/faculty/complaints
// @access  Private (Faculty only)
const createComplaint = async (req, res) => {
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

    const newIndent = await prisma.indent.create({
      data: {
        indentNumber,
        requesterId: req.user.id,
        categoryId: category,
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

    // Notify Department HOD
    const deptHOD = await prisma.user.findFirst({
      where: { role: 'HOD', department: req.user.department }
    });
    
    if (deptHOD) {
      await sendNotification(
        deptHOD.id,
        `New indent ${newIndent.indentNumber} raised by ${req.user.name} requires your approval.`,
        req.user.id,
        newIndent.id,
        newIndent.indentNumber
      );
    }

    res.status(201).json({
      success: true,
      complaint: newIndent
    });
  } catch (err) {
    console.error('Error creating complaint:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getDashboardData,
  createComplaint
};

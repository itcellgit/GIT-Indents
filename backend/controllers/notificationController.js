const prisma = require('../prismaClient');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { recipientId: req.user.id },
      include: {
        sender: { select: { name: true } },
        indent: { select: { indentNumber: true, status: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.status(200).json({
      success: true,
      notifications
    });
  } catch (err) {
    console.error('Error fetching notifications:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
  try {
    const notificationId = req.params.id;

    // Verify ownership
    const existing = await prisma.notification.findUnique({
      where: { id: notificationId }
    });

    if (!existing || existing.recipientId !== req.user.id) {
      return res.status(404).json({ message: 'Notification not found or unauthorized' });
    }

    const notification = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true }
    });

    res.status(200).json({
      success: true,
      notification
    });
  } catch (err) {
    console.error('Error marking notification as read:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getNotifications,
  markAsRead
};

// backend/controllers/categoryController.js
const prisma = require('../prismaClient');

// @desc    Get all categories for select dropdowns (Faculty/HOD forms)
// @route   GET /api/categories
// @access  Private
const getCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({ select: { id: true, name: true, description: true } });
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getCategories
};

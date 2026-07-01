// backend/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { 
  createDepartment, 
  updateDepartment,
  searchUsers, 
  getDepartmentsAdmin,
  getMonthlyReport,
  toggleUserStatus,
  getSystemStats,
  getAllUsers,
  getAllComplaints
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');

// Add an isAdmin middleware check here if available in the future.
// For now, protecting to ensure a user is logged in.

router.get('/stats', protect, getSystemStats);
router.get('/users', protect, getAllUsers);
router.put('/users/:id/status', protect, toggleUserStatus);
router.get('/complaints', protect, getAllComplaints);
router.get('/users/search', protect, searchUsers);
router.post('/departments', protect, createDepartment);
router.put('/departments/:id', protect, updateDepartment);
router.get('/departments', protect, getDepartmentsAdmin);
router.get('/reports', protect, getMonthlyReport);

module.exports = router;

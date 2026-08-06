// backend/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { 
  createDepartment, 
  updateDepartment,
  searchUsers, 
  getDepartmentsAdmin,
  getAllStationaries,
  createStationary,
  updateStationary,
  deleteStationary,
  getMonthlyReport,
  toggleUserStatus,
  getSystemStats,
  getAllUsers,
  getAllRoles,
  createUser,
  updateUser,
  getAllComplaints,
  bulkCreateUsers
  ,
  getAllCoordinators,
  getCoordinatorById,
  getCoordinatorAssignments,
  createCoordinatorAssignment,
  updateCoordinatorAssignment,
  createCoordinator,
  updateCoordinator,
  deleteCoordinator
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');

// Add an isAdmin middleware check here if available in the future.
// For now, protecting to ensure a user is logged in.

router.get('/stats', protect, getSystemStats);
router.get('/users', protect, getAllUsers);
router.get('/roles', protect, getAllRoles);
router.post('/users', protect, createUser);
router.put('/users/:id', protect, updateUser);
router.post('/users/bulk', protect, bulkCreateUsers);
router.put('/users/:id/status', protect, toggleUserStatus);
router.get('/complaints', protect, getAllComplaints);
router.get('/users/search', protect, searchUsers);
router.post('/departments', protect, createDepartment);
router.put('/departments/:id', protect, updateDepartment);
router.get('/departments', protect, getDepartmentsAdmin);
router.get('/stationaries', protect, getAllStationaries);
router.post('/stationaries', protect, createStationary);
router.put('/stationaries/:id', protect, updateStationary);
router.delete('/stationaries/:id', protect, deleteStationary);
router.get('/coordinators', protect, getAllCoordinators);
router.get('/coordinators/:id', protect, getCoordinatorById);
router.get('/coordinators/:id/assignments', protect, getCoordinatorAssignments);
router.post('/coordinators/:id/assignments', protect, createCoordinatorAssignment);
router.put('/coordinators/assignments/:assignmentId', protect, updateCoordinatorAssignment);
router.post('/coordinators', protect, createCoordinator);
router.put('/coordinators/:id', protect, updateCoordinator);
router.delete('/coordinators/:id', protect, deleteCoordinator);
router.get('/reports', protect, getMonthlyReport);

module.exports = router;

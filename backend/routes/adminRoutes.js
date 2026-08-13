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
  createRole,
  updateRole,
  deleteRole,
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
const { protect, authorize } = require('../middleware/authMiddleware');
const { ROLES } = require('../utils/roles');

// Roles that consume /admin/users outside the Admin dashboard (Principal search,
// HOD/Facility Provider picking Stationary Coordinator staff).
const USER_DIRECTORY_ROLES = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACILITY_PROVIDER];

// HOD/Facility Provider manage Stationary Coordinator staff for their own department
// via these same coordinator endpoints (see HODDashboard/ManageCoordinatorStaffs.jsx).
const COORDINATOR_STAFF_ROLES = [ROLES.ADMIN, ROLES.HOD, ROLES.FACILITY_PROVIDER];

// The stationery catalog is read/managed by Office_Stationary staff and by
// Faculty/Non-Teaching users acting as Stationary Coordinators, in addition to Admin.
const STATIONARY_CATALOG_ROLES = [ROLES.ADMIN, ROLES.FACULTY, ROLES.NON_TEACHING, ROLES.OFFICE_STATIONARY];

router.get('/stats', protect, authorize(ROLES.ADMIN), getSystemStats);
router.get('/users', protect, authorize(...USER_DIRECTORY_ROLES), getAllUsers);
router.get('/roles', protect, authorize(ROLES.ADMIN), getAllRoles);
router.post('/roles', protect, authorize(ROLES.ADMIN), createRole);
router.put('/roles/:id', protect, authorize(ROLES.ADMIN), updateRole);
router.delete('/roles/:id', protect, authorize(ROLES.ADMIN), deleteRole);
router.post('/users', protect, authorize(ROLES.ADMIN), createUser);
router.put('/users/:id', protect, authorize(ROLES.ADMIN), updateUser);
router.post('/users/bulk', protect, authorize(ROLES.ADMIN), bulkCreateUsers);
router.put('/users/:id/status', protect, authorize(ROLES.ADMIN), toggleUserStatus);
router.get('/complaints', protect, authorize(ROLES.ADMIN), getAllComplaints);
router.get('/users/search', protect, authorize(ROLES.ADMIN), searchUsers);
router.post('/departments', protect, authorize(ROLES.ADMIN), createDepartment);
router.put('/departments/:id', protect, authorize(ROLES.ADMIN), updateDepartment);
router.get('/departments', protect, authorize(ROLES.ADMIN), getDepartmentsAdmin);
router.get('/stationaries', protect, authorize(...STATIONARY_CATALOG_ROLES), getAllStationaries);
router.post('/stationaries', protect, authorize(...STATIONARY_CATALOG_ROLES), createStationary);
router.put('/stationaries/:id', protect, authorize(...STATIONARY_CATALOG_ROLES), updateStationary);
router.delete('/stationaries/:id', protect, authorize(...STATIONARY_CATALOG_ROLES), deleteStationary);
router.get('/coordinators', protect, authorize(...COORDINATOR_STAFF_ROLES), getAllCoordinators);
router.get('/coordinators/:id', protect, authorize(ROLES.ADMIN), getCoordinatorById);
router.get('/coordinators/:id/assignments', protect, authorize(...COORDINATOR_STAFF_ROLES), getCoordinatorAssignments);
router.post('/coordinators/:id/assignments', protect, authorize(...COORDINATOR_STAFF_ROLES), createCoordinatorAssignment);
router.put('/coordinators/assignments/:assignmentId', protect, authorize(ROLES.ADMIN), updateCoordinatorAssignment);
router.post('/coordinators', protect, authorize(ROLES.ADMIN), createCoordinator);
router.put('/coordinators/:id', protect, authorize(ROLES.ADMIN), updateCoordinator);
router.delete('/coordinators/:id', protect, authorize(ROLES.ADMIN), deleteCoordinator);
router.get('/reports', protect, authorize(ROLES.ADMIN), getMonthlyReport);

module.exports = router;

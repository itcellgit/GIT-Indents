const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { getDashboardData, createComplaint } = require('../controllers/facultyController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { ROLES } = require('../utils/roles');

// Dashboard route is protected and ONLY accessible to 'Faculty' and 'Admin' roles
router.get('/dashboard', protect, authorize(ROLES.FACULTY, ROLES.ADMIN, ROLES.HOD, ROLES.FACILITY_PROVIDER, ROLES.NON_TEACHING), getDashboardData);

// Raise new indent (with image upload)
router.post('/complaints', protect, authorize(ROLES.FACULTY, ROLES.ADMIN, ROLES.HOD, ROLES.FACILITY_PROVIDER, ROLES.NON_TEACHING), upload.single('image'), createComplaint);

module.exports = router;

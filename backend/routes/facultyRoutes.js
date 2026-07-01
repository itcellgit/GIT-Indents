const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { getDashboardData, createComplaint } = require('../controllers/facultyController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Dashboard route is protected and ONLY accessible to 'Faculty' and 'Admin' roles
router.get('/dashboard', protect, authorize('Faculty', 'Admin', 'HOD'), getDashboardData);

// Raise new indent (with image upload)
router.post('/complaints', protect, authorize('Faculty', 'Admin', 'HOD'), upload.single('image'), createComplaint);

module.exports = router;

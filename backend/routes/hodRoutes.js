const express = require('express');
const router = express.Router();
const { getHODComplaints, updateComplaintStatus, createHODIndent, getMaintainers, addMaintainer, assignMaintainer } = require('../controllers/hodController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// HOD Dashboard routes
router.get('/complaints', protect, authorize('HOD', 'Admin', 'Principal'), getHODComplaints);
router.post('/complaints', protect, authorize('HOD', 'Admin', 'Principal'), upload.single('image'), createHODIndent);
router.put('/complaints/:id/status', protect, authorize('HOD', 'Admin', 'Principal'), updateComplaintStatus);

// Maintainer Management
router.get('/maintainers', protect, authorize('HOD'), getMaintainers);
router.post('/maintainers', protect, authorize('HOD'), addMaintainer);
router.put('/complaints/:id/assign', protect, authorize('HOD'), assignMaintainer);

module.exports = router;

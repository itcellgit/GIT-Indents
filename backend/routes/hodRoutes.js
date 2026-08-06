const express = require('express');
const router = express.Router();
const { getHODComplaints, updateComplaintStatus, createHODIndent, getMaintainers, addMaintainer, assignMaintainer, removeMaintainer, getCoordinatorStaffs, addCoordinatorStaff, removeCoordinatorStaff } = require('../controllers/hodController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// HOD Dashboard routes
router.get('/complaints', protect, authorize('HOD', 'Admin', 'Principal'), getHODComplaints);
router.post('/complaints', protect, authorize('HOD', 'Admin', 'Principal'), upload.single('image'), createHODIndent);
router.put('/complaints/:id/status', protect, authorize('HOD', 'Admin', 'Principal'), updateComplaintStatus);

// Maintainer Management
router.get('/maintainers', protect, authorize('HOD'), getMaintainers);
router.post('/maintainers', protect, authorize('HOD'), addMaintainer);
router.delete('/maintainers/:id', protect, authorize('HOD'), removeMaintainer);
router.put('/complaints/:id/assign', protect, authorize('HOD'), assignMaintainer);

router.get('/coordinator-staffs', protect, authorize('HOD'), getCoordinatorStaffs);
router.post('/coordinator-staffs', protect, authorize('HOD'), addCoordinatorStaff);
router.delete('/coordinator-staffs/:id', protect, authorize('HOD'), removeCoordinatorStaff);

module.exports = router;

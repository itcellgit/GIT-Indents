const express = require('express');
const router = express.Router();
const { getHODComplaints, updateComplaintStatus, createHODIndent, getMaintainers, addMaintainer, assignMaintainer, removeMaintainer, getCoordinatorStaffs, addCoordinatorStaff, removeCoordinatorStaff } = require('../controllers/hodController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { ROLES } = require('../utils/roles');

// HOD Dashboard routes
router.get('/complaints', protect, authorize(ROLES.HOD, ROLES.FACILITY_PROVIDER, ROLES.ADMIN, ROLES.PRINCIPAL), getHODComplaints);
router.post('/complaints', protect, authorize(ROLES.HOD, ROLES.FACILITY_PROVIDER, ROLES.ADMIN, ROLES.PRINCIPAL), upload.single('image'), createHODIndent);
router.put('/complaints/:id/status', protect, authorize(ROLES.HOD, ROLES.FACILITY_PROVIDER, ROLES.ADMIN, ROLES.PRINCIPAL), updateComplaintStatus);

// Maintainer Management
router.get('/maintainers', protect, authorize(ROLES.HOD, ROLES.FACILITY_PROVIDER), getMaintainers);
router.post('/maintainers', protect, authorize(ROLES.HOD, ROLES.FACILITY_PROVIDER), addMaintainer);
router.delete('/maintainers/:id', protect, authorize(ROLES.HOD, ROLES.FACILITY_PROVIDER), removeMaintainer);
router.put('/complaints/:id/assign', protect, authorize(ROLES.HOD, ROLES.FACILITY_PROVIDER), assignMaintainer);

router.get('/coordinator-staffs', protect, authorize(ROLES.HOD, ROLES.FACILITY_PROVIDER), getCoordinatorStaffs);
router.post('/coordinator-staffs', protect, authorize(ROLES.HOD, ROLES.FACILITY_PROVIDER), addCoordinatorStaff);
router.delete('/coordinator-staffs/:id', protect, authorize(ROLES.HOD, ROLES.FACILITY_PROVIDER), removeCoordinatorStaff);

module.exports = router;

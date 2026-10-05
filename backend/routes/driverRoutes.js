const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getDrivers, toggleDriverAssignment, updateDriverProfile } = require('../controllers/driverController');
const { ROLES } = require('../utils/roles');

router.get('/', protect, authorize(ROLES.ADMIN, ROLES.TRANSPORT, ROLES.RECEPTIONIST), getDrivers);
router.put('/:id/profile', protect, authorize(ROLES.ADMIN, ROLES.TRANSPORT), updateDriverProfile);
router.patch('/:id/assignment', protect, authorize(ROLES.ADMIN, ROLES.TRANSPORT), toggleDriverAssignment);

module.exports = router;

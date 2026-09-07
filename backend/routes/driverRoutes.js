const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getDrivers, toggleDriverAssignment } = require('../controllers/driverController');
const { ROLES } = require('../utils/roles');

router.get('/', protect, authorize(ROLES.ADMIN, ROLES.TRANSPORT, ROLES.RECEPTIONIST), getDrivers);
router.patch('/:id/assignment', protect, authorize(ROLES.ADMIN, ROLES.TRANSPORT), toggleDriverAssignment);

module.exports = router;

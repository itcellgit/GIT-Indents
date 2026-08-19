const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getDrivers } = require('../controllers/driverController');
const { ROLES } = require('../utils/roles');

router.get('/', protect, authorize(ROLES.ADMIN, ROLES.TRANSPORT, ROLES.RECEPTIONIST), getDrivers);

module.exports = router;

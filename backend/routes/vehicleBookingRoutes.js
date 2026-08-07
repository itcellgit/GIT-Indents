const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getVehicleBookings, createVehicleBooking, updateVehicleBooking, deleteVehicleBooking } = require('../controllers/vehicleBookingController');
const { ROLES } = require('../utils/roles');

router.get('/', protect, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST), getVehicleBookings);
router.post('/', protect, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST), createVehicleBooking);
router.put('/:id', protect, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST), updateVehicleBooking);
router.delete('/:id', protect, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST), deleteVehicleBooking);

module.exports = router;

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getVehicleBookings, createVehicleBooking, updateVehicleBooking, deleteVehicleBooking, approveVehicleBooking, rejectVehicleBooking } = require('../controllers/vehicleBookingController');
const { ROLES } = require('../utils/roles');

const ALL_AUTHENTICATED_ROLES = [
  ROLES.ADMIN,
  ROLES.RECEPTIONIST,
  ROLES.FACULTY,
  ROLES.NON_TEACHING,
];

router.get('/', protect, authorize(...ALL_AUTHENTICATED_ROLES), getVehicleBookings);
router.post('/', protect, authorize(...ALL_AUTHENTICATED_ROLES), createVehicleBooking);
router.put('/:id', protect, authorize(...ALL_AUTHENTICATED_ROLES), updateVehicleBooking);
router.delete('/:id', protect, authorize(...ALL_AUTHENTICATED_ROLES), deleteVehicleBooking);
router.put('/:id/approve', protect, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST), approveVehicleBooking);
router.put('/:id/reject', protect, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST), rejectVehicleBooking);

module.exports = router;

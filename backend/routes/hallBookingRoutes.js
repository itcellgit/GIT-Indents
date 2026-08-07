const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getHallBookings, createHallBooking, updateHallBooking, deleteHallBooking, approveHallBooking, rejectHallBooking } = require('../controllers/hallBookingController');
const { ROLES } = require('../utils/roles');

const ALL_AUTHENTICATED_ROLES = [
  ROLES.ADMIN,
  ROLES.RECEPTIONIST,
  ROLES.FACULTY,
  ROLES.NON_TEACHING,
];

router.get('/', protect, authorize(...ALL_AUTHENTICATED_ROLES), getHallBookings);
router.post('/', protect, authorize(...ALL_AUTHENTICATED_ROLES), createHallBooking);
router.put('/:id', protect, authorize(...ALL_AUTHENTICATED_ROLES), updateHallBooking);
router.delete('/:id', protect, authorize(...ALL_AUTHENTICATED_ROLES), deleteHallBooking);
router.put('/:id/approve', protect, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST), approveHallBooking);
router.put('/:id/reject', protect, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST), rejectHallBooking);

module.exports = router;

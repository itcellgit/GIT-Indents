const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getHallBookings, createHallBooking, updateHallBooking, deleteHallBooking } = require('../controllers/hallBookingController');
const { ROLES } = require('../utils/roles');

router.get('/', protect, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST), getHallBookings);
router.post('/', protect, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST), createHallBooking);
router.put('/:id', protect, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST), updateHallBooking);
router.delete('/:id', protect, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST), deleteHallBooking);

module.exports = router;
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getBusBookings, createBusBooking, updateBusBooking, deleteBusBooking, approveBusBooking, rejectBusBooking } = require('../controllers/busBookingController');
const { ROLES } = require('../utils/roles');
const upload = require('../middleware/uploadMiddleware');

const ALL_AUTHENTICATED_ROLES = [
  ROLES.ADMIN,
  ROLES.TRANSPORT,
  ROLES.FACULTY,
  ROLES.NON_TEACHING,
  ROLES.HOD,
];

router.get('/', protect, authorize(...ALL_AUTHENTICATED_ROLES), getBusBookings);
router.post('/', protect, authorize(...ALL_AUTHENTICATED_ROLES), upload.single('attachment'), createBusBooking);
router.put('/:id', protect, authorize(...ALL_AUTHENTICATED_ROLES), upload.single('attachment'), updateBusBooking);
router.delete('/:id', protect, authorize(...ALL_AUTHENTICATED_ROLES), deleteBusBooking);
router.put('/:id/approve', protect, authorize(ROLES.ADMIN, ROLES.TRANSPORT), approveBusBooking);
router.put('/:id/reject', protect, authorize(ROLES.ADMIN, ROLES.TRANSPORT), rejectBusBooking);

module.exports = router;

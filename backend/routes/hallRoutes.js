const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getHalls, createHall, updateHall, deleteHall } = require('../controllers/hallController');
const { ROLES } = require('../utils/roles');

const HALL_MANAGEMENT_ROLES = [
  ROLES.ADMIN,
  ROLES.RECEPTIONIST,
];

router.get('/', protect, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.FACULTY, ROLES.NON_TEACHING), getHalls);
router.post('/', protect, authorize(...HALL_MANAGEMENT_ROLES), createHall);
router.put('/:id', protect, authorize(...HALL_MANAGEMENT_ROLES), updateHall);
router.delete('/:id', protect, authorize(...HALL_MANAGEMENT_ROLES), deleteHall);

module.exports = router;

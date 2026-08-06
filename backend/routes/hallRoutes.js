const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getHalls, createHall, updateHall, deleteHall } = require('../controllers/hallController');
const { ROLES } = require('../utils/roles');

router.get('/', protect, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST), getHalls);
router.post('/', protect, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST), createHall);
router.put('/:id', protect, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST), updateHall);
router.delete('/:id', protect, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST), deleteHall);

module.exports = router;
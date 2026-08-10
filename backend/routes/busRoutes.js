const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getBuses, createBus, updateBus, deleteBus } = require('../controllers/busController');
const { ROLES } = require('../utils/roles');

router.get('/', protect, authorize(ROLES.ADMIN, ROLES.TRANSPORT), getBuses);
router.post('/', protect, authorize(ROLES.ADMIN, ROLES.TRANSPORT), createBus);
router.put('/:id', protect, authorize(ROLES.ADMIN, ROLES.TRANSPORT), updateBus);
router.delete('/:id', protect, authorize(ROLES.ADMIN, ROLES.TRANSPORT), deleteBus);

module.exports = router;

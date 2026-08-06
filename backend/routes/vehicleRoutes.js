const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getVehicles, createVehicle, updateVehicle, deleteVehicle } = require('../controllers/vehicleController');
const { ROLES } = require('../utils/roles');

router.get('/', protect, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST), getVehicles);
router.post('/', protect, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST), createVehicle);
router.put('/:id', protect, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST), updateVehicle);
router.delete('/:id', protect, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST), deleteVehicle);

module.exports = router;
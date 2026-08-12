const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getStationaryIndents,
  createStationaryIndent,
  updateStationaryIndent,
  deleteStationaryIndent
} = require('../controllers/stationaryIndentController');
const { ROLES } = require('../utils/roles');

const STATIONARY_ROLES = [ROLES.ADMIN, ROLES.FACULTY, ROLES.HOD, ROLES.FACILITY_PROVIDER, ROLES.NON_TEACHING, ROLES.OFFICE_STATIONARY];

router.get('/', protect, authorize(...STATIONARY_ROLES), getStationaryIndents);
router.post('/', protect, authorize(...STATIONARY_ROLES), createStationaryIndent);
router.put('/:id', protect, authorize(...STATIONARY_ROLES), updateStationaryIndent);
router.delete('/:id', protect, authorize(...STATIONARY_ROLES), deleteStationaryIndent);

module.exports = router;
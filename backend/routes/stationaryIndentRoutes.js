const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getStationaryIndents,
  createStationaryIndent,
  updateStationaryIndent,
  deleteStationaryIndent
} = require('../controllers/stationaryIndentController');

router.get('/', protect, authorize('Admin', 'Faculty', 'HOD', 'Non-Teaching', 'Office_Stationary'), getStationaryIndents);
router.post('/', protect, authorize('Admin', 'Faculty', 'HOD', 'Non-Teaching', 'Office_Stationary'), createStationaryIndent);
router.put('/:id', protect, authorize('Admin', 'Faculty', 'HOD', 'Non-Teaching', 'Office_Stationary'), updateStationaryIndent);
router.delete('/:id', protect, authorize('Admin', 'Faculty', 'HOD', 'Non-Teaching', 'Office_Stationary'), deleteStationaryIndent);

module.exports = router;
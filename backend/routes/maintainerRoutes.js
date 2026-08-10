const express = require('express');
const router = express.Router();
const { getDashboardData, updateComplaint, reviewIndent } = require('../controllers/maintainerController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/dashboard', protect, authorize('Maintainer'), getDashboardData);
router.put('/complaints/:id', protect, authorize('Maintainer'), updateComplaint);
router.put('/complaints/:id/review', protect, authorize('Maintainer'), reviewIndent);

module.exports = router;

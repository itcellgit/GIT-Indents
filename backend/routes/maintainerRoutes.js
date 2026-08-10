const express = require('express');
const router = express.Router();
const { getDashboardData, updateComplaint, reviewIndent, completeIndent } = require('../controllers/maintainerController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.get('/dashboard', protect, authorize('Maintainer'), getDashboardData);
router.put('/complaints/:id', protect, authorize('Maintainer'), updateComplaint);
router.put('/complaints/:id/review', protect, authorize('Maintainer'), reviewIndent);
router.put('/complaints/:id/complete', protect, authorize('Maintainer'), upload.single('completionImage'), completeIndent);

module.exports = router;

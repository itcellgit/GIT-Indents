const express = require('express');
const router = express.Router();
const { getDashboardData, updateComplaint, reviewIndent, completeIndent } = require('../controllers/maintainerController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { ROLES } = require('../utils/roles');

router.get('/dashboard', protect, authorize(ROLES.MAINTAINER), getDashboardData);
router.put('/complaints/:id', protect, authorize(ROLES.MAINTAINER), updateComplaint);
router.put('/complaints/:id/review', protect, authorize(ROLES.MAINTAINER), reviewIndent);
router.put('/complaints/:id/complete', protect, authorize(ROLES.MAINTAINER), upload.single('completionImage'), completeIndent);

module.exports = router;

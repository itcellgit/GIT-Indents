const express = require('express');
const router = express.Router();
const { getDashboardData, updateComplaint, reviewIndent, completeIndent } = require('../controllers/maintainerController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { ROLES } = require('../utils/roles');

const allowCompletionPhotoAccess = (req, res, next) => {
	const isEpmcLogin = String(req.user?.email || '').toLowerCase() === 'epmc@git.edu';
	if (req.user?.role === ROLES.MAINTAINER || isEpmcLogin) {
		return next();
	}

	return res.status(403).json({ message: 'User role is not authorized to access this route' });
};

router.get('/dashboard', protect, authorize(ROLES.MAINTAINER), getDashboardData);
router.put('/complaints/:id', protect, authorize(ROLES.MAINTAINER), updateComplaint);
router.put('/complaints/:id/review', protect, authorize(ROLES.MAINTAINER), reviewIndent);
router.put('/complaints/:id/complete', protect, allowCompletionPhotoAccess, upload.single('completionImage'), completeIndent);

module.exports = router;

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getBranches, createBranch, updateBranch, deleteBranch } = require('../controllers/branchController');
const { ROLES } = require('../utils/roles');

router.get('/', protect, getBranches);
router.post('/', protect, authorize(ROLES.ADMIN, ROLES.HOD, ROLES.FACILITY_PROVIDER, ROLES.NON_TEACHING), createBranch);
router.put('/:id', protect, authorize(ROLES.ADMIN, ROLES.HOD, ROLES.FACILITY_PROVIDER, ROLES.NON_TEACHING), updateBranch);
router.delete('/:id', protect, authorize(ROLES.ADMIN, ROLES.HOD, ROLES.FACILITY_PROVIDER, ROLES.NON_TEACHING), deleteBranch);

module.exports = router;

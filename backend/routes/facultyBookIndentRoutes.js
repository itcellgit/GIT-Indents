const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  createBookIndent,
  getMyBookIndents,
  getAllBookIndents,
  updateBookIndent,
  deleteBookIndent,
  reviewBookIndent,
  markBookIndentArrived,
} = require('../controllers/facultyBookIndentController');
const { ROLES } = require('../utils/roles');

router.post('/', protect, authorize(ROLES.FACULTY), createBookIndent);
router.get('/mine', protect, authorize(ROLES.FACULTY), getMyBookIndents);
router.get('/', protect, authorize(ROLES.ADMIN, ROLES.HOD, ROLES.FACILITY_PROVIDER, ROLES.NON_TEACHING), getAllBookIndents);
router.put('/:id/review', protect, authorize(ROLES.ADMIN, ROLES.HOD, ROLES.NON_TEACHING), reviewBookIndent);
router.put('/:id/arrived', protect, authorize(ROLES.ADMIN, ROLES.HOD, ROLES.NON_TEACHING), markBookIndentArrived);
router.put('/:id', protect, authorize(ROLES.FACULTY), updateBookIndent);
router.delete('/:id', protect, authorize(ROLES.FACULTY), deleteBookIndent);

module.exports = router;

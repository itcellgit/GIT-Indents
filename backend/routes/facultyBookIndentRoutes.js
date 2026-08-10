const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  createBookIndent,
  getMyBookIndents,
  getAllBookIndents,
  updateBookIndent,
  deleteBookIndent,
  updateBookIndentStatus,
} = require('../controllers/facultyBookIndentController');
const { ROLES } = require('../utils/roles');

router.post('/', protect, authorize(ROLES.FACULTY), createBookIndent);
router.get('/mine', protect, authorize(ROLES.FACULTY), getMyBookIndents);
router.get('/', protect, authorize(ROLES.ADMIN, ROLES.HOD), getAllBookIndents);
router.put('/:id/status', protect, authorize(ROLES.ADMIN, ROLES.HOD), updateBookIndentStatus);
router.put('/:id', protect, authorize(ROLES.FACULTY), updateBookIndent);
router.delete('/:id', protect, authorize(ROLES.FACULTY), deleteBookIndent);

module.exports = router;

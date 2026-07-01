// backend/routes/categoryRoutes.js
const express = require('express');
const router = express.Router();
const { getCategories } = require('../controllers/categoryController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getCategories);

module.exports = router;

// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { registerUser, verifyRegistration, resendRegistrationOtp, loginUser, getLogin, getRegister, logoutUser, forgotPassword, resetPassword, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// --- GET ROUTES (For testing/info) ---
router.get('/register', getRegister);
router.get('/login', getLogin);
router.post('/logout', logoutUser); // Secure logout removing cookie

// --- POST ROUTES (For actual authentication) ---
// Register payload validation
router.post('/register', [
  check('name', 'Name is required').not().isEmpty().trim().escape(),
  check('email', 'Please include a valid email').isEmail().normalizeEmail(),
  check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
], registerUser);

// Verify Registration OTP
router.post('/verify-registration', [
  check('email', 'Please include a valid email').isEmail().normalizeEmail(),
  check('otp', 'OTP is required').exists()
], verifyRegistration);

// Resend Registration OTP
router.post('/resend-registration-otp', [
  check('email', 'Please include a valid email').isEmail().normalizeEmail()
], resendRegistrationOtp);

// Login payload validation
router.post('/login', [
  check('email', 'Please include a valid email').isEmail().normalizeEmail(),
  check('password', 'Password is required').exists()
], loginUser);

// Forgot password
router.post('/forgot-password', [
  check('email', 'Please include a valid email').isEmail().normalizeEmail()
], forgotPassword);

// Reset password
router.post('/reset-password', [
  check('email', 'Please include a valid email').isEmail().normalizeEmail(),
  check('otp', 'OTP is required').exists(),
  check('newPassword', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
], resetPassword);

// Profile page update
router.put('/profile', protect, updateProfile);

module.exports = router;
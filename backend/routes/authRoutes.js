// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { registerUser, verifyRegistration, resendRegistrationOtp, loginUser, getLogin, getRegister, logoutUser, forgotPassword, resetPassword, changePassword, updateProfile, switchUserRole } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { PASSWORD_POLICY_MESSAGE, isPasswordValid } = require('../utils/passwordPolicy');

const passwordCheck = (field) => check(field, PASSWORD_POLICY_MESSAGE).custom(isPasswordValid);

// --- GET ROUTES (For testing/info) ---
router.get('/register', getRegister);
router.get('/login', getLogin);
router.post('/logout', logoutUser); // Secure logout removing cookie

// --- POST ROUTES (For actual authentication) ---
// Register payload validation
router.post('/register', [
  check('name', 'Name is required').not().isEmpty().trim().escape(),
  check('email', 'Please include a valid email').isEmail().normalizeEmail(),
  passwordCheck('password')
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
  passwordCheck('newPassword')
], resetPassword);

// Change password (while logged in)
router.put('/change-password', protect, [
  check('currentPassword', 'Current password is required').exists(),
  passwordCheck('newPassword')
], changePassword);

// Profile page update
router.put('/profile', protect, updateProfile);
router.post('/switch-role', protect, switchUserRole);

module.exports = router;
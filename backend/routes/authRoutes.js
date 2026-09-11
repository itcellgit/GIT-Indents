// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { registerUser, verifyRegistration, resendRegistrationOtp, loginUser, getLogin, getRegister, logoutUser, forgotPassword, resetPassword, changePassword, updateProfile, switchUserRole, getMe, impersonateUser, stopImpersonation } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { ROLES } = require('../utils/roles');
const { PASSWORD_POLICY_MESSAGE, isPasswordValid } = require('../utils/passwordPolicy');

// Tighter limit for the impersonation endpoints than the global API limiter.
const impersonationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many impersonation requests, please slow down.',
});

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
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/switch-role', protect, switchUserRole);

// Impersonation. `/stop` must be declared before `/:userId` so it isn't captured
// as a target id. `/stop` is protect-only on purpose (see controller comment);
// starting requires a genuine Admin token, which an impersonation token never is.
router.post('/impersonate/stop', protect, impersonationLimiter, stopImpersonation);
router.post('/impersonate/:userId', protect, authorize(ROLES.ADMIN), impersonationLimiter, impersonateUser);

module.exports = router;
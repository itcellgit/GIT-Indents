// backend/controllers/authController.js
const prisma = require('../prismaClient');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const { ROLES, normalizeRole } = require('../utils/roles');
const { transporter } = require('../utils/notificationService');

// Cryptographically strong 6-digit OTP (Math.random() is predictable and unsuitable for security codes).
const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

// Per-email OTP verification attempt limiting, backed by DB columns (PendingRegistration
// .otpAttempts/.otpLockedUntil, User.resetPasswordAttempts/.resetPasswordLockedUntil) so
// the lockout survives a server restart. A lock is intentionally NOT cleared by requesting
// a new OTP (register/resend/forgot-password all leave attempts/lockedUntil untouched), or
// an attacker could reset their guess budget indefinitely by spamming those endpoints.
const MAX_OTP_ATTEMPTS = 5;
const OTP_LOCKOUT_MS = 15 * 60 * 1000;

const isOtpLocked = (lockedUntil) => Boolean(lockedUntil && lockedUntil > new Date());

// Returns the {attempts, lockedUntil} to persist after a failed OTP check.
const nextOtpFailureState = (currentAttempts, currentLockedUntil) => {
  const attempts = currentAttempts + 1;
  return {
    attempts,
    lockedUntil: attempts >= MAX_OTP_ATTEMPTS ? new Date(Date.now() + OTP_LOCKOUT_MS) : currentLockedUntil
  };
};

const checkCoordinatorStaff = async (user) => {
  if (!user || (user.role !== ROLES.FACULTY && user.role !== ROLES.NON_TEACHING)) {
    return false;
  }

  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1
     FROM public.coordinator_staffs
     WHERE staff_id = $1
       AND COALESCE(status, 'Active') <> 'Inactive'
     LIMIT 1`,
    String(user.id)
  );

  return Array.isArray(rows) && rows.length > 0;
};

const getUserRolesById = async (userId) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT r.role_name AS role
     FROM public.user_roles ur
     INNER JOIN public.roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1
     ORDER BY r.id ASC`,
    userId
  );

  return rows.map((row) => row.role).filter(Boolean);
};

// Helper function to generate a JWT token
// No fallback secret here on purpose — server.js refuses to start if JWT_SECRET
// isn't set, so a token forged with a guessable default is never possible.
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

// Password hash is only ever selected when a caller explicitly opts in via
// includePassword (only bcrypt.compare call sites need it — see 7.1 in
// TECHNICAL_AUDIT_REPORT.md). Every other caller gets a user object that
// structurally cannot leak the hash, even if it's later spread into a response.
const getNormalizedAuthUser = async (id, activeRole = null, includePassword = false) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT
       u.id,
       u.name,
       u.email,
       ${includePassword ? 'u.password,' : ''}
       u.department,
       u."isActive" AS "isActive",
       COALESCE(
         (
           SELECT r.role_name
           FROM public.user_roles ur
           INNER JOIN public.roles r ON r.id = ur.role_id
           WHERE ur.user_id = u.id
           ORDER BY r.id ASC
           LIMIT 1
         ),
         '${ROLES.FACULTY}'
       ) AS role
     FROM "User" u
     WHERE u.id = $1
     LIMIT 1`,
    id
  );

  const user = rows[0] || null;
  if (!user) return null;

  const roles = await getUserRolesById(id);
  const role = activeRole && roles.includes(activeRole) ? activeRole : (roles[0] || user.role);

  return { ...user, roles, role };
};

const getAuthUserByEmail = async (email, { includePassword = false } = {}) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT u.id
     FROM "User" u
     WHERE u.email = $1
     LIMIT 1`,
    email
  );

  return rows[0] ? getNormalizedAuthUser(rows[0].id, null, includePassword) : null;
};

const getAuthUserById = async (id, { includePassword = false } = {}) => getNormalizedAuthUser(id, null, includePassword);

const getRoleIdByName = async (roleName) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id
     FROM public.roles
     WHERE role_name = $1
     LIMIT 1`,
    roleName
  );

  return rows[0]?.id || null;
};

// Helper function to send token response
// `secure`/`sameSite` are derived from the actual request (req.secure), not NODE_ENV,
// because this backend is reachable both over plain-HTTP internal IP and over the
// HTTPS domain at the same time — a NODE_ENV-only check would mark cookies Secure
// even for the plain-HTTP path and silently break login there. req.secure reflects
// X-Forwarded-Proto from the reverse proxy once 'trust proxy' is enabled in server.js.
const sendTokenResponse = (req, user, statusCode, res, effectiveRole = null, extraData = {}) => {
  const roleToShow = effectiveRole || user.role;
  const token = generateToken(user.id, roleToShow);

  const isSecureRequest = req.secure;
  const options = {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    httpOnly: true,
    secure: isSecureRequest,
    sameSite: isSecureRequest ? 'none' : 'lax',
    path: '/',
    domain: undefined
  };

  res.status(statusCode).cookie('token', token, options).json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: roleToShow,
    roles: user.roles || [user.role].filter(Boolean),
    department: user.department,
    token,
    ...extraData
  });
};

// @desc    Register a new user (sends OTP)
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, email, password, department, role } = req.body;

    const userExists = await getAuthUserByEmail(email);
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' }); // Generic message
    }

    const finalRole = normalizeRole(role);

    // Generate a 6-digit numeric OTP
    const otp = generateOtp();

    // Hash the password now, at registration time — never keep a plaintext
    // password around, even temporarily, while OTP verification is pending.
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Persisted (not an in-memory Map) so a server restart mid-signup doesn't
    // force the user to start over. Re-registering with the same email deliberately
    // leaves otpAttempts/otpLockedUntil untouched (only set on create, omitted from
    // update) — same reasoning as resend below.
    await prisma.pendingRegistration.upsert({
      where: { email },
      create: {
        email,
        name,
        password: hashedPassword,
        department: department || '',
        role: finalRole,
        otp,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
      },
      update: {
        name,
        password: hashedPassword,
        department: department || '',
        role: finalRole,
        otp,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
      }
    });

    const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

    if (!smtpUser) {
      console.log('No SMTP_USER configured. Generated OTP is:', otp);
      return res.status(200).json({ message: 'OTP generated (Check server console, email not configured)' });
    }

    const mailOptions = {
      from: smtpUser,
      to: email,
      subject: 'Registration Verification OTP',
      text: `Your OTP for registration verification is: ${otp}. It is valid for 15 minutes.`
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error('Registration OTP email failed:', emailError.message);
      return res.status(500).json({ message: 'Failed to send OTP email' });
    }
    res.status(200).json({ message: 'OTP sent to email' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error during registration' });
  }
};

// @desc    Verify Registration OTP and Create User
// @route   POST /api/auth/verify-registration
// @access  Public
const verifyRegistration = async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const pendingUser = await prisma.pendingRegistration.findUnique({ where: { email } });

    if (!pendingUser) {
      return res.status(400).json({ message: 'Registration session expired or not found' });
    }

    if (isOtpLocked(pendingUser.otpLockedUntil)) {
      return res.status(429).json({ message: 'Too many incorrect attempts. Please try again later.' });
    }

    if (pendingUser.otp !== otp || pendingUser.expiresAt < new Date()) {
      const { attempts, lockedUntil } = nextOtpFailureState(pendingUser.otpAttempts, pendingUser.otpLockedUntil);
      await prisma.pendingRegistration.update({
        where: { email },
        data: { otpAttempts: attempts, otpLockedUntil: lockedUntil }
      });
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const roleId = await getRoleIdByName(pendingUser.role);
    if (!roleId) {
      return res.status(400).json({ message: 'Invalid role selected' });
    }

    // Built from what we already have rather than re-querying via getAuthUserById()
    // inside the transaction — that helper reads through the outer (non-tx) prisma
    // client, so it can't see this transaction's own uncommitted insert and would
    // always return null here, wrongly failing an otherwise-successful registration.
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: pendingUser.name,
          email: pendingUser.email,
          password: pendingUser.password, // already bcrypt-hashed at registration time
          department: pendingUser.department
        },
        select: { id: true, name: true, email: true, department: true }
      });

      await tx.$executeRawUnsafe(
        `INSERT INTO public.user_roles (user_id, role_id)
         VALUES ($1, $2)`,
        createdUser.id,
        roleId
      );

      await tx.pendingRegistration.delete({ where: { email } });

      return { ...createdUser, role: pendingUser.role, roles: [pendingUser.role] };
    });

    if (user) {
      sendTokenResponse(req, user, 201, res);
    } else {
      res.status(400).json({ message: 'Invalid user data received' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error during registration verification' });
  }
};

// @desc    Resend Registration OTP
// @route   POST /api/auth/resend-registration-otp
// @access  Public
const resendRegistrationOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const pendingUser = await prisma.pendingRegistration.findUnique({ where: { email } });
    if (!pendingUser) {
      return res.status(400).json({ message: 'No pending registration found for this email. Please register again.' });
    }

    // Generate a new 6-digit numeric OTP. otpAttempts/otpLockedUntil deliberately
    // untouched — see comment on registerUser's upsert.
    const otp = generateOtp();
    await prisma.pendingRegistration.update({
      where: { email },
      data: { otp, expiresAt: new Date(Date.now() + 15 * 60 * 1000) }
    });

    const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

    if (!smtpUser) {
      console.log('No SMTP_USER configured. Generated OTP is:', otp);
      return res.status(200).json({ message: 'New OTP generated (Check server console, email not configured)' });
    }

    const mailOptions = {
      from: smtpUser,
      to: email,
      subject: 'Registration Verification OTP (Resend)',
      text: `Your new OTP for registration verification is: ${otp}. It is valid for 15 minutes.`
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error('Resend OTP email failed:', emailError.message);
      return res.status(500).json({ message: 'Failed to send OTP email' });
    }
    res.status(200).json({ message: 'New OTP sent to email' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error during OTP resend' });
  }
};

// @desc    Authenticate (Login) user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password } = req.body;

    const user = await getAuthUserByEmail(email, { includePassword: true });

    if (user && user.password && (await bcrypt.compare(password, user.password))) {
      let effectiveRole = user.role;

      // Category incharges (Faculty/Non-Teaching/HOD assigned to manage a maintenance
      // category) are shown as 'Facility Provider', distinct from an academic Dept HOD.
      if (user.role === ROLES.FACULTY || user.role === ROLES.NON_TEACHING || user.role === ROLES.HOD) {
        const category = await prisma.category.findFirst({ where: { inchargeId: user.id } });
        if (category) {
          effectiveRole = ROLES.FACILITY_PROVIDER;
        }
      }

      const isCoordinatorStaff = await checkCoordinatorStaff(user);
      sendTokenResponse(req, user, 200, res, effectiveRole, { isCoordinatorStaff });
    } else {
      res.status(401).json({ message: 'Invalid credentials' }); // Generic error message
    }
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ message: 'Server error during authentication' });
  }
};

// @desc    Log out user / clear cookie
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: req.secure,
    sameSite: req.secure ? 'none' : 'lax',
    path: '/'
  });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

// @desc    Get Login Page/Info
// @route   GET /api/auth/login
// @access  Public
const getLogin = (req, res) => {
  res.json({ message: 'Login endpoint reached.' });
};

// @desc    Get Register Page/Info
// @route   GET /api/auth/register
// @access  Public
const getRegister = (req, res) => {
  res.json({ message: 'Register endpoint reached.' });
};

// @desc    Forgot Password (Send OTP)
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await getAuthUserByEmail(email);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate a 6-digit numeric OTP
    const otp = generateOtp();

    // Set OTP and expiration (15 minutes)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordOTP: otp,
        resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000)
      }
    });

    const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

    if (!smtpUser) {
      console.log('No SMTP_USER configured. Generated OTP is:', otp);
      return res.status(200).json({ message: 'OTP generated (Check server console, email not configured)' });
    }

    const mailOptions = {
      from: smtpUser,
      to: user.email,
      subject: 'Password Reset OTP',
      text: `Your OTP for password reset is: ${otp}. It is valid for 15 minutes.`
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error('Password reset OTP email failed:', emailError.message);
      return res.status(500).json({ message: 'Failed to send OTP email' });
    }
    res.status(200).json({ message: 'OTP sent to email' });

  } catch (error) {
    res.status(500).json({ message: 'Error sending email' });
  }
};

// @desc    Reset Password (Verify OTP and update)
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Look up by email alone first (not combined with the OTP in one query,
    // like before) so we can read this user's own attempt/lock state. Password
    // hash isn't needed here (a new one gets set below) — excluded from select.
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        resetPasswordOTP: true,
        resetPasswordExpires: true,
        resetPasswordAttempts: true,
        resetPasswordLockedUntil: true
      }
    });

    if (!user || !user.resetPasswordOTP) {
      // Same generic message as a wrong OTP — don't reveal whether the email exists.
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    if (isOtpLocked(user.resetPasswordLockedUntil)) {
      return res.status(429).json({ message: 'Too many incorrect attempts. Please try again later.' });
    }

    const isValidOtp = user.resetPasswordOTP === otp
      && user.resetPasswordExpires
      && user.resetPasswordExpires > new Date();

    if (!isValidOtp) {
      const { attempts, lockedUntil } = nextOtpFailureState(user.resetPasswordAttempts, user.resetPasswordLockedUntil);
      await prisma.user.update({
        where: { id: user.id },
        data: { resetPasswordAttempts: attempts, resetPasswordLockedUntil: lockedUntil }
      });
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordOTP: null,
        resetPasswordExpires: null,
        resetPasswordAttempts: 0,
        resetPasswordLockedUntil: null
      }
    });

    res.status(200).json({ message: 'Password reset successful' });

  } catch (error) {
    res.status(500).json({ message: 'Server error during password reset' });
  }
};

// @desc    Change password (while logged in)
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { currentPassword, newPassword } = req.body;

    const user = await getAuthUserById(req.user.id, { includePassword: true });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error while changing password' });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { name, email, department } = req.body;
    
    // Check if email already exists for another user
    if (email && email !== req.user.email) {
      const emailExists = await prisma.user.findUnique({ where: { email } });
      if (emailExists) {
        return res.status(400).json({ message: 'Email is already in use by another user' });
      }
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: name || undefined,
        email: email || undefined,
        department: department !== undefined ? department : undefined,
      }
    });

    const updatedUser = await getAuthUserById(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during profile update' });
  }
};

const switchUserRole = async (req, res) => {
  try {
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ message: 'Role is required' });
    }

    const user = await getAuthUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!Array.isArray(user.roles) || !user.roles.includes(role)) {
      return res.status(403).json({ message: 'Selected role is not assigned to this user' });
    }

    const isCoordinatorStaff = await checkCoordinatorStaff(user);
    sendTokenResponse(req, user, 200, res, role, { isCoordinatorStaff });
  } catch (error) {
    res.status(500).json({ message: 'Server error while switching role' });
  }
};

module.exports = {
  registerUser,
  verifyRegistration,
  resendRegistrationOtp,
  loginUser,
  logoutUser,
  getLogin,
  getRegister,
  forgotPassword,
  resetPassword,
  changePassword,
  updateProfile,
  switchUserRole,
};
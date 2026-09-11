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

// --- Impersonation ("View as user") support -------------------------------
//
// An impersonation token is a normal JWT with two differences:
//   1. a short lifetime (IMPERSONATION_TOKEN_TTL, default 45m) — a troubleshooting
//      window, not a 30-day session; and
//   2. an `imp.sid` claim naming a row in public.impersonation_sessions. The claim
//      is signed with JWT_SECRET (unforgeable), and `protect` re-reads that row on
//      every request, so a stopped/expired session is rejected immediately.
// `id`/`role` in the payload are the *target* user's, so `protect` + `authorize`
// treat the request exactly as if the target had logged in — the admin holds no
// elevated access while impersonating.
const IMPERSONATION_TOKEN_TTL = process.env.IMPERSONATION_TOKEN_TTL || '45m';
const IMPERSONATION_SESSION_MAX_AGE_MS = 45 * 60 * 1000;

// The token only names a session id; the authoritative record (who, target,
// expiry, whether it is still open) lives in public.impersonation_sessions and
// is re-checked by `protect` on every request. That is what makes "Stop"
// an immediate server-side revocation and not just a client-side discard.
const generateImpersonationToken = (targetId, targetRole, sessionId) =>
  jwt.sign(
    { id: targetId, role: targetRole, imp: { sid: sessionId } },
    process.env.JWT_SECRET,
    { expiresIn: IMPERSONATION_TOKEN_TTL }
  );

// Same cookie attributes sendTokenResponse/logoutUser use — derived from the
// actual request protocol, not NODE_ENV (this backend serves plain-HTTP and
// HTTPS at once).
const authCookieOptions = (req) => ({
  httpOnly: true,
  secure: req.secure,
  sameSite: req.secure ? 'none' : 'lax',
  path: '/',
  domain: undefined,
});

// @desc    Start impersonating a user (admin only)
// @route   POST /api/auth/impersonate/:userId
// @access  Private (Admin)
const impersonateUser = async (req, res) => {
  try {
    // No nesting: an impersonation token already has a non-Admin role, so
    // authorize(ADMIN) on the route rejects this first — this is the backstop.
    if (req.impersonation) {
      return res.status(409).json({ message: 'Already impersonating. Stop the current session first.' });
    }

    const { userId } = req.params;
    if (!userId || userId === req.user.id) {
      return res.status(400).json({ message: 'Invalid target user' });
    }

    const target = await getAuthUserById(userId);
    if (!target) {
      return res.status(404).json({ message: 'Target user not found' });
    }
    if (!target.isActive) {
      return res.status(403).json({ message: 'Cannot impersonate a disabled user' });
    }

    const targetRoles = Array.isArray(target.roles) ? target.roles : [];
    // An admin must not be able to slip into another admin's context.
    if (targetRoles.includes(ROLES.ADMIN)) {
      return res.status(403).json({ message: 'Administrator accounts cannot be impersonated' });
    }

    const impersonator = { id: req.user.id, name: req.user.name };
    const targetRole = targetRoles[0] || target.role;

    // The session row must exist before the token is usable — if this insert
    // fails, deliberately let it 500 rather than issue a token with no backing
    // session (which `protect` would then reject anyway).
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + IMPERSONATION_SESSION_MAX_AGE_MS);
    await prisma.$executeRawUnsafe(
      `INSERT INTO public.impersonation_sessions
         (id, admin_id, admin_name, target_id, target_name, target_role, ip, user_agent, expires_at)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)`,
      sessionId,
      String(impersonator.id),
      impersonator.name || null,
      String(target.id),
      target.name || null,
      targetRole || null,
      req.ip || null,
      (req.headers['user-agent'] || '').slice(0, 500) || null,
      expiresAt
    );

    const token = generateImpersonationToken(target.id, targetRole, sessionId);
    const isCoordinatorStaff = await checkCoordinatorStaff(target);

    res
      .cookie('token', token, {
        ...authCookieOptions(req),
        expires: expiresAt,
      })
      .status(200)
      .json({
        id: target.id,
        name: target.name,
        email: target.email,
        role: targetRole,
        roles: targetRoles.length ? targetRoles : [targetRole].filter(Boolean),
        department: target.department,
        token,
        isCoordinatorStaff,
        impersonating: true,
        impersonator,
      });
  } catch (error) {
    console.error('Impersonation start failed:', error);
    res.status(500).json({ message: 'Server error starting impersonation' });
  }
};

// @desc    Stop impersonating and revert to the original admin session
// @route   POST /api/auth/impersonate/stop
// @access  Private (any authenticated user; only meaningful mid-impersonation)
//
// Deliberately NOT guarded by authorize(ADMIN): while impersonating, req.user.role
// is the target's role. Authorization here is the signed `imp` claim plus a live
// re-check that the original admin still exists, is active, and still holds Admin.
const stopImpersonation = async (req, res) => {
  try {
    if (!req.impersonation) {
      return res.status(400).json({ message: 'No active impersonation session' });
    }

    // Revoke the session first — from this point the impersonation token is dead
    // regardless of what happens below.
    await prisma.$executeRawUnsafe(
      `UPDATE public.impersonation_sessions
       SET ended_at = now(), end_reason = COALESCE(end_reason, 'stopped')
       WHERE id = $1::uuid AND ended_at IS NULL`,
      req.impersonation.sessionId
    );

    const admin = await getAuthUserById(req.impersonation.adminId);
    const adminRoles = admin && Array.isArray(admin.roles) ? admin.roles : [];

    if (!admin || !admin.isActive || !adminRoles.includes(ROLES.ADMIN)) {
      // Original admin was deleted / disabled / demoted while impersonating.
      // Don't hand back an admin token — force a clean re-login.
      await prisma.$executeRawUnsafe(
        `UPDATE public.impersonation_sessions SET end_reason = 'admin_invalid' WHERE id = $1::uuid`,
        req.impersonation.sessionId
      );
      res.clearCookie('token', authCookieOptions(req));
      return res.status(403).json({
        message: 'Original administrator session is no longer valid. Please log in again.',
      });
    }

    const isCoordinatorStaff = await checkCoordinatorStaff(admin);
    // Fresh, full-lifetime admin token with NO `imp` claim.
    sendTokenResponse(req, admin, 200, res, ROLES.ADMIN, { isCoordinatorStaff, impersonating: false });
  } catch (error) {
    console.error('Impersonation stop failed:', error);
    res.status(500).json({ message: 'Server error stopping impersonation' });
  }
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

// @desc    Return the current user's fresh identity (name, department, active role
//          and the full list of assigned roles). The frontend calls this on load
//          so a role added/removed since the last login shows up (e.g. the Profile
//          role switcher appears) without forcing a re-login.
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await getAuthUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Keep the active role the token was issued for, as long as it is still one
    // of the user's assigned roles; otherwise fall back to the normalized default.
    const activeRole = req.user.role && Array.isArray(user.roles) && user.roles.includes(req.user.role)
      ? req.user.role
      : user.role;

    const isCoordinatorStaff = await checkCoordinatorStaff(user);

    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department,
      role: activeRole,
      roles: user.roles || [activeRole].filter(Boolean),
      isCoordinatorStaff,
      // So a page reload during impersonation re-hydrates the banner from the
      // (server-signed) token rather than trusting client-held state.
      impersonating: Boolean(req.impersonation),
      impersonator: req.impersonation
        ? { id: req.impersonation.adminId, name: req.impersonation.adminName }
        : null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error while loading profile' });
  }
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
  getMe,
  impersonateUser,
  stopImpersonation,
};
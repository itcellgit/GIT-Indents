// backend/controllers/authController.js
const prisma = require('../prismaClient');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const { ROLES, normalizeRole } = require('../utils/roles');

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
const generateToken = (id, role) => {
  const jwtSecret = process.env.JWT_SECRET || 'dev_jwt_secret';
  return jwt.sign({ id, role }, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

const getNormalizedAuthUser = async (id, activeRole = null) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT
       u.id,
       u.name,
       u.email,
       u.password,
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
         'Faculty'
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

const getAuthUserByEmail = async (email) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT u.id
     FROM "User" u
     WHERE u.email = $1
     LIMIT 1`,
    email
  );

  return rows[0] ? getNormalizedAuthUser(rows[0].id) : null;
};

const getAuthUserById = async (id) => getNormalizedAuthUser(id);

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
const sendTokenResponse = (user, statusCode, res, effectiveRole = null, extraData = {}) => {
  const roleToShow = effectiveRole || user.role;
  const token = generateToken(user.id, roleToShow);

  const isLocalNetwork = process.env.NODE_ENV !== 'production';
  const options = {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
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

const pendingRegistrations = new Map(); // Store registration details and OTP temporarily

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

    let finalRole = normalizeRole(role);

    // Generate a 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in pendingRegistrations
    pendingRegistrations.set(email, {
      name,
      email,
      password,
      department: department || '',
      role: finalRole,
      otp,
      expiresAt: Date.now() + 15 * 60 * 1000 // 15 mins
    });

    const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

    // If smtpUser is not set, log it to console to allow testing without credentials
    if (!smtpUser) {
      console.log('No SMTP_USER configured. Generated OTP is:', otp);
      return res.status(200).json({ message: 'OTP generated (Check server console, email not configured)' });
    }

    // Send email using nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    const mailOptions = {
      from: smtpUser,
      to: email,
      subject: 'Registration Verification OTP',
      text: `Your OTP for registration verification is: ${otp}. It is valid for 15 minutes.`
    };

    await transporter.sendMail(mailOptions);
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

    const pendingUser = pendingRegistrations.get(email);
    
    if (!pendingUser) {
      return res.status(400).json({ message: 'Registration session expired or not found' });
    }
    
    if (pendingUser.otp !== otp || pendingUser.expiresAt < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(pendingUser.password, salt);

    const roleId = await getRoleIdByName(pendingUser.role);
    if (!roleId) {
      return res.status(400).json({ message: 'Invalid role selected' });
    }

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: pendingUser.name,
          email: pendingUser.email,
          password: hashedPassword,
          department: pendingUser.department
        }
      });

      await tx.$executeRawUnsafe(
        `INSERT INTO public.user_roles (user_id, role_id)
         VALUES ($1, $2)`,
        createdUser.id,
        roleId
      );

      return getAuthUserById(createdUser.id);
    });

    pendingRegistrations.delete(email);

    if (user) {
      sendTokenResponse(user, 201, res);
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

    const pendingUser = pendingRegistrations.get(email);
    if (!pendingUser) {
      return res.status(400).json({ message: 'No pending registration found for this email. Please register again.' });
    }

    // Generate a new 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Update in pendingRegistrations
    pendingRegistrations.set(email, {
      ...pendingUser,
      otp,
      expiresAt: Date.now() + 15 * 60 * 1000 // Reset to 15 mins
    });

    const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

    if (!smtpUser) {
      console.log('No SMTP_USER configured. Generated OTP is:', otp);
      return res.status(200).json({ message: 'New OTP generated (Check server console, email not configured)' });
    }

    // Send email using nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    const mailOptions = {
      from: smtpUser,
      to: email,
      subject: 'Registration Verification OTP (Resend)',
      text: `Your new OTP for registration verification is: ${otp}. It is valid for 15 minutes.`
    };

    await transporter.sendMail(mailOptions);
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

    // Use .select('+password') if password selection is false by default in schema (though it's true currently)
    const user = await getAuthUserByEmail(email);

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
      sendTokenResponse(user, 200, res, effectiveRole, { isCoordinatorStaff });
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
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

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

    // If smtpUser is not set, log it to console to allow testing without credentials
    if (!smtpUser) {
      console.log('No SMTP_USER configured. Generated OTP is:', otp);
      return res.status(200).json({ message: 'OTP generated (Check server console, email not configured)' });
    }

    // Send email using nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail', // You can change this or configure it via env
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    const mailOptions = {
      from: smtpUser,
      to: user.email,
      subject: 'Password Reset OTP',
      text: `Your OTP for password reset is: ${otp}. It is valid for 15 minutes.`
    };

    await transporter.sendMail(mailOptions);
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

    const user = await prisma.user.findFirst({ 
      where: {
        email, 
        resetPasswordOTP: otp,
        resetPasswordExpires: { gt: new Date() } // Ensure OTP hasn't expired
      }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordOTP: null,
        resetPasswordExpires: null
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

    const user = await getAuthUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
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
    sendTokenResponse(user, 200, res, role, { isCoordinatorStaff });
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
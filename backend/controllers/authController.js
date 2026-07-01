// backend/controllers/authController.js
const prisma = require('../prismaClient');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const nodemailer = require('nodemailer');

// Helper function to generate a JWT token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

// Helper function to send token response
const sendTokenResponse = (user, statusCode, res, effectiveRole = null) => {
  const roleToShow = effectiveRole || user.role;
  const token = generateToken(user.id, roleToShow);

  const options = {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  };

  res.status(statusCode).cookie('token', token, options).json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: roleToShow,
    department: user.department
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, email, password, department, role } = req.body;

    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' }); // Generic message
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let finalRole = role || 'Faculty';
    const isHodEmail = email.toLowerCase().startsWith('hod');

    if (isHodEmail) {
      finalRole = 'HOD';
    } else if (role === 'HOD') {
      return res.status(400).json({ message: "HOD role requires email starting with 'hod'" });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        department: department || '', // Default to empty string if not provided
        role: finalRole,
      }
    });

    if (user) {
      sendTokenResponse(user, 201, res);
    } else {
      res.status(400).json({ message: 'Invalid user data received' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error during registration' });
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
    const user = await prisma.user.findUnique({ where: { email } });

    if (user && (await bcrypt.compare(password, user.password))) {
      let effectiveRole = user.role;
      
      // Check if Faculty is an incharge of any department
      if (user.role === 'Faculty') {
        const category = await prisma.category.findFirst({ where: { inchargeId: user.id } });
        if (category) {
          effectiveRole = 'HOD';
        }
      }

      sendTokenResponse(user, 200, res, effectiveRole);
    } else {
      res.status(401).json({ message: 'Invalid credentials' }); // Generic error message
    }
  } catch (error) {
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
    const user = await prisma.user.findUnique({ where: { email } });

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

    // If EMAIL_USER is not set, log it to console to allow testing without credentials
    if (!process.env.EMAIL_USER) {
      console.log('No EMAIL_USER configured. Generated OTP is:', otp);
      return res.status(200).json({ message: 'OTP generated (Check server console, email not configured)' });
    }

    // Send email using nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail', // You can change this or configure it via env
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Password Reset OTP',
      text: `Your OTP for password reset is: ${otp}. It is valid for 15 minutes.`
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'OTP sent to email' });

  } catch (error) {
    console.error('Forgot password error:', error);
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
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error during password reset' });
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

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: name || undefined,
        email: email || undefined,
        department: department !== undefined ? department : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error during profile update' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getLogin,
  getRegister,
  forgotPassword,
  resetPassword,
  updateProfile,
};
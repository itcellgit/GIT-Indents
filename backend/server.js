// backend/server.js (Restarted to load Prisma client)
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

// Load environment variables from your .env file
dotenv.config();

// Initialize the Express application
const app = express();
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

// --- SERVE UPLOADED FILES ---
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
app.use(`/${uploadDir}`, express.static(path.join(__dirname, uploadDir)));

// Database connection is managed by Prisma Client in the controllers

// --- MIDDLEWARE (Security Layer 2 & 3) ---
// 1. Set secure HTTP headers
app.use(helmet());

// Configure Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per `window`
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});
// Apply rate limiter to all API requests
app.use('/api', limiter);

// 2. Allow cross-origin requests with credentials (cookies)
app.use(cors({ 
  origin: process.env.FRONTEND_URL || 'http://localhost:5173', 
  credentials: true 
}));

// 3. Parse JSON & Cookies
app.use(express.json({ limit: '10mb' })); // Limit body size
app.use(cookieParser());

// 4. Data Sanitization
// Removed mongoSanitize as we are using PostgreSQL with Prisma
// --- IMPORT ROUTES ---
const authRoutes = require('./routes/authRoutes');
const facultyRoutes = require('./routes/facultyRoutes');
const adminRoutes = require('./routes/adminRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const hodRoutes = require('./routes/hodRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const maintainerRoutes = require('./routes/maintainerRoutes');

// --- MOUNT ROUTES ---
// Every route inside authRoutes.js will automatically start with /api/auth
app.use('/api/auth', authRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/hod', hodRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/maintainer', maintainerRoutes);

// A simple test route to verify the server is running when you visit localhost:5000 in your browser
app.get('/', (req, res) => {
  res.send('GIT Maintenance System Backend is up and running!');
});

// --- START SERVER ---
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
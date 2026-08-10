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

// 2. Allow cross-origin requests with credentials (cookies)
const allowAllOrigins = process.env.ALLOW_ALL_ORIGINS === 'true';
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://0.0.0.0:5173',
  'http://10.22.0.151:5173',
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(origin => origin.trim()).filter(Boolean) : [])
];

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  try {
    const { hostname } = new URL(origin);
    const isLocalNetworkHost = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname)
      || hostname.startsWith('192.168.')
      || hostname.startsWith('10.')
      || hostname.startsWith('172.');

    return allowAllOrigins || isLocalNetworkHost || allowedOrigins.includes(origin);
  } catch {
    return allowAllOrigins;
  }
};

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
}));

// Configure Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Allow normal dashboard polling without false positives
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});
// Apply rate limiter to all API requests except preflight requests
app.use('/api', (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  limiter(req, res, next);
});

// 3. Parse JSON & Cookies
app.use(express.json({ limit: '10mb' })); // Limit body size
app.use(cookieParser());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://10.22.0.151:5173');
  next();
});

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
const stationaryIndentRoutes = require('./routes/stationaryIndentRoutes');
const hallRoutes = require('./routes/hallRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const hallBookingRoutes = require('./routes/hallBookingRoutes');
const vehicleBookingRoutes = require('./routes/vehicleBookingRoutes');
const busRoutes = require('./routes/busRoutes');
const busBookingRoutes = require('./routes/busBookingRoutes');
const branchRoutes = require('./routes/branchRoutes');
const facultyBookIndentRoutes = require('./routes/facultyBookIndentRoutes');

// --- MOUNT ROUTES ---
// Every route inside authRoutes.js will automatically start with /api/auth
app.use('/api/auth', authRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/hod', hodRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/maintainer', maintainerRoutes);
app.use('/api/stationary-indents', stationaryIndentRoutes);
app.use('/api/halls', hallRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/hall-bookings', hallBookingRoutes);
app.use('/api/vehicle-bookings', vehicleBookingRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/bus-bookings', busBookingRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/faculty-book-indents', facultyBookIndentRoutes);

// A simple test route to verify the server is running when you visit localhost:5000 in your browser
app.get('/', (req, res) => {
  res.send('GIT Maintenance System Backend is up and running!');
});

// --- START SERVER ---
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌐 Network access enabled at http://${HOST}:${PORT}`);
});
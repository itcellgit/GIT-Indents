const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');

// Protect routes
const protect = async (req, res, next) => {
  let token;

  // 1. Try to get token from cookies
  if (req.cookies && req.cookies.token && req.cookies.token !== 'none') {
    token = req.cookies.token;
  } 
  // 2. Fallback to Authorization header if testing from tools like Postman
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({ message: 'Not authorized to access this route' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Set req.user to the user extracted from DB
    req.user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    if (!req.user) {
      return res.status(401).json({ message: 'User belonging to token does not exist' });
    }

    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `User role '${req.user ? req.user.role : 'unknown'}' is not authorized to access this route`
      });
    }
    next();
  };
};

module.exports = { protect, authorize };

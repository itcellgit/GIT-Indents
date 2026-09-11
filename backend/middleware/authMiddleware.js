const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');
const { ROLES } = require('../utils/roles');

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

    const users = await prisma.$queryRawUnsafe(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.department,
         u."isActive" AS "isActive",
         u."createdAt" AS "createdAt",
         u."updatedAt" AS "updatedAt",
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
      decoded.id
    );

    // Set req.user to the user extracted from DB
    req.user = users[0] || null;
    
    if (!req.user) {
      return res.status(401).json({ message: 'User belonging to token does not exist' });
    }

    if (decoded.role) {
      const roleRows = await prisma.$queryRawUnsafe(
        `SELECT r.role_name AS role
         FROM public.user_roles ur
         INNER JOIN public.roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1
         ORDER BY r.id ASC`,
        decoded.id
      );

      const allowedRoles = roleRows.map((row) => row.role);
      if (allowedRoles.includes(decoded.role)) {
        req.user.role = decoded.role;
      }
    }

    // Surface an active impersonation session. The `imp.sid` claim is part of the
    // server-signed JWT (cannot be forged), and the session row it points at is
    // the authority on whether the session is still live — so "Stop Impersonation"
    // takes effect immediately, server-side, even though the JWT itself is still
    // within its 45-minute validity window. While impersonating, req.user is the
    // *impersonated* user (id + role); every downstream authorize() check sees the
    // target's role, so the admin holds no elevated access.
    if (decoded.imp && decoded.imp.sid) {
      const sessionRows = await prisma.$queryRawUnsafe(
        `SELECT admin_id, admin_name, ended_at, expires_at
         FROM public.impersonation_sessions
         WHERE id = $1::uuid
         LIMIT 1`,
        decoded.imp.sid
      );

      const session = sessionRows[0];
      if (!session || session.ended_at || new Date(session.expires_at) <= new Date()) {
        return res.status(401).json({ message: 'Impersonation session has ended. Please sign in again.' });
      }

      req.impersonation = {
        sessionId: decoded.imp.sid,
        adminId: session.admin_id,
        adminName: session.admin_name || null,
      };
      req.user.impersonatorId = session.admin_id;
    }

    next();
  } catch (err) {
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

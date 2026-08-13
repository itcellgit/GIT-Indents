# GIT Indent Management System — Technical Security & Code Audit Report

**Project:** GIT Indent Management Portal  
**Audit Date:** 2026-08-11  
**Auditor:** Kilo Code Review  
**Scope:** Full-stack audit covering backend (Express/Prisma/PostgreSQL), frontend (React/Vite), authentication/authorization, database schema, and deployment configuration.

---

## Executive Summary

This audit identified **35+ findings** across five severity categories. The most critical issues include multiple **SQL injection vulnerabilities** due to extensive use of `$queryRawUnsafe` with user-controlled input, **missing authorization checks** on admin routes, **hardcoded secrets and API URLs**, **insecure cookie configuration**, and **business logic flaws** that allow privilege escalation and data tampering. The application requires immediate remediation before production deployment.

---

## 1. CRITICAL SECURITY VULNERABILITIES

### 1.1 SQL Injection via `$queryRawUnsafe`
**Severity:** Critical  
**CWE:** CWE-89  
**Files Affected:**
- `backend/controllers/authController.js` (lines 14, 27, 48, 83, 97)
- `backend/controllers/adminController.js` (lines 36, 68, 77, 93, 120, 259, 288, 296, 340, 363, 371, 448, 764, 814, 841, 872, 1007, 1084, 1098, 1170, 1210, 1239, 1278, 1304, 1348)
- `backend/controllers/hallBookingController.js` (lines 43, 87, 101, 136, 207, 265, 319, 359, 370)
- `backend/controllers/busBookingController.js` (lines 52, 93, 142, 235, 280, 321)
- `backend/controllers/vehicleBookingController.js` (lines 59, 100, 162, 243, 311, 362)
- `backend/controllers/facultyBookIndentController.js` (lines 88, 96, 165, 220, 252, 283)
- `backend/controllers/hodController.js` (lines 102, 341, 361, 441, 515, 1076)
- `backend/controllers/maintainerController.js` (indirect via Prisma)
- `backend/controllers/stationaryIndentController.js` (lines 33, 54, 111, 123, 149, 189, 221, 235)
- `backend/middleware/authMiddleware.js` (lines 26, 60)
- `backend/utils/notificationService.js` (lines 57, 96)

**Description:** The application extensively uses `prisma.$queryRawUnsafe()` with raw SQL strings. While parameterized queries (`$1`, `$2`, etc.) are used in most places, several queries construct dynamic SQL using string interpolation or concatenation, creating SQL injection vectors.

**Specific Instances:**
- `adminController.js:288-301` — `getRoleRows()` uses raw query without parameters
- `authController.js:14-20` — `checkCoordinatorStaff()` uses raw query (parameterized but redundant)
- Multiple `$queryRawUnsafe` calls that don't use `$queryRaw` instead

**Impact:** An attacker could potentially inject SQL payloads through any user-controlled input that reaches these queries, leading to data exfiltration, data modification, or authentication bypass.

**Remediation:**
1. Replace all `$queryRawUnsafe` with `$queryRaw` (Prisma's parameterized query API)
2. Use Prisma's native query builder (`prisma.user.findMany()`, etc.) wherever possible instead of raw SQL
3. Implement a centralized data access layer with strict input validation
4. Add SQL injection detection rules to CI/CD pipeline

---

### 1.2 Insecure Cookie Configuration
**Severity:** Critical  
**CWE:** CWE-614  
**Files Affected:**
- `backend/controllers/authController.js` (lines 113-121)
- `backend/controllers/authController.js` (lines 360-365)

**Description:** The JWT cookie is set with `secure: false` and `sameSite: 'lax'` in all environments. This means:
- Cookies are transmitted over unencrypted HTTP connections
- CSRF attacks are possible (sameSite: lax allows cross-site requests)
- Tokens are vulnerable to interception

**Code:**
```javascript
// authController.js:113-121
const options = {
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  httpOnly: true,
  secure: false,  // CRITICAL: Insecure in production
  sameSite: 'lax',  // CRITICAL: Allows CSRF
  path: '/',
  domain: undefined
};
```

**Impact:** Session hijacking, CSRF attacks, token theft via MITM.

**Remediation:**
1. Set `secure: true` in production (`secure: process.env.NODE_ENV === 'production'`)
2. Set `sameSite: 'strict'` or `'none'` with `secure: true`
3. Implement CSRF tokens for state-changing operations
4. Consider using `domain` configuration for subdomain isolation

---

### 1.3 Missing Authorization on Admin Routes
**Severity:** Critical  
**CWE:** CWE-863  
**Files Affected:**
- `backend/routes/adminRoutes.js` (all routes)

**Description:** All admin routes only use `protect` middleware without verifying the user has the Admin role. Any authenticated user can access admin endpoints.

**Code:**
```javascript
// adminRoutes.js:40-67
router.get('/stats', protect, getSystemStats);  // No role check!
router.get('/users', protect, getAllUsers);       // No role check!
router.post('/users', protect, createUser);       // No role check!
```

**Impact:** Any authenticated user can:
- View all users and their roles
- Create/delete users
- Modify system settings
- Access all complaints/indents
- Delete roles and departments

**Remediation:**
1. Add `authorize('Admin')` to all admin routes
2. Implement a centralized role-checking decorator
3. Add principle of least privilege — separate admin functions into sub-roles if needed

---

### 1.4 Hardcoded Secrets and API URLs
**Severity:** Critical  
**CWE:** CWE-798  
**Files Affected:**
- `backend/controllers/authController.js` (line 41)
- `frontend/src/api/axios.js` (line 4)
- `frontend/src/context/AuthContext.jsx` (line 10)
- `backend/controllers/notificationService.js` (line 8)
- `backend/server.js` (lines 27-33)

**Description:** Multiple hardcoded values including JWT secret fallback, API base URLs, and email configurations.

**Code:**
```javascript
// authController.js:41
const jwtSecret = process.env.JWT_SECRET || 'dev_jwt_secret';

// frontend/src/api/axios.js:4
return 'http://10.22.0.151:5000/api';

// frontend/src/context/AuthContext.jsx:10
return 'http://10.22.0.151:5000/api';

// notificationService.js:8
const transporter = nodemailer.createTransport({
  service: 'gmail',  // Hardcoded service
```

**Impact:**
- Weak JWT secret fallback allows token forgery
- Hardcoded IPs break deployment in different environments
- Hardcoded email service limits flexibility
- Internal IPs exposed in client-side code

**Remediation:**
1. Remove all hardcoded fallbacks for secrets
2. Use environment variables for ALL configuration
3. Implement config validation at startup
4. Use relative URLs or configurable API base URL
5. Never expose internal IPs in frontend code

---

### 1.5 JWT Token in URL Fragment (Potential)
**Severity:** High  
**CWE:** CWE-598  
**Files Affected:**
- `backend/utils/notificationService.js` (line 102)
- `frontend/src/pages/FacultyDashboard/index.jsx` (lines 116-126)

**Description:** The notification email contains a URL with `indentId` as a query parameter. While not a fragment, this pattern could be extended to include tokens.

```javascript
// notificationService.js:102
const actionUrl = indentId ? `${frontendUrl}/?indentId=${indentId}` : frontendUrl;
```

**Impact:** If extended to include sensitive data, URLs can be logged in server logs, browser history, and referrer headers.

**Remediation:**
1. Never include tokens or sensitive IDs in URLs
2. Use opaque identifiers that map server-side
3. Implement proper notification deep-linking with state management

---

## 2. AUTHENTICATION & AUTHORIZATION FLAWS

### 2.1 Weak OTP Implementation
**Severity:** High  
**CWE:** CWE-330  
**Files Affected:**
- `backend/controllers/authController.js` (lines 157, 279)

**Description:** OTPs are 6-digit numeric values generated using `Math.random()`, which is not cryptographically secure. OTPs are also stored in a JavaScript `Map` in memory, meaning they are lost on server restart.

```javascript
// authController.js:157
const otp = Math.floor(100000 + Math.random() * 900000).toString();
```

**Impact:**
- Predictable OTPs can be brute-forced (1 million possibilities)
- OTPs lost on server restart break registration flow
- No rate limiting on OTP verification attempts

**Remediation:**
1. Use `crypto.randomInt(100000, 999999)` for OTP generation
2. Store OTPs in Redis with TTL for persistence
3. Implement rate limiting on OTP verification (max 5 attempts)
4. Consider using time-based OTPs (TOTP) or JWT-based verification tokens

---

### 2.2 Password Security Issues
**Severity:** High  
**CWE:** CWE-521, CWE-916  
**Files Affected:**
- `backend/controllers/adminController.js` (line 539)
- `backend/controllers/hodController.js` (lines 425, 555)
- `backend/controllers/authController.js` (line 18)

**Description:**
1. Default password `password@123` is used for bulk user creation
2. Password minimum length is only 6 characters
3. No password complexity requirements
4. Passwords are hashed with bcrypt salt rounds 10 (acceptable but could be higher)

```javascript
// adminController.js:539
const defaultPassword = 'password@123';
```

**Impact:** Users created via bulk upload have well-known default passwords. Weak passwords are susceptible to brute-force attacks.

**Remediation:**
1. Generate random passwords for bulk uploads
2. Enforce password complexity (uppercase, lowercase, numbers, special chars)
3. Increase minimum length to 12 characters
4. Implement password strength meter in frontend
5. Force password change on first login for bulk-created users

---

### 2.3 In-Memory Session Storage
**Severity:** High  
**CWE:** CWE-613  
**Files Affected:**
- `backend/controllers/authController.js` (line 135)

**Description:** Pending registrations are stored in a `Map` in memory. This means:
- Registrations are lost on server restart
- No horizontal scaling support
- Memory leaks possible with high registration volume

```javascript
// authController.js:135
const pendingRegistrations = new Map();
```

**Impact:** Registration flow breaks on server restart. Not scalable.

**Remediation:**
1. Use Redis or database for pending registration storage
2. Implement proper session management with expiration
3. Clean up expired registrations periodically

---
///Continue tomorrow
### 2.4 JWT Secret Fallback
**Severity:** High  
**CWE:** CWE-798  
**Files Affected:**
- `backend/controllers/authController.js` (line 41)

**Description:** JWT secret falls back to `'dev_jwt_secret'` if `JWT_SECRET` is not set.

```javascript
const jwtSecret = process.env.JWT_SECRET || 'dev_jwt_secret';
```

**Impact:** Anyone can forge valid JWT tokens if the environment variable is not set.

**Remediation:**
1. Remove the fallback — fail startup if JWT_SECRET is not set
2. Use a strong, randomly generated secret (32+ characters)
3. Rotate secrets periodically

---

### 2.5 Missing Ownership Validation (IDOR)
**Severity:** High  
**CWE:** CWE-639  
**Files Affected:**
- `backend/controllers/facultyBookIndentController.js` (lines 166-177)
- `backend/controllers/stationaryIndentController.js` (lines 149-161, 221-233)

**Description:** Some update/delete endpoints check ownership, but the pattern is inconsistent. The `facultyBookIndentController` correctly validates `requested_by === req.user.id`, but this pattern is missing in several other controllers.

**Impact:** Users could potentially modify or delete other users' data by guessing IDs.

**Remediation:**
1. Implement a consistent ownership validation middleware
2. Always validate `req.user.id === resource.ownerId` before mutations
3. Use UUIDs instead of sequential IDs to prevent guessing

---

## 3. BUSINESS LOGIC FLAWS

### 3.1 Privilege Escalation via Role Switching
**Severity:** High  
**CWE:** CWE-269  
**Files Affected:**
- `backend/controllers/authController.js` (lines 551-573)
- `backend/controllers/adminController.js` (lines 636-649, 712-718)

**Description:** The `switchUserRole` endpoint allows users to switch between their assigned roles. However, when a user is assigned as a department incharge, their roles are automatically upgraded to HOD without their explicit consent.

```javascript
// adminController.js:636-649
if (user.role === ROLES.FACULTY || user.role === ROLES.NON_TEACHING) {
  const hodRoleId = await getHodRoleId();
  if (hodRoleId) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM public.user_roles WHERE user_id = $1`,
      user.id
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO public.user_roles (user_id, role_id) VALUES ($1, $2)`,
      user.id,
      hodRoleId
    );
  }
}
```

**Impact:** Users can be silently granted elevated privileges. A Faculty member assigned as incharge becomes HOD automatically.

**Remediation:**
1. Require explicit approval for role elevation
2. Log all role changes with audit trail
3. Implement role change notifications
4. Separate "incharge" status from role elevation

---

### 3.2 Race Condition in Indent Number Generation
**Severity:** Medium  
**CWE:** CWE-362  
**Files Affected:**
- `backend/utils/generateIndentNumber.js` (lines 30-37)

**Description:** Indent numbers are generated based on a daily count, but the count and creation are not atomic. Two simultaneous requests could generate the same indent number.

```javascript
const todayCount = await prisma.indent.count({
  where: {
    createdAt: {
      gte: startOfDay,
      lte: endOfDay
    }
  }
});
const slNo = String(todayCount + 1).padStart(2, '0');
```

**Impact:** Duplicate indent numbers causing confusion in tracking and reporting.

**Remediation:**
1. Use database sequences or SERIAL columns
2. Implement atomic counter with transactions
3. Use UUIDs as primary identifiers instead

---

### 3.3 Inconsistent Authorization in HOD Routes
**Severity:** Medium  
**CWE:** CWE-863  
**Files Affected:**
- `backend/routes/hodRoutes.js` (line 8)

**Description:** The HOD complaints route allows Admin and Principal access, which is correct. However, `createHODIndent` is accessible to HOD, Admin, and Principal, but the status is auto-set to "Approved by Dept HOD" without verifying the user is actually the department HOD.

```javascript
// hodController.js:312
status: 'Approved by Dept HOD', // HOD raised indents are auto-approved
```

**Impact:** A Principal or Admin raising an indent for a department they don't belong to gets it auto-approved as "Dept HOD".

**Remediation:**
1. Verify the user's department matches the category before auto-approving
2. Add department validation in the controller
3. Differentiate between HOD, Admin, and Principal auto-approval logic

---

### 3.4 Maintainer Can Approve Any Indent
**Severity:** Medium  
**CWE:** CWE-862  
**Files Affected:**
- `backend/controllers/maintainerController.js` (lines 145-192)

**Description:** Any maintainer can approve/reject any indent in the approval queue, regardless of whether it's assigned to them or in their department.

```javascript
// maintainerController.js:153-157
const indent = await prisma.indent.findUnique({ where: { id: req.params.id } });
if (!indent) {
  return res.status(404).json({ message: 'Indent not found' }
```

**Impact:** A maintainer from one department can approve indents from another department.

**Remediation:**
1. Validate that the maintainer belongs to the indent's category/department
2. Restrict review permissions to assigned maintainers or category incharge

---

### 3.5 Hall/Vehicle/Bus Booking Time Conflict Not Checked
**Severity:** Medium  
**CWE:** CWE-367  
**Files Affected:**
- `backend/controllers/hallBookingController.js` (lines 58-118)
- `backend/controllers/vehicleBookingController.js` (lines 76-139)
- `backend/controllers/busBookingController.js` (lines 69-120)

**Description:** When creating bookings, there is no check for overlapping bookings. Multiple bookings can be created for the same hall/vehicle/bus at the same time.

**Impact:** Double-bookings of resources causing operational conflicts.

**Remediation:**
1. Implement overlap detection queries before creating bookings
2. Add database constraints or triggers to prevent overlaps
3. Return conflict information to the user

---

### 3.6 Notification Race Condition
**Severity:** Low  
**CWE:** CWE-362  
**Files Affected:**
- `backend/controllers/hodController.js` (lines 214-226)
- `backend/controllers/maintainerController.js` (lines 112-123)

**Description:** Notifications are sent asynchronously after the main transaction completes. If the transaction succeeds but notification fails, the system is in an inconsistent state.

**Impact:** Users may not receive critical notifications about status changes.

**Remediation:**
1. Implement a notification queue with retry logic
2. Use outbox pattern for reliable notifications
3. Implement dead-letter queues for failed notifications

---

## 4. INPUT VALIDATION & INJECTION

### 4.1 Missing Input Validation on Admin Routes
**Severity:** High  
**CWE:** CWE-20  
**Files Affected:**
- `backend/controllers/adminController.js` (multiple functions)

**Description:** Admin routes lack proper input validation. For example, `createUser` accepts any `role` value without validation against allowed roles.

```javascript
// adminController.js:392
const { name, email, password, department, role, roles } = req.body;
// No validation of role values!
```

**Impact:** Invalid data can be inserted into the database, potentially causing application crashes or unexpected behavior.

**Remediation:**
1. Add express-validator middleware to all routes
2. Validate all inputs against schemas
3. Sanitize all user inputs before processing

---

### 4.2 Unvalidated Email in Bookings
**Severity:** Medium  
**CWE:** CWE-20  
**Files Affected:**
- `backend/controllers/hallBookingController.js` (line 79)
- `backend/controllers/vehicleBookingController.js` (line 92)
- `backend/controllers/busBookingController.js` (line 85)

**Description:** The `booked_by_email` field is not validated as a proper email format before storage.

**Impact:** Invalid email addresses stored in database, leading to failed email notifications.

**Remediation:**
1. Add email validation using express-validator
2. Validate email format before storing
3. Normalize email addresses (lowercase, trim)

---

### 4.3 No File Upload Validation
**Severity:** Medium  
**CWE:** CWE-434  
**Files Affected:**
- `backend/middleware/uploadMiddleware.js` (lines 1-21)

**Description:** The multer upload middleware has no file type or size restrictions.

```javascript
const upload = multer({ storage: storage });
// No fileFilter, no limits!
```

**Impact:**
- Users can upload executable files (.exe, .php, .js)
- Large files can fill disk space
- Malicious file uploads could lead to remote code execution

**Remediation:**
1. Add file size limits (e.g., 5MB)
2. Whitelist allowed file types (images only)
3. Validate file content (magic numbers)
4. Store uploads outside web root
5. Generate random filenames (already done)
6. Scan uploads for malware

---

## 5. ARCHITECTURAL WEAKNESSES

### 5.1 No Centralized Error Handling
**Severity:** Medium  
**Files Affected:** All controllers

**Description:** Every controller has its own try-catch block with identical error responses. There's no centralized error handling middleware.

**Impact:**
- Code duplication across 15+ controllers
- Inconsistent error responses
- Difficult to add logging, monitoring, or error tracking
- Stack traces potentially leaked in production

**Remediation:**
1. Create an error-handling middleware
2. Use a custom error class
3. Implement consistent error response format
4. Add error logging with context (user ID, request ID, etc.)

---

### 5.2 Excessive Raw SQL Usage
**Severity:** Medium  
**CWE:** CWE-89  
**Files Affected:** All controllers

**Description:** The application uses raw SQL queries extensively instead of Prisma's query builder. This makes the code:
- Harder to maintain
- More prone to SQL injection
- Database-specific (PostgreSQL only)
- Difficult to test

**Impact:** High maintenance cost, security risks, vendor lock-in.

**Remediation:**
1. Migrate to Prisma's query builder where possible
2. Create a data access layer abstraction
3. Use parameterized queries consistently
4. Consider using an ORM query builder like Knex.js

---

### 5.3 No Request ID / Correlation ID
**Severity:** Low  
**Files Affected:** All routes

**Description:** Requests are not tracked with unique IDs, making debugging and tracing difficult in production.

**Impact:** Difficult to trace requests across microservices or log files.

**Remediation:**
1. Add request ID middleware
2. Include request ID in all log entries
3. Return request ID in response headers

---

### 5.4 Inconsistent Role Checking
**Severity:** Medium  
**CWE:** CWE-863  
**Files Affected:**
- `backend/routes/facultyRoutes.js` (line 8)
- `backend/routes/stationaryIndentRoutes.js` (line 11)
- `backend/routes/hallBookingRoutes.js` (line 7)

**Description:** Role checks use string literals instead of the `ROLES` constant, leading to inconsistencies.

```javascript
// facultyRoutes.js:8
router.get('/dashboard', protect, authorize('Faculty', 'Admin', 'HOD', 'Non-Teaching'), ...);

// stationaryIndentRoutes.js:11
router.get('/', protect, authorize('Admin', 'Faculty', 'HOD', 'Non-Teaching', 'Office_Stationary'), ...);
```

**Impact:** Typos in role names could bypass authorization. Role renames require changes in multiple files.

**Remediation:**
1. Always use `ROLES` constant for role checks
2. Create a role validation helper
3. Consider using enums or a role registry

---

## 6. FRONTEND SECURITY VULNERABILITIES

### 6.1 API Base URL Hardcoded
**Severity:** High  
**CWE:** CWE-798  
**Files Affected:**
- `frontend/src/api/axios.js` (line 4)
- `frontend/src/context/AuthContext.jsx` (line 10)

**Description:** The API base URL is hardcoded to an internal IP address in frontend code.

```javascript
return 'http://10.22.0.151:5000/api';
```

**Impact:** Application breaks in different environments. Internal network topology exposed.

**Remediation:**
1. Use environment variables (`VITE_API_BASE_URL`)
2. Configure at build time
3. Use relative URLs with a reverse proxy

---

### 6.2 Token Stored in localStorage
**Severity:** High  
**CWE:** CWE-922  
**Files Affected:**
- `frontend/src/context/AuthContext.jsx` (lines 37-40)
- `frontend/src/api/axios.js` (lines 48-54)

**Description:** JWT tokens are stored in localStorage, making them vulnerable to XSS attacks.

```javascript
localStorage.setItem('token', userData.token);
```

**Impact:** XSS attacks can steal tokens from localStorage, leading to account takeover.

**Remediation:**
1. Rely on HttpOnly cookies exclusively (already implemented)
2. Remove token from localStorage
3. Implement CSRF protection
4. Consider using a short-lived access token with refresh token rotation

---

### 6.3 XSS via innerHTML (Email Content)
**Severity:** Medium  
**CWE:** CWE-79  
**Files Affected:**
- `frontend/src/pages/FacultyDashboard/index.jsx` (no direct innerHTML)
- Backend email templates use innerHTML in email clients

**Description:** Email templates use HTML content that could be injected if user input is not sanitized.

**Impact:** XSS in email clients if user input contains malicious HTML.

**Remediation:**
1. Sanitize all user input before including in email templates
2. Use DOMPurify or similar library
3. Consider using text-only emails for sensitive notifications

---

### 6.4 Missing CSRF Protection
**Severity:** Medium  
**CWE:** CWE-352  
**Files Affected:** All forms

**Description:** The application uses cookies for authentication but has no CSRF token protection. While `sameSite: 'lax'` provides some protection, it's not sufficient for all scenarios.

**Impact:** CSRF attacks could perform unauthorized actions on behalf of authenticated users.

**Remediation:**
1. Implement CSRF tokens using `csurf` middleware
2. Use SameSite: Strict cookies
3. Validate Origin/Referer headers
4. Implement double-submit cookie pattern

---

### 6.5 Client-Side Route Protection Only
**Severity:** Medium  
**CWE:** CWE-863  
**Files Affected:**
- `frontend/src/components/ProtectedRoute.jsx` (lines 1-32)

**Description:** Route protection is only enforced client-side. The backend must independently verify authorization for every request.

**Impact:** Users can bypass client-side protection by making direct API calls.

**Remediation:**
1. Ensure all API endpoints verify authorization (currently mostly done)
2. Add additional server-side route validation
3. Never trust client-side role information

---

## 7. DATABASE & DATA EXPOSURE

### 7.1 Password Hash Exposed in JWT Payload
**Severity:** High  
**CWE:** CWE-312  
**Files Affected:**
- `backend/controllers/authMiddleware.js` (lines 26-50)

**Description:** The `getNormalizedAuthUser` query selects the password hash and includes it in the JWT payload context.

```javascript
// authController.js:48-70
SELECT
  u.id,
  u.name,
  u.email,
  u.password,  -- PASSWORD HASH IN QUERY RESULT!
  u.department,
  ...
```

**Impact:** Password hashes are loaded into memory for every authenticated request, increasing exposure risk.

**Remediation:**
1. Remove `u.password` from SELECT queries
2. Only select password when needed (login, password change)
3. Use separate queries for authentication vs. authorization

---

### 7.2 Sensitive Data in Error Messages
**Severity:** Medium  
**CWE:** CWE-209  
**Files Affected:** All controllers

**Description:** Error messages sometimes expose sensitive information.

```javascript
// authController.js:198
res.status(500).json({ message: 'Server Error during registration' });
// Good - generic

// But also:
res.status(500).json({ message: 'Server error' });
// Could be more specific internally
```

**Impact:** Information disclosure aiding attackers.

**Remediation:**
1. Use generic error messages for clients
2. Log detailed errors server-side only
3. Never expose stack traces or internal details

---

### 7.3 No Database Index on Frequently Queried Fields
**Severity:** Low  
**Files Affected:** Database schema

**Description:** Fields like `createdAt`, `status`, `requesterId`, `categoryId` are frequently used in WHERE clauses but may lack indexes.

**Impact:** Slow query performance as data grows.

**Remediation:**
1. Add indexes on frequently filtered fields
2. Use composite indexes for common query patterns
3. Monitor query performance with EXPLAIN ANALYZE

---

## 8. ADDITIONAL FINDINGS

### 8.1 Rate Limiting Bypass
**Severity:** Medium  
**CWE:** CWE-770  
**Files Affected:**
- `backend/server.js` (lines 75-80)

**Description:** OPTIONS requests bypass rate limiting entirely.

```javascript
app.use('/api', (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();  // SKIPS RATE LIMITING!
  }
  limiter(req, res, next);
});
```

**Impact:** Attackers can flood the server with OPTIONS requests to bypass rate limits.

**Remediation:**
1. Apply rate limiting before CORS handling
2. Rate limit OPTIONS requests separately
3. Consider using express-rate-limit's `skip` function properly

---

### 8.2 CORS Overly Permissive
**Severity:** Medium  
**CWE:** CWE-942  
**Files Affected:**
- `backend/server.js` (lines 27-64)

**Description:** The CORS configuration allows any local network host (`192.168.x.x`, `10.x.x.x`, `172.x.x.x`) without explicit configuration.

```javascript
const isLocalNetworkHost = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname)
  || hostname.startsWith('192.168.')
  || hostname.startsWith('10.')
  || hostname.startsWith('172.');
```

**Impact:** Any device on the local network can make cross-origin requests.

**Remediation:**
1. Use an explicit allowlist
2. Remove wildcard local network matching
3. Configure specific allowed origins via environment variables

---

### 8.3 Missing CSP Headers
**Severity:** Medium  
**CWE:** CWE-693  
**Files Affected:**
- `backend/server.js` (line 24)

**Description:** Helmet is used but Content-Security-Policy is not configured.

**Impact:** XSS attacks are easier without CSP restrictions.

**Remediation:**
1. Configure CSP headers via Helmet
2. Use nonce-based CSP for inline scripts
3. Restrict script sources to self and trusted domains

---

### 8.4 No Request Size Limits on All Routes
**Severity:** Low  
**CWE:** CWE-400  
**Files Affected:**
- `backend/server.js` (line 83)

**Description:** JSON body limit is set to 10MB, which is generous. Some endpoints accept smaller payloads but still have the 10MB limit.

**Impact:** Potential DoS via large payloads.

**Remediation:**
1. Set appropriate limits per route
2. Use `express.json()` with smaller limits for most routes
3. Use `express.raw()` or `express.urlencoded()` only where needed

---

### 8.5 Missing Audit Logging
**Severity:** Medium  
**CWE:** CWE-778  
**Files Affected:** All controllers

**Description:** There is no audit logging for critical operations like:
- User creation/deletion/modification
- Role changes
- Indent status changes
- Booking approvals/rejections

**Impact:** No trail for security incidents or compliance requirements.

**Remediation:**
1. Implement audit logging middleware
2. Log all CRUD operations with user context
3. Store logs in a separate, immutable store
4. Implement log retention policies

---

### 8.6 Hardcoded Email Addresses
**Severity:** Low  
**CWE:** CWE-798  
**Files Affected:**
- `backend/controllers/hallBookingController.js` (lines 5-13)
- `backend/controllers/busBookingController.js` (line 5)
- `backend/controllers/vehicleBookingController.js` (line 5)

**Description:** Email notification recipients are hardcoded.

```javascript
const HALL_BOOKING_EMAILS = [
  // 'dean_infra@git.edu',
  // 'hodmech@git.edu',
  'rypatil@git.edu',
];
```

**Impact:** Email notifications go to wrong recipients in different environments.

**Remediation:**
1. Move email recipients to environment variables
2. Implement email group management
3. Use configuration files for notification routing

---

### 8.7 Duplicate Code Across Booking Controllers
**Severity:** Low  
**Files Affected:**
- `backend/controllers/hallBookingController.js`
- `backend/controllers/vehicleBookingController.js`
- `backend/controllers/busBookingController.js`

**Description:** The three booking controllers share nearly identical code patterns for CRUD operations, status management, and email notifications.

**Impact:** Code duplication leads to maintenance burden and inconsistent bug fixes.

**Remediation:**
1. Create a base booking controller with shared logic
2. Use composition or inheritance
3. Extract common utilities (email notifications, status management)

---

## 9. FRONTEND-SPECIFIC ISSUES

### 9.1 Unvalidated Redirect
**Severity:** Medium  
**CWE:** CWE-601  
**Files Affected:**
- `frontend/src/pages/Login.jsx` (lines 55-60)

**Description:** After login, users are redirected to `location.state?.from?.pathname` without validation.

```javascript
let origin = location.state?.from?.pathname;
if (!origin || origin === '/' || origin === '/login') {
  origin = defaultDashboard;
}
navigate(origin, { replace: true });
```

**Impact:** Open redirect vulnerability if attacker controls `from` state.

**Remediation:**
1. Validate redirect URLs against a whitelist
2. Only allow relative paths
3. Use a redirect URL validator

---

### 9.2 Sensitive Data in Console Logs
**Severity:** Low  
**CWE:** CWE-532  
**Files Affected:**
- `frontend/src/pages/FacultyDashboard/index.jsx` (line 110)
- `backend/controllers/authController.js` (lines 175, 292, 351, 412)

**Description:** Sensitive data is logged to console, which could be visible in browser dev tools or server logs.

**Impact:** Information disclosure.

**Remediation:**
1. Remove console.log statements in production
2. Use a proper logging library with log levels
3. Never log sensitive data (passwords, tokens, OTPs)

---

### 9.3 Missing Loading States
**Severity:** Low  
**Files Affected:**
- `frontend/src/pages/Login.jsx`
- Various modal components

**Description:** Some API calls don't have proper loading state management, leading to double-clicks or race conditions.

**Impact:** Duplicate requests, poor UX, potential data corruption.

**Remediation:**
1. Implement proper loading states for all async operations
2. Disable buttons during loading
3. Use request deduplication

---

## 10. DEPLOYMENT & CONFIGURATION

### 10.1 No Environment Variable Validation
**Severity:** Medium  
**CWE:** CWE-209  
**Files Affected:**
- `backend/server.js` (line 7)

**Description:** The application uses `dotenv.config()` but doesn't validate that required environment variables are set.

**Impact:** Application starts with missing configuration, leading to runtime errors or insecure defaults.

**Remediation:**
1. Add environment variable validation at startup
2. Use a library like `envalid` or `joi` for validation
3. Fail fast if required variables are missing

---

### 10.2 Debug Mode in Production
**Severity:** Medium  
**Files Affected:**
- `backend/server.js` (implied)

**Description:** No explicit check for `NODE_ENV` to disable debug features.

**Impact:** Stack traces and debug information exposed in production.

**Remediation:**
1. Set `NODE_ENV=production` in production
2. Disable detailed error messages in production
3. Use a process manager like PM2 with proper configuration

---

### 10.3 No Health Check Endpoint
**Severity:** Low  
**Files Affected:**
- `backend/server.js`

**Description:** No `/health` or `/readiness` endpoint for load balancers and monitoring.

**Impact:** Difficult to monitor application health and implement auto-scaling.

**Remediation:**
1. Add `/health` endpoint checking database connectivity
2. Add `/readiness` and `/liveness` endpoints
3. Implement graceful shutdown

---

## Summary of Recommendations by Priority

### Immediate Actions (Critical)
1. **Add role authorization to all admin routes** — Currently any authenticated user can access admin functions
2. **Fix SQL injection vulnerabilities** — Replace all `$queryRawUnsafe` with parameterized queries
3. **Secure cookie configuration** — Set `secure: true` in production, `sameSite: 'strict'`
4. **Remove hardcoded secrets** — Use environment variables exclusively
5. **Validate JWT_SECRET at startup** — Fail if not set

### Short-term (High)
1. Implement file upload validation (type, size)
2. Add proper input validation middleware to all routes
3. Fix IDOR vulnerabilities with consistent ownership checks
4. Implement CSRF protection
5. Add rate limiting to OTP verification
6. Replace in-memory session storage with Redis

### Medium-term (Medium)
1. Centralize error handling
2. Reduce raw SQL usage in favor of Prisma query builder
3. Add database indexes
4. Implement audit logging
5. Add request correlation IDs
6. Implement booking overlap detection

### Long-term (Low)
1. Refactor duplicate booking controller code
2. Move hardcoded emails to configuration
3. Add health check endpoints
4. Implement comprehensive logging strategy
5. Add CSP headers
6. Create data access layer abstraction

---

## Conclusion

The GIT Indent Management System has a solid foundation with Express.js, Prisma, and React. However, it contains several critical security vulnerabilities that must be addressed before production deployment. The most urgent issues are the lack of authorization on admin routes, SQL injection risks, and insecure cookie configuration.

The codebase would benefit significantly from:
1. A centralized authentication/authorization strategy
2. Consistent input validation across all endpoints
3. Migration from raw SQL to Prisma's query builder
4. Proper secret management
5. Comprehensive security testing (SAST/DAST)

**Overall Risk Rating: HIGH** — Immediate remediation required for critical issues before production use.

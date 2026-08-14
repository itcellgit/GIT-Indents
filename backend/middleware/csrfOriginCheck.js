// CSRF defense for the state-changing (mutating) routes. See TECHNICAL_AUDIT_REPORT.md 6.4:
// this backend's cookie is set SameSite=None for HTTPS traffic (server.js/authController.js —
// required because the frontend and API run cross-origin at https://indents.git.edu), so
// SameSite alone provides no CSRF protection there. This validates the browser-supplied
// Origin (falling back to Referer) against the same allowlist already used for CORS.
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const csrfOriginCheck = (isAllowedOrigin) => (req, res, next) => {
  if (!STATE_CHANGING_METHODS.has(req.method)) {
    return next();
  }

  const origin = req.headers.origin;
  if (origin) {
    if (!isAllowedOrigin(origin)) {
      return res.status(403).json({ message: 'Request origin not allowed' });
    }
    return next();
  }

  // No Origin header: browsers reliably attach Origin on the cross-site
  // state-changing requests this middleware exists to catch, so its absence isn't
  // itself suspicious — it's how legitimate non-browser clients (server-to-server
  // calls, admin scripts using a Bearer token) normally look, and those aren't
  // CSRF-exploitable anyway since a browser never auto-attaches a bearer token
  // cross-site. Fall back to Referer when present; otherwise let the request
  // through rather than breaking that legitimate traffic.
  const referer = req.headers.referer;
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (!isAllowedOrigin(refererOrigin)) {
        return res.status(403).json({ message: 'Request origin not allowed' });
      }
    } catch {
      // Malformed Referer — ignore rather than block (same fail-open reasoning as above).
    }
  }

  next();
};

module.exports = csrfOriginCheck;

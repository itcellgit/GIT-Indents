// Safety net for anything that isn't already handled by a controller's own
// try/catch: unmatched routes, errors thrown in middleware, and any async
// controller error that escapes its local catch block. Existing controllers
// keep handling their own errors and responses as-is (see TECHNICAL_AUDIT_REPORT.md 5.1).

const notFound = (req, res, next) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// Must keep all four parameters (err, req, res, next) — Express only recognizes
// this as error-handling middleware when the function has arity 4.
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode && err.statusCode >= 400 && err.statusCode < 600
    ? err.statusCode
    : 500;

  console.error(
    `[ERROR] ${req.method} ${req.originalUrl} — user=${req.user?.id || 'anonymous'} — ${err.message}`,
    err.stack
  );

  // Never echo the stack trace back to the client, in any environment — this
  // process serves both the plain-HTTP internal IP and the HTTPS domain at
  // once, so there's no single NODE_ENV to safely gate that on.
  res.status(statusCode).json({
    message: statusCode === 500 ? 'Server Error' : err.message
  });
};

module.exports = { notFound, errorHandler };

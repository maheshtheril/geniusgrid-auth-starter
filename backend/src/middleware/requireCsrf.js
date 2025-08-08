import crypto from 'crypto';

// Issue a CSRF cookie (double submit)
export function issueCsrf(req, res) {
  const csrf = crypto.randomBytes(24).toString('hex');
  res.cookie('gg_csrf', csrf, { secure: true, sameSite: 'lax', path: '/' });
  res.json({ csrf });
}

// Require CSRF for mutating requests once authenticated
export function requireCsrf(req, res, next) {
  const methodNeeds = /^(POST|PUT|PATCH|DELETE)$/i.test(req.method);
  if (!methodNeeds) return next();
  const header = req.get('x-csrf-token');
  const cookie = req.cookies?.gg_csrf;
  if (!header || !cookie || header !== cookie) {
    return res.status(403).json({ message: 'CSRF validation failed' });
  }
  next();
}

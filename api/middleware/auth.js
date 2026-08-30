const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'zdspgc-pre-enrollment-secret-key-2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate a JWT for a user
 */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify a JWT and return the decoded payload
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Express middleware: require a valid JWT
 * Sets req.user = { id, email, role }
 */
function requireAuth(req, res, next) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.query.token) {
    token = req.query.token;
  }
  
  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header or token' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token expired or invalid', details: err.message });
  }
}

/**
 * Express middleware: require admin role
 */
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

module.exports = { signToken, verifyToken, requireAuth, requireAdmin, JWT_SECRET };


import { prisma } from '../configs/prisma.js';

// NOTE: Minimal auth middleware for development
// Expects Authorization: Bearer <userId>
// Replace with proper JWT validation in production.

export function attachUser(optional = false) {
  return async (req, res, next) => {
    try {
      const auth = req.headers.authorization || '';
      const parts = auth.split(' ');
      const token = parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null;

      if (!token) {
        if (optional) return next();
        return res.status(401).json({ error: 'Unauthorized: missing token' });
      }

      const user = await prisma.user.findUnique({
        where: { id: token },
        include: { patient: true, doctor: true },
      });

      if (!user) {
        if (optional) return next();
        return res.status(401).json({ error: 'Unauthorized: invalid token' });
      }

      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireRole(roles = []) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

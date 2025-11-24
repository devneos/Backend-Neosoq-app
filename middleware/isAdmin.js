module.exports = (req, res, next) => {
  const allowed = ['admin', 'support', 'moderator'];
  const roles = (req.user?.roles || []).map(r => (typeof r === 'string' ? r.toLowerCase() : r));
  const isAdmin = roles.some(r => allowed.includes(r));
  if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
  return next();
};

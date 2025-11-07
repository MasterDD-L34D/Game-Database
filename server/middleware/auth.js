
module.exports = function auth(req, res, next) {
  const expected = process.env.API_TOKEN;
  if (!expected) return next(); // se non configurato, bypass (dev)
  const auth = req.get('authorization') || '';
  const key = req.get('x-api-key') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : key;
  if (token && token === expected) return next();
  res.status(401).json({ error: 'Unauthorized' });
};

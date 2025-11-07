
module.exports = function user(req, res, next) {
  const u = req.get('x-user') || req.get('x-user-email') || null;
  req.user = u || null;
  next();
};

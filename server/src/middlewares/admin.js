const admin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      code: 403,
      message: 'Admin access required',
      data: null,
    });
  }
  next();
};

module.exports = admin;

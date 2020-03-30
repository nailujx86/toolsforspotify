module.exports = (req, res, next) => {
  res.locals.meta = {};
  res.locals.data = {};
  return next();
}
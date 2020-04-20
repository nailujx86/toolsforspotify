module.exports = (req, res, next) => {
  if(req.cookies && req.cookies['user_name']) {
    res.locals.username = req.cookies['user_name'];
  } else {
    res.locals.username = undefined;
  }
  return next();
}
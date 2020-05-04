module.exports = (req, res, next) => {
  if(req.cookies && req.cookies['user_name']) {
    res.locals.data.username = req.cookies['user_name'];
  } else {
    res.locals.data.username = undefined;
  }
  return next();
}
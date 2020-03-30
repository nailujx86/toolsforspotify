module.exports = (req, res, next) => {
  if(res.locals.loggedIn == true)
    return next();
  var err = new Error("Not logged in!");
  err.showLoginButton = true;
  err.status = 401;
  return next(err);
}
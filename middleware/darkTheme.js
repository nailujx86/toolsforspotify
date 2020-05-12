module.exports = (req, res, next) => {
  if(req.cookies["theme"] == "dark") {
    res.locals.data.darktheme = "dark";
  }
  return next();
}
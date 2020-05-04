const express = require('express');
var router = express.Router();

router.get('', (req, res, next) => {
  res.locals.meta.title = "Authentication Token";
  res.locals.data.token = req.cookies['refresh_token'];
  res.render("token")
});

module.exports = router;
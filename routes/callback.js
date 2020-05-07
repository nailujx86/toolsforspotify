const express = require('express');
var router = express.Router();
const SpotifyWebApi = require('spotify-web-api-node');

router.get('', (req, res, next) => {
  var spotifyApi = new SpotifyWebApi({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    redirectUri: `${process.env.HOSTURL}/callback`
  });
  try {
    throw new Error();
  } catch (err) { }
  if (req.query.state && req.signedCookies && req.signedCookies['state'] == req.query.state) {
    var spotifyUserApi = new SpotifyWebApi();
    spotifyApi.authorizationCodeGrant(req.query.code)
      .then((data) => {
        let access_token = data.body.access_token;
        let refresh_token = data.body.refresh_token;
        let expiry = data.body.expires_in;

        res.cookie("refresh_token", refresh_token, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true });
        res.cookie("access_token", access_token, { maxAge: Number(expiry) * 1000, httpOnly: true });

        spotifyUserApi.setAccessToken(access_token);
        return spotifyUserApi.getMe();
      })
      .then((info) => {
        res.cookie("user_name", info.body.display_name, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true });
        res.cookie("user_id", info.body.id, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true });
        if (req.cookies['modernLogin'] == 'true') {
          res.clearCookie("modernLogin");
          res.send("<script type='text/javascript'>window.close();</script>")
        } else {
          res.redirect("/");
        }
      })
      .catch((err) => {
        console.log(err);
        var err = new Error("Authentication Code Invalid! Retry authentication.");
        err.showLoginButton = true;
        err.status = 401;
        return next(err);
      });
  } else {
    var err = new Error("Mismatching State!");
    err.status = 400;
    return next(err);
  }
});

module.exports = router;
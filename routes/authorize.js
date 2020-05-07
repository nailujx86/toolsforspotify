const express = require('express');
var router = express.Router();
const crypto = require("crypto");
const SpotifyWebApi = require('spotify-web-api-node');
var scopes = ['user-read-recently-played', 'user-library-read', 'playlist-modify-private', 'playlist-read-private'];

router.get('', (req, res) => {
  var spotifyApi = new SpotifyWebApi({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    redirectUri: `${process.env.HOSTURL}/callback`
  });
  var state = crypto.randomBytes(16).toString('hex');
  if (req.query.modern && req.query.modern == 'true') {
    res.cookie("modernLogin", true);
  }
  res.cookie("state", state, { signed: true , httpOnly: true });
  var authURL = spotifyApi.createAuthorizeURL(scopes, state, true);
  res.redirect(authURL);
});

module.exports = router;
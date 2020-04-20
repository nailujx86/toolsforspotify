const SpotifyWebApi = require('../lib/spotify-web-api-node');

module.exports = (req, res, next) => {
  res.locals.loggedIn = false;
  if(req.cookies && req.cookies['access_token'] && req.cookies['user_id']) {
    res.locals.loggedIn = true;
    return next();
  } else if(req.cookies && req.cookies['refresh_token']) {
    var spotifyUserApi = new SpotifyWebApi({
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      refreshToken: req.cookies['refresh_token']
    });
    spotifyUserApi.refreshAccessToken()
    .then(data => {
      let access_token = data.body.access_token;
      let expiry = data.body.expires_in;
      
      res.cookie("access_token", access_token, {maxAge: Number(expiry) * 1000});
      res.cookie("refresh_token", req.cookies['refresh_token'], {maxAge: 365*24*60*60*1000}); // Refresh Refresh Token Cookie
      if(req.cookies['user_name']) {
        res.cookie("user_name", req.cookies['user_name'], {maxAge: 365*24*60*60*1000}); // Refresh Username Cookie
      }
      req.cookies['access_token'] = access_token;
      res.locals.loggedIn = true;
      if(req.cookies['user_id']) {
        res.cookie("user_id", req.cookies['user_id'], {maxAge: 365*24*60*60*1000}); // Refresh User ID Cookie
      } else {
        res.locals.loggedIn = false; // We need the User ID
      }
      return next();
    })
    .catch(err => {
      return next(err);
    });
  } else {
    res.locals.loggedIn = false;
    return next();
  }
}
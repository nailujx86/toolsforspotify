const SpotifyWebApi = require('spotify-web-api-node');

module.exports = (req, res, next) => {
  res.locals.loggedIn = false;
  if(req.cookies && req.cookies['access_token'] && req.cookies['user_id'] && req.cookies['user_name']) {
    res.locals.loggedIn = true;
    return next();
  } else if(req.cookies && req.cookies['refresh_token'] || req.query.token) {
    req.cookies['refresh_token'] = req.cookies['refresh_token'] || req.query.token;
    var spotifyUserApi = new SpotifyWebApi({
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      refreshToken: req.cookies['refresh_token']
    });
    spotifyUserApi.refreshAccessToken()
    .then(data => {
      let access_token = data.body.access_token;
      let expiry = data.body.expires_in;
      
      res.cookie("access_token", access_token, {maxAge: Number(expiry) * 1000, httpOnly: true});
      res.cookie("refresh_token", req.cookies['refresh_token'], {maxAge: 365*24*60*60*1000, httpOnly: true}); // Refresh Refresh Token Cookie
      if(req.cookies['user_name']) {
        res.cookie("user_name", req.cookies['user_name'], {maxAge: 365*24*60*60*1000, httpOnly: true}); // Refresh Username Cookie
      }
      req.cookies['access_token'] = access_token;
      res.locals.loggedIn = true;
      if(req.cookies['user_id']) {
        res.cookie("user_id", req.cookies['user_id'], {maxAge: 365*24*60*60*1000, httpOnly: true}); // Refresh User ID Cookie
      } else {
        res.locals.loggedIn = false; // We need the User ID
      }
      if(!req.cookies['user_id'] || !req.cookies['user_name']) {
        spotifyUserApi.setAccessToken(access_token);
        return spotifyUserApi.getMe();
      }
      return Promise.resolve();
    })
    .then((info) => {
      if(info != undefined) {
        res.cookie("user_name", info.body.display_name, {maxAge: 365*24*60*60*1000, httpOnly: true});
        res.cookie("user_id", info.body.id, {maxAge: 365*24*60*60*1000, httpOnly: true});
        req.cookies['user_id'] = info.body.id;
        req.cookies['user_name'] = info.body.display_name;
        res.locals.loggedIn = true;
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

const express = require("express");
const exphbs = require('express-handlebars');
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const mongoose = require("mongoose");
const debug = true;
const app = express();

const requiresLogin = require('./middleware/requiresLogin');

mongoose.connect(process.env.DATABASE_STRING, {useNewUrlParser: true, useUnifiedTopology: true});

var hbs = exphbs.create({defaultLayout: 'main', extname: 'hbs'});
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');

app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(express.static("public"));
app.use(require('./middleware/populateResLocal'));
app.use(require('./middleware/spotifyRenew'));
app.use(require('./middleware/showUsername'));

const SpotifyWebApi = require('./lib/spotify-web-api-node');
var scopes = ['user-read-recently-played', 'playlist-modify-private', 'playlist-read-private'];

app.get("/", (request, response) => {
  response.sendFile(__dirname + "/views/index.html");
});





app.get('/authorize', (req, res) => {
  var spotifyApi = new SpotifyWebApi({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    redirectUri: `https://${process.env.PROJECT_DOMAIN}.glitch.me/callback`
  });
  var state = crypto.randomBytes(16).toString('hex');
  if(req.query.modern && req.query.modern == 'true') {
    res.cookie("modernLogin", true);
  }
  res.cookie("state", state, {signed: true});
  var authURL = spotifyApi.createAuthorizeURL(scopes, state, true);
  res.redirect(authURL);
});

app.get('/callback', (req, res, next) => {
  var spotifyApi = new SpotifyWebApi({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    redirectUri: `https://${process.env.PROJECT_DOMAIN}.glitch.me/callback`
  });
  if(req.query.state && req.signedCookies && req.signedCookies['state'] == req.query.state) {
    spotifyApi.authorizationCodeGrant(req.query.code)
    .then((data) => {
      let access_token = data.body.access_token;
      let refresh_token = data.body.refresh_token;
      let expiry = data.body.expires_in;
      
      res.cookie("refresh_token", refresh_token, {maxAge: 365*24*60*60*1000});
      res.cookie("access_token", access_token, {maxAge: Number(expiry) * 1000});
      
      var spotifyUserApi = new SpotifyWebApi({
        accessToken: access_token
      });
      console.log("yep");
      return spotifyUserApi.getMe();
    })
    .then((info) => {
      res.cookie("user_name", info.body.display_name, {maxAge: 365*24*60*60*1000});
      res.cookie("user_id", info.body.id, {maxAge: 365*24*60*60*1000});
      console.log("Lelele");
      if(req.cookies['modernLogin'] == 'true') {
        console.log("ydet");
        res.clearCookie("modernLogin");
        res.send("<script type='text/javascript'>window.parent.location.reload(true);</script>")
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

app.get('/test', requiresLogin, (req, res, next) => {
  if(req.cookies && req.cookies['access_token']) {
    var spotifyUserApi = new SpotifyWebApi({
      accessToken: req.cookies['access_token']
    });
    spotifyUserApi.getMe()
    .then(data => console.log(data));
    spotifyUserApi.getMyRecentlyPlayedTracks()
    .then(data => {
      return res.json(data);
    })
    .catch(err => {
      if(err) {
        var err = new Error("Unauthorized!");
        err.status = 401;
        err.showLoginButton = true;
        return next(err);
      }
    })
  } else {
    res.end("Keine Cookies?");
  }
})

app.get('/backup/spotify/recent', requiresLogin, (req, res, next) => {
  var spotifyUserApi = new SpotifyWebApi({
    accessToken: req.cookies['access_token']
  });
  var tracks = [];
  var playlistURL = "";
  spotifyUserApi.getMyRecentlyPlayedTracks({limit: 30})
  .then(data => {
    for(var trackItem of data.body.items) {
      tracks.push(trackItem.track.uri);
    }
    return spotifyUserApi.createPlaylist(req.cookies['user_id'], 'Recently @' + new Date().toLocaleString(req.acceptsLanguages()[1]), {public: false});
  })
  .then(data => {
    playlistURL = data.body.external_urls.spotify;
    return spotifyUserApi.addTracksToPlaylist(data.body.id, tracks);
  })
  .then(data => {
    res.redirect(playlistURL);
  })
  .catch(err => {
    err.status = 500;
    return next(err);
  })
});

app.get("/logout", (req, res) => {
  res.clearCookie("access_token");
  res.clearCookie("refresh_token");
  res.clearCookie("state");
  res.clearCookie("user_name");
  res.clearCookie("user_id");
  res.redirect("/");
});

app.use((req, res, next) => {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = debug ? err : {};
  res.locals.meta.title = "Error - " + err.status;
  res.locals.showLoginButton = err.showLoginButton || false;
  res.status(err.status || 500);
  
  res.render('error');
})

// listen for requests :)
const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});

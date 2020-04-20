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
//app.enable('view cache');

app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(express.static("public"));
app.use(require('./middleware/populateResLocal'));
app.use(require('./middleware/spotifyRenew'));
app.use(require('./middleware/showUsername'));

const SpotifyWebApi = require('./lib/spotify-web-api-node');
var scopes = ['user-read-recently-played', 'user-library-read', 'playlist-modify-private', 'playlist-read-private'];

app.get("/", (req, res) => {
  res.render("index");
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
  try{
    throw new Error();
  } catch(err) {}
  if(req.query.state && req.signedCookies && req.signedCookies['state'] == req.query.state) {
    var spotifyUserApi = new SpotifyWebApi();
    spotifyApi.authorizationCodeGrant(req.query.code)
    .then((data) => {
      let access_token = data.body.access_token;
      let refresh_token = data.body.refresh_token;
      let expiry = data.body.expires_in;
      
      res.cookie("refresh_token", refresh_token, {maxAge: 365*24*60*60*1000});
      res.cookie("access_token", access_token, {maxAge: Number(expiry) * 1000});
      
      spotifyUserApi.setAccessToken(access_token);
      return spotifyUserApi.getMe();
    })
    .then((info) => {
      res.cookie("user_name", info.body.display_name, {maxAge: 365*24*60*60*1000});
      res.cookie("user_id", info.body.id, {maxAge: 365*24*60*60*1000});
      if(req.cookies['modernLogin'] == 'true') {
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

app.get('/:p(backup|analyze)/*/recent', requiresLogin, (req, res, next) => {
  var spotifyUserApi = new SpotifyWebApi({
    accessToken: req.cookies['access_token']
  })
  var tracks = [];
  var maxItem = req.query.limit || 50;
  if(maxItem > 50) {
    maxItem = 50;
  }
  spotifyUserApi.getMyRecentlyPlayedTracks({limit: maxItem})
  .then(data => {
    var trackList = [];
    for(var track of data.body.items) {
      if(track.track.id) {
        trackList.push({track: {name: track.track.name, artists: track.track.artists.map(i => i.name).join(", "), uri: track.track.uri}});
      }
    }
    if(!(req.query.reverse == "false"))
      trackList.reverse(); // reversing by default due to the recent tracks being bottom up
    res.playlistData = {name: "Recent", tracks: trackList};
    return next();
  })
  .catch(err => {
    return next(err);
  })
});

app.get('/:p(backup|analyze)/*/saved', requiresLogin, (req, res, next) => {
  var spotifyUserApi = new SpotifyWebApi({
    accessToken: req.cookies['access_token']
  })
  var tracks = [];
  var steps = 50;
  var maxItem = req.query.limit || 50;
  if(req.query.limit > 2500) {
    maxItem = 2500;
  }
  var total = 0;
  var count = Math.ceil(maxItem / steps);
  var trackList = [];
  [...Array(count)].reduce((p, _) => 
    p.then(_ =>
      spotifyUserApi.getMySavedTracks({offset: total, limit: steps}).then(data => {
        total += steps;
        data.body.items.forEach(t => trackList.push({track: {name: t.track.name, artists: t.track.artists.map(i => i.name).join(", "), uri: t.track.uri}}));
      })
    )
  , Promise.resolve())
  .then(() => {
    if(req.query.reverse == "true")
      trackList.reverse();
    res.playlistData = {name: "Saved Tracks", tracks: trackList};
    return next();
  })
  .catch(err => {
    return next(err);
  })
});

app.get('/:p(backup|analyze)/*/:playlist', requiresLogin, (req, res, next) => {
  if(["recent", "saved"].includes(req.params.playlist))
    return next();
  
  var spotifyUserApi = new SpotifyWebApi({
    accessToken: req.cookies['access_token']
  });
  var steps = 100;
  var maxItem = Number(req.query.limit) || -1;
  var total = 0;
  var playlistID = req.params.playlist;
  var tracks = [];
  var name = "Playlist";
  spotifyUserApi.getPlaylist(playlistID, {fields: "tracks.total, name"})
  .then(function(data) {
    if(maxItem > data.body.tracks.total || maxItem < 0) {
      maxItem = data.body.tracks.total
    }
    if(maxItem < steps) {
      steps = maxItem;
    }
    name = data.body.name || name;
    var count = Math.ceil(maxItem/steps);
    [...Array(count)].reduce((p, _) => // Sorry for sorcery
      p.then(_ =>
        spotifyUserApi.getPlaylistTracks(playlistID, {fields: "items(track(name,uri,artists))", offset: total, limit: steps}).then(data => {
          total += steps;
          data.body.items.forEach(i => i.track.artists = i.track.artists.map(i => i.name).join(", "));
          tracks.push(...data.body.items);
        })
      )
    , Promise.resolve())
    .then(() => {
      if(req.query.reverse == "true")
        tracks.reverse();
      res.playlistData = {name: name, tracks: tracks};
      return next();
    })
  });
});

app.get('/backup/spotify/:playlist', requiresLogin, (req, res, next) => {
  var spotifyUserApi = new SpotifyWebApi({
    accessToken: req.cookies['access_token']
  });
  var playlistURL = "";
  var tracks = res.playlistData.tracks.map(t => t.track.uri ? t.track.uri : null).filter(t => t != null);
  spotifyUserApi.createPlaylist(req.cookies['user_id'], res.playlistData.name + ' @' + new Date().toLocaleString(req.acceptsLanguages()[1]), {public: false})
  .then(data => {
    playlistURL = data.body.external_urls.spotify;
    var count = Math.ceil(tracks.length / 100);
    var pID = data.body.id;
    var total = 0;
    [...Array(count)].reduce((p, _) =>
      p.then(_ =>
        spotifyUserApi.addTracksToPlaylist(pID, tracks.slice(total, total + 100)).then(data => {
          total += 100;
        })
      )
    , Promise.resolve())
    .then(() => {
      return res.redirect(playlistURL);
    })
    .catch(err => {
      return next(err);
    })
  })
  .catch(err => {
    return next(err);
  })
});

app.get('/backup/json/:playlist', requiresLogin, (req, res, next) => {
  res.set('Content-Disposition', 'inline;filename="' + res.playlistData.name + '.json"')
  res.set('Content-Type', 'application/json');
  return res.json(res.playlistData);
});

app.get('/backup/csv/:playlist', requiresLogin, (req, res, next) => {
  res.set('Content-Type', 'text/csv')
  res.set('Content-Disposition', 'attachment;filename="' + res.playlistData.name + '.csv"')
  var output = "Name\n" + res.playlistData.name + "\nTrackname;Artists;URI\n";
  output += res.playlistData.tracks.map(t => t.track.name + ";" + t.track.artists + ";" + t.track.uri).join("\n");
  return res.end(output);
});

app.get('/analyze/*/:playlist', requiresLogin, (req, res, next) => {
  var spotifyUserApi = new SpotifyWebApi({
    accessToken: req.cookies['access_token']
  });
  var ids = [];
  ids = res.playlistData.tracks.map(t => t.track.uri.startsWith("spotify:track:") ? t.track.uri.replace("spotify:track:", "") : null).filter(t => t != null);
  var count = Math.ceil(ids.length / 100);
  var total = 0;
  var trackInfos = [];
  [...Array(count)].reduce((p, _) =>
    p.then(_ =>
      spotifyUserApi.getAudioFeaturesForTracks(ids.slice(total, total + 100)).then(data => {
        total += 100;
        trackInfos.push(...data.body.audio_features);
      })
    )
  , Promise.resolve())
  .then(() => {
    res.trackInfoData = trackInfos;
    return next();
  })
  .catch((err) => {
    return next(err);
  })
});

app.get('/analyze/json/:playlist', requiresLogin, (req, res, next) => {
  res.set('Content-Disposition', 'inline;filename="' + res.playlistData.name + '_analysis.json"')
  res.set('Content-Type', 'application/json');
  return res.json(res.trackInfoData);
});

app.get('/analyze/charts/:playlist', requiresLogin, (req, res, next) => {
  res.locals.meta.title = "\"" + res.playlistData.name + "\" Analysis";
  res.locals.data = JSON.stringify(res.trackInfoData);
  res.render("analysis");
})

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
  console.log(err);
  res.render('error');
})

// listen for requests :)
const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});

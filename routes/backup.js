const express = require('express');
var router = express.Router();
const SpotifyWebApi = require('spotify-web-api-node');
const requiresLogin = require('../middleware/requiresLogin');

router.get('/spotify/:playlist', requiresLogin, (req, res, next) => {
  var spotifyUserApi = new SpotifyWebApi({
    accessToken: req.cookies['access_token']
  });
  var playlistURL = "";
  var tracks = res.playlistData.tracks.map(t => t.track.uri ? t.track.uri : null).filter(t => t != null);
  spotifyUserApi.createPlaylist(req.cookies['user_id'], res.playlistData.name + ' @' + new Date().toLocaleString(req.acceptsLanguages()[1]), { public: false })
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

router.get('/json/:playlist', requiresLogin, (req, res, next) => {
  res.set('Content-Disposition', 'inline;filename="' + res.playlistData.name + '.json"')
  res.set('Content-Type', 'application/json');
  return res.json(res.playlistData);
});

router.get('/csv/:playlist', requiresLogin, (req, res, next) => {
  res.set('Content-Type', 'text/csv')
  res.set('Content-Disposition', 'attachment;filename="' + res.playlistData.name + '.csv"')
  var output = "Name\n" + res.playlistData.name + "\nTrackname;Artists;URI\n";
  output += res.playlistData.tracks.map(t => t.track.name + ";" + t.track.artists + ";" + t.track.uri).join("\n");
  return res.end(output);
});

module.exports = router;
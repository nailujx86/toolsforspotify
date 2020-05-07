const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const requiresLogin = require('../middleware/requiresLogin');
var router = express.Router();

let base62test = /^[A-Za-z0-9]+$/;

router.get('/*/recent', requiresLogin, (req, res, next) => {
  if (res.playlistData)
    return next();

  var spotifyUserApi = new SpotifyWebApi({
    accessToken: req.cookies['access_token']
  })
  var tracks = [];
  var maxItem = req.query.limit || 50;
  if (maxItem > 50) {
    maxItem = 50;
  }
  spotifyUserApi.getMyRecentlyPlayedTracks({ limit: maxItem })
    .then(data => {
      var trackList = [];
      for (var track of data.body.items) {
        if (track.track.id) {
          trackList.push({ track: { name: track.track.name, artists: track.track.artists.map(i => { return { name: i.name, id: i.id } }), uri: track.track.uri } });
        }
      }
      res.playlistData = { name: "Recent", tracks: trackList };
      return next();
    })
    .catch(err => {
      return next(err);
    })
});

router.get('/*/saved', requiresLogin, (req, res, next) => {
  if (res.playlistData)
    return next();

  var spotifyUserApi = new SpotifyWebApi({
    accessToken: req.cookies['access_token']
  })
  var tracks = [];
  var steps = 50;
  var maxItem = req.query.limit || 50;
  if (req.query.limit > 2500) {
    maxItem = 2500;
  }
  if (maxItem < steps) {
    steps = maxItem;
  }
  var total = 0;
  var count = Math.ceil(maxItem / steps);
  var trackList = [];
  [...Array(count)].reduce((p, _) =>
    p.then(_ =>
      spotifyUserApi.getMySavedTracks({ offset: total, limit: steps }).then(data => {
        total += steps;
        data.body.items.forEach(t => trackList.push({ track: { name: t.track.name, artists: t.track.artists.map(i => { return { name: i.name, id: i.id } }), uri: t.track.uri } }));
      })
    )
    , Promise.resolve())
    .then(() => {
      res.playlistData = { name: "Saved Tracks", tracks: trackList };
      return next();
    })
    .catch(err => {
      return next(err);
    })
});

router.get('/*/:playlist', requiresLogin, (req, res, next) => {
  if (res.playlistData)
    return next();

  if (["recent", "saved"].includes(req.params.playlist))
    return next();
  if (!base62test.test(req.params.playlist)) {
    var error = new Error("Invalid playlist ID");
    error.status = 500;
    return next(error);
  }

  var spotifyUserApi = new SpotifyWebApi({
    accessToken: req.cookies['access_token']
  });
  var steps = 100;
  var maxItem = Number(req.query.limit) || -1;
  var total = 0;
  var playlistID = req.params.playlist;
  var tracks = [];
  var name = "Playlist";
  spotifyUserApi.getPlaylist(playlistID, { fields: "tracks.total, name" })
    .then(function (data) {
      if (maxItem > data.body.tracks.total || maxItem < 0) {
        maxItem = data.body.tracks.total
      }
      if (maxItem < steps) {
        steps = maxItem;
      }
      name = data.body.name || name;
      var count = Math.ceil(maxItem / steps);
      [...Array(count)].reduce((p, _) => // Sorry for sorcery
        p.then(_ =>
          spotifyUserApi.getPlaylistTracks(playlistID, { fields: "items(track(name,uri,artists))", offset: total, limit: steps }).then(data => {
            total += steps;
            data.body.items.forEach(i => i.track.artists = i.track.artists.map(i => { return { name: i.name, id: i.id } }));
            tracks.push(...data.body.items);
          })
        )
        , Promise.resolve())
        .then(() => {
          res.playlistData = { name: name, tracks: tracks };
          return next();
        })
    })
    .catch(err => {
      var error = new Error("Playlist not found!");
      error.status = 400;
      return next(error);
    });
});

router.all('/*/:playlist', requiresLogin, (req, res, next) => {
  if (res.playlistData) {
    if (req.query.reverse == "true")
      res.playlist.tracks.reverse();
    if (req.query.shuffle == "true") {
      for (let i = res.playlist.tracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [res.playlist.tracks[i], res.playlist.tracks[j]] = [res.playlist.tracks[j], res.playlist.tracks[i]];
      }
    }
  }
  return next();
});


module.exports = router;
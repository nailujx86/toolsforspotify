const express = require('express');
var router = express.Router();
const SpotifyWebApi = require('spotify-web-api-node');
const requireLogin = require('../middleware/requiresLogin');

router.use(require('../middleware/playlistLoader'));
router.use(require('../middleware/playlistAnalyzer'));

router.all('/*/:playlist', requireLogin, (req, res, next) => {
  var spotifyUserApi = new SpotifyWebApi({
    accessToken: req.cookies['access_token']
  });
  if (!res.trackInfoData || !res.playlistData) {
    var err = new Error("Uhoh something went wrong!");
    err.status = 500;
    return next(err);
  }
  var artistCount = {};
  res.playlistData.tracks.forEach(t => t.track.artists.forEach(a => {
    if (artistCount.hasOwnProperty(a.id)) {
      artistCount[a.id]++;
    } else {
      artistCount[a.id] = 1;
    }
  }));
  var artistArray = [];
  Object.keys(artistCount).forEach(k => artistArray.push({ id: k, count: artistCount[k] }));
  artistArray = artistArray.sort((a, b) => b.count - a.count);
  artistSeeds = [];
  for (var i = 0; i < ((artistArray.length < 2) ? artistArray.length : 2); i++) {
    artistSeeds.push(artistArray[i].id);
  }
  var features = { danceability: 0, energy: 0, acousticness: 0, instrumentalness: 0, liveness: 0, valence: 0, speechiness: 0 };
  for (var dataItem of res.trackInfoData) {
    for (var propName in features) {
      features[propName] += dataItem[propName];
    }
  }
  for (var propName in features) {
    features[propName] = Math.round(features[propName] / res.trackInfoData.length);
  }
  var steps = 100;
  var total = 0;
  var maxItem = req.query.amount || 20;
  if (req.query.amount > 1000) {
    maxItem = 1000;
  }
  if (maxItem < steps) {
    steps = maxItem;
  }
  var count = Math.ceil(maxItem / steps);
  trackSeeds = [];
  for(let j = 0; j < count; j++) {
    seeds = [];
    for (var i = 0; i < ((res.playlistData.tracks.length < 3) ? res.playlistData.tracks.length : 3); i++) {
      seeds.push(res.playlistData.tracks[Math.floor(Math.random() * res.playlistData.tracks.length)].track.uri.replace("spotify:track:", ""));
    }
    trackSeeds.push(seeds);
  }
  var trackList = [];
  var targetList = Object.keys(features).map(feature => {
    let name = "target_" + feature;
    return { name: features[feature] }
  });
  var seedStep = 0;
  [...Array(count)].reduce((p, _) =>
    p.then(_ =>
      spotifyUserApi.getRecommendations({ limit: steps, seed_artists: artistSeeds, seed_tracks: trackSeeds[seedStep], ...targetList }).then(data => {
        total += steps;
        seedStep++;
        data.body.tracks.forEach(t => trackList.push({ track: { name: t.name, artists: t.artists.map(i => { return { name: i.name, id: i.id } }), uri: t.uri } }));
      })
    ).catch(err => {return next(err)})
    , Promise.resolve())
    .then(() => {
      if(req.query.unique == "true") {
        let indexArr = trackList.map(i => i.track.uri);
        trackList = trackList.filter((elem, pos) => {
          return indexArr.indexOf(elem.track.uri) == pos;
        });
      }
      res.recommendationData = { name: "Recommendations from " + res.playlistData.name, tracks: trackList };
      return next();
    })
    .catch(err => {
      return next(err);
    })
});

router.get('/spotify/:playlist', requireLogin, (req, res, next) => {
  var spotifyUserApi = new SpotifyWebApi({
    accessToken: req.cookies['access_token']
  });
  var playlistURL = "";
  var tracks = res.recommendationData.tracks.map(t => t.track.uri ? t.track.uri : null).filter(t => t != null);
  spotifyUserApi.createPlaylist(req.cookies['user_id'], res.recommendationData.name + ' @' + new Date().toLocaleString(req.acceptsLanguages()[1]), { public: false })
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
          res.locals.data.elapsedTime = (new Date().getTime() - res.locals.data.startTime) / 1000;
          res.locals.data.redirectURL = playlistURL;
          return res.render("playlistready");
        })
        .catch(err => {
          return next(err);
        })
    })
    .catch(err => {
      return next(err);
    })
});

router.get('/json/:playlist', requireLogin, (req, res, next) => {
  res.set('Content-Disposition', 'inline;filename="' + res.recommendationData.name + '.json"')
  res.set('Content-Type', 'application/json');
  return res.json(res.recommendationData);
});

router.get('/csv/:playlist', requireLogin, (req, res, next) => {
  res.set('Content-Type', 'text/csv')
  res.set('Content-Disposition', 'attachment;filename="' + res.recommendationData.name + '.csv"')
  var output = "Name\n" + res.recommendationData.name + "\nTrackname;Artists;URI\n";
  output += res.recommendationData.tracks.map(t => t.track.name + ";" + t.track.artists.map(i => i.name).join(", ") + ";" + t.track.uri).join("\n");
  return res.end(output);
});

module.exports = router;
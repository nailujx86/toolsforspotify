const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const requiresLogin = require('../middleware/requiresLogin');
var router = express.Router();

router.use(require('../middleware/playlistLoader'));

router.use((req, res, next) => {
  if (res.trackInfoData)
    return next();

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

module.exports = router;
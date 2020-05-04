const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const requiresLogin = require('../middleware/requiresLogin');
var router = express.Router();

router.get('/*/:playlist', requiresLogin, (req, res, next) => {
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

router.get('/json/:playlist', requiresLogin, (req, res, next) => {
    res.set('Content-Disposition', 'inline;filename="' + res.playlistData.name + '_analysis.json"')
    res.set('Content-Type', 'application/json');
    return res.json(res.trackInfoData);
});

router.get('/csv/:playlist', requiresLogin, (req, res, next) => {
    res.set('Content-Type', 'text/csv')
    res.set('Content-Disposition', 'attachment;filename="' + res.playlistData.name + '-Analysis.csv"')
    var output = "id;danceability;energy;key;loudness;mode;speechiness;acousticness;instrumentalness;liveness;valence;tempo;duration_ms;time_signature\n";
    output += res.trackInfoData.map(t => t.id + ";" + t.danceability + ";" + t.energy + ";" + t.key + ";" + t.loudness + ";" + t.mode + ";" + t.speechiness + ";" + t.acousticness + ";" + t.instrumentalness + ";" + t.liveness + ";" + t.valence + ";" + t.tempo + ";" + t.duration_ms + ";" + t.time_signature).join("\n");
    return res.end(output);
});

router.get('/charts/:playlist', requiresLogin, (req, res, next) => {
    res.locals.meta.title = "\"" + res.playlistData.name + "\" Analysis";
    res.locals.data = JSON.stringify(res.trackInfoData);
    res.render("analysis");
})


module.exports = router;
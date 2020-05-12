const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const requiresLogin = require('../middleware/requiresLogin');
var router = express.Router();

router.use(require('../middleware/playlistAnalyzer'));

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
    res.locals.data.trackInfo = JSON.stringify(res.trackInfoData);
    res.render("analysis");
})


module.exports = router;
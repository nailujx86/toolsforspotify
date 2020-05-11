const SpotifyWebApi = require('spotify-web-api-node');

module.exports = (req, res, next) => {
  if (res.locals.loggedIn == true) {
    var spotifyUserApi = new SpotifyWebApi({
      accessToken: req.cookies['access_token']
    })
    var playlists = [];
    spotifyUserApi.getUserPlaylists({limit: 50})
    .then(data => {
      for(var playlist of data.body.items) {
        playlists.push({name: playlist.name, id: playlist.id});
      }
      res.userPlaylists = playlists;
      return next();
    })
    .catch(err => {
      return next(err);
    });
  } else {
    return next();
  }
}
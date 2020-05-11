require('dotenv').config()
const express = require("express");
const exphbs = require('express-handlebars');
const cookieParser = require("cookie-parser");
const app = express();

var hbs = exphbs.create({ defaultLayout: 'main', extname: 'hbs' });
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
if(process.env.NODE_ENV == "production") {
  const compression = require('compression');
  const helmet = require('helmet')
  app.use(helmet())
  app.use(compression());
  app.enable('view cache');
}
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(express.static("public"));
app.use(require('./middleware/populateResLocal'));
app.use(require('./middleware/spotifyRenew'));
app.use(require('./middleware/showUsername'));

app.use((req, res, next) => {
  res.locals.data.startTime = new Date().getTime();
  return next();
});

/* ROUTES */
app.get("/", require('./middleware/showUserPlaylists'), (req, res) => {
  res.locals.data.host = process.env.HOSTURL;
  res.locals.meta.title = "toolsforspotify";
  res.locals.meta.description = "A selection of tools for Spotify Playlists."
  if(res.userPlaylists)
    res.locals.data.playlists = res.userPlaylists;
  res.render("urlbuilder");
});

app.get("/documentation", (req, res) => {
  res.locals.data.host = process.env.HOSTURL;
  res.locals.meta.title = "Documentation";
  res.render("documentation");
});

app.get("/manifest.json", (req, res) => {
  res.locals.data.host = process.env.HOSTURL;
  res.render("manifest", {layout: false});
});

app.get("/offline", (req, res) => {
  res.locals.data.title = "Offline";
  res.render("offline");
});

app.use('/authorize', require('./routes/authorize'));
app.use('/callback', require('./routes/callback')); // Spotify API Authorization Callback

app.use('/:p(backup|analyze)', require('./middleware/playlistLoader'));

app.use("/backup", require('./routes/backup'));
app.use("/analyze", require('./routes/analyze'));
app.use("/generate", require('./routes/generate'));

app.use("/token", require('./routes/token'));

app.get("/logout", (req, res) => {
  res.clearCookie("access_token");
  res.clearCookie("refresh_token");
  res.clearCookie("state");
  res.clearCookie("user_name");
  res.clearCookie("user_id");
  res.redirect("/");
});
/* END ROUTES */

/* Error handling */
app.use((req, res, next) => {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = (process.env.NODE_ENV != "production") ? err : {};
  res.locals.meta.title = "Error - " + err.status;
  res.locals.showLoginButton = err.showLoginButton || false;
  res.status(err.status || 500);
  res.render('error');
})
/* End error handling */

// listen for requests :)
const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});

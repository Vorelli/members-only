var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var sassMiddleware = require('node-sass-middleware');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

require('./models/user');
require('./models/message');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const messageBoardRouter = require('./routes/messageBoard');

var app = express();

require('dotenv').config();

const secret = process.env.SECRET;
const pool = new Pool({
  ssl: { rejectUnauthorized: false },
  connectionString: process.env.CONNECTIONSTRING
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(function (req, res, next) {
  res.locals.pool = pool;
  next();
});

app.use(session({ secret: secret, resave: false, saveUninitialized: true }));

passport.use(
  new LocalStrategy((username, password, done) => {
    const findUserQuery = `
    SELECT id, passwordHash FROM users
    INNER JOIN userpasses ON id=user_id
    WHERE username=($1)`;
    const findUserQueryValues = [username];

    pool
      .query(findUserQuery, findUserQueryValues)
      .then((result) => {
        if (result.rows.length < 1) {
          return done(null, false, { msg: 'Unknown email/password' });
        } else if (bcrypt.compareSync(password, result.rows[0].passwordhash)) {
          return done(null, result.rows[0]);
        } else return done(null, false, { msg: 'Unknown email/password' });
      })
      .catch((err) => {
        done(err);
      });
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  const findUserQuery = `
  SELECT * FROM users
  INNER JOIN userpasses ON id=userpasses.user_id
  INNER JOIN userprivileges ON id=userprivileges.user_id
  WHERE id=($1)`;
  const findUserQueryValues = [id];

  pool
    .query(findUserQuery, findUserQueryValues)
    .then((result) => {
      done(null, result.rows[0]);
    })
    .catch((err) => {
      done(err);
    });
});

app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ extended: false }));

app.use(function (req, res, next) {
  res.locals.currentUser = req.user;
  next();
});

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(
  sassMiddleware({
    src: path.join(__dirname, 'public'),
    dest: path.join(__dirname, 'public'),
    indentedSyntax: true, // true = .sass and false = .scss
    sourceMap: true
  })
);
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/messageboard', messageBoardRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;

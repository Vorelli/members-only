const { sanitizeBody } = require('express-validator/filter');
const { body, validationResult } = require('express-validator/check');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const async = require('async');
const moment = require('moment');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const { v5 } = require('uuid');

exports.index = function (req, res, next) {
  const getMessages = {
    messages: function (cb) {
      res.locals.pool.query(
        `
        SELECT title, body, datePosted, firstName, lastName 
        FROM messages 
        INNER JOIN users ON user_id = id
      `,
        (err, result) => {
          result.rows.forEach((row) => {
            row.dateposted = moment(row.dateposted).format('YYYY-MM-DD');
          });
          if (err) cb(err);
          else cb(null, result);
        }
      );
    }
  };
  const afterGet = async function (err, results) {
    if (err) next(err);
    else {
      if (!res.locals.currentUser) {
        results.messages.rows.forEach((row) => {
          row.firstname = undefined;
          row.lastname = undefined;
        });
      } else {
        for (var i = results.messages.rows.length - 1; i >= 0; i--) {
          results.messages.rows[i].user =
            results.messages.rows[i].firstname +
            ' ' +
            results.messages.rows[i].lastname;
        }
      }
      res.render('index', {
        title: 'Message Board',
        rows: results.messages.rows
      });
    }
  };
  async.parallel(getMessages, afterGet);
};

exports.signUpGet = function (req, res, next) {
  res.render('sign-up', { title: 'Sign Up' });
};

exports.signUpPost = [
  (req, res, next) => {
    res.locals.errors = [];
    const form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
      if (err) next(err);
      else {
        Object.keys(fields).forEach((key) => {
          req.body[key] = fields[key];
        });
        if (files.picture.type !== 'image/jpeg') {
          res.locals.errors.push({
            msg: 'You must supply a valid jpg image.'
          });
        } else {
          res.locals.files = files;
        }
      }
      next();
    });
  },

  sanitizeBody('firstName').escape(),
  sanitizeBody('lastName').escape(),
  sanitizeBody('username').escape(),

  async (req, res, next) => {
    req.body.hashedPass = bcrypt.hash(req.body.password, 10);

    const username = req.body.username;
    username.trim();
    const emailValidator = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (!emailValidator.test(username)) {
      res.locals.errors.push({ msg: 'You must enter a valid email address.' });
    }
    if (
      (await (
        await res.locals.pool.query('SELECT * FROM users WHERE username = $1', [
          username
        ])
      ).rows.length) > 0
    ) {
      res.locals.errors.push({
        msg: 'This email has been used before. Try to log in.'
      });
    }

    const password = req.body.password;
    const confirmPassword = req.body.passwordConfirmation;
    if (password.length < 8 || password.length > 72) {
      res.locals.errors.push({
        msg:
          'Your password needs to be 8 characters or longer as well as 72 characters or less.'
      });
    }
    if (password !== confirmPassword) {
      res.locals.errors.push({
        msg: 'Your password and password confirmation must match.'
      });
    }

    const firstName = req.body.firstName;
    if (firstName.trim().length < 1) {
      res.locals.errors.push({ msg: 'You must supply a first name.' });
    }

    const lastName = req.body.lastName;
    if (lastName.trim().length < 1) {
      res.locals.errors.push({ msg: 'You must supply a last name.' });
    }
    next();
  },

  async (req, res, next) => {
    const errors = res.locals.errors;
    const userId = v5(req.body.username, process.env.SECRETUUID);

    const createUserQuery = `
    INSERT INTO users
    (id, username, firstName, lastName)
    VALUES($1, $2, $3, $4);`;
    const createUserQueryValues = [
      userId,
      req.body.username,
      req.body.firstName,
      req.body.lastName
    ];

    const createUserPassQuery = `
    INSERT INTO userpasses
    (user_id, passwordHash)
    VALUES($1, $2);`;
    const createUserPassQueryValues = [userId, await req.body.hashedPass];

    const createUserPrivilegesQuery = `
    INSERT INTO userPrivileges
    (user_id, isMember, isAdmin)
    VALUES($1, $2, $3);`;
    const createUserPrivilegesQueryValues = [userId, true, false];

    if (errors.length !== 0) {
      if (
        errors.some(function (value) {
          return (
            value.msg === 'This email has been used before. Try to log in.'
          );
        })
      ) {
        req.session.message = 'This email has been used before. Try to log in.';
        res.redirect('/messageboard/sign-in');
      } else {
        res.render('sign-up', {
          title: 'Sign Up',
          errors: errors,
          user: {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            username: req.body.username
          }
        });
      }
    } else {
      res.locals.pool.connect(function (err, client, done) {
        if (err) next(err);
        else {
          Promise.all([
            client.query(createUserQuery, createUserQueryValues),
            client.query(createUserPassQuery, createUserPassQueryValues),
            client.query(
              createUserPrivilegesQuery,
              createUserPrivilegesQueryValues
            )
          ])
            .then((values) => {
              const files = res.locals.files;
              res.locals.files = undefined;
              const oldPath = files.picture.path;
              const newPath = path.join(
                path.join(__dirname, '../'),
                'public/images/' + req.body.username + '.jpg'
              );
              const rawData = fs.readFileSync(oldPath);
              fs.writeFileSync(newPath, rawData);
              next();
            })
            .catch((err) => {
              next(err);
            })
            .finally(() => {
              done();
            });
        }
      });
    }
  },
  (req, res, next) => {
    next();
  },
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/sign-up'
  })
];

exports.signInGet = function (req, res, next) {
  const errors = [];
  if (req.session.message) {
    errors.push({ msg: req.session.message });
    req.session.message = undefined;
  }
  res.render('sign-in', { title: 'Sign In', errors: errors });
};

exports.signInPost = [
  sanitizeBody('*').escape(),

  body('username')
    .trim()
    .isEmail()
    .withMessage('You must enter a valid email containing an @ symbol and a .'),
  body('password', 'Password must be supplied and at least 8 characters.')
    .trim()
    .isLength({ min: 8 }),

  (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.render('sign-in', {
        title: 'Sign In',
        username: req.body.username,
        errors: errors.array()
      });
    }
    next();
  },

  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/sign-in'
  })
];

exports.signOutGet = function (req, res, next) {
  req.logout();
  res.redirect('/');
};

exports.postGet = function (req, res, next) {
  if (!res.locals.currentUser) {
    req.session.message = 'You need to be logged in to post!';
    res.redirect('/messageboard/sign-in');
  } else {
    res.render('postForm', { title: 'Create Post' });
  }
};

exports.postPost = [
  sanitizeBody('messageBody').escape(),
  sanitizeBody('title').escape(),

  body('messageBody')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Message body is required.'),
  body('title')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Message title is required.'),

  (req, res, next) => {
    if (res.locals.currentUser) {
      const createPostQuery = `
      INSERT INTO messages
      (user_id, title, body, datePosted)
      VALUES($1,$2,$3,$4);`;
      const createPostQueryValues = [
        res.locals.currentUser.id,
        req.body.title,
        req.body.body,
        moment(new Date())
      ];

      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        res.render('postForm', {
          title: 'Create Post',
          message: { body: req.body.body, title: req.body.title },
          errors: errors.array()
        });
      } else {
        res.locals.pool
          .query(createPostQuery, createPostQueryValues)
          .then((value) => {
            res.redirect('/');
          })
          .catch((err) => {
            next(err);
          });
      }
    } else {
      req.session.message = 'You need to be logged in to post!';
      res.redirect('/messageboard/sign-in');
    }
  }
];

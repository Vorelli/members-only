const mongoose = require('mongoose');
const User = mongoose.model('User');
const Message = mongoose.model('Message');
const { sanitizeBody } = require('express-validator/filter');
const { body, validationResult } = require('express-validator/check');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const async = require('async');
const moment = require('moment');

exports.index = function (req, res, next) {
  const getMessages = {
    messages: function (cb) {
      Message.find()
        .populate({ path: 'user', select: 'firstName lastName' })
        .exec(cb);
    }
  };
  const afterGet = function (err, results) {
    if (err) next(err);
    else {
      if (!res.locals.currentUser) {
        results.messages.forEach((message) => {
          message.user = undefined;
        });
      } else {
        for (var i = results.messages.length - 1; i >= 0; i--) {
          results.messages[i].user =
            results.messages[i].user.firstName +
            ' ' +
            results.messages[i].user.lastName;
        }
      }
      res.render('index', {
        title: 'Message Board',
        messages: results.messages
      });
    }
  };
  async.parallel(getMessages, afterGet);
};

exports.signUpGet = function (req, res, next) {
  res.render('sign-up', { title: 'Sign Up' });
};

exports.signUpPost = [
  sanitizeBody('*').escape(),

  body('username')
    .trim()
    .isEmail()
    .withMessage('Username needs to be an email.'),
  body('firstName', 'You must supply a first name.')
    .trim()
    .isLength({ min: 1 }),
  body('lastName', 'You must supply a last name.').trim().isLength({ min: 1 }),
  body('password', 'Password must be supplied and at least 8 characters.')
    .trim()
    .isLength({ min: 8 })
    .custom(
      (value, { req, location, path }) =>
        value === req.body.passwordConfirmation
    ),

  (req, res, next) => {
    const errors = validationResult(req);

    const hashedPass = bcrypt.hashSync(req.body.password, 10);
    const user = new User({
      username: req.body.username,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      password: hashedPass,
      isMember: true,
      isAdmin: false
    });

    if (!errors.isEmpty()) {
      res.render('sign-up', {
        title: 'Sign Up',
        errors: errors.toArray(),
        user: user
      });
    } else {
      user.save({}, (err, theUser) => {
        if (err) next(err);
        else {
          next();
        }
      });
    }
  },
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/'
  })
];

exports.signInGet = function (req, res, next) {
  res.render('sign-in', { title: 'Sign In' });
};

exports.signInPost = [
  sanitizeBody('*').escape(),

  body('username')
    .trim()
    .isEmail()
    .withMessage('Username needs to be an email.'),
  body('password', 'Password must be supplied and at least 8 characters.')
    .trim()
    .isLength({ min: 8 }),

  (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.render('sign-in', {
        title: 'Sign In',
        username: req.body.username,
        errors: errors.toArray()
      });
    }
    next();
  },

  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/'
  })
];

exports.signOutGet = function (req, res, next) {
  req.logout();
  res.redirect('/');
};

exports.postGet = function (req, res, next) {
  if (!res.locals.currentUser) res.redirect('/');
  else {
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
      const message = new Message({
        title: req.body.title,
        body: req.body.messageBody,
        datePosted: moment(new Date()),
        user: res.locals.currentUser
      });

      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        res.render('postForm', {
          title: 'Create Post',
          message: message,
          errors: errors.array()
        });
      } else {
        message.save({}, function (err, theMessage) {
          if (err) next(err);
          else res.redirect('/');
        });
      }
    } else {
      res.redirect('/');
    }
  }
];

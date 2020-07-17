const mongoose = require('mongoose');
const User = mongoose.model('User');
const Message = mongoose.model('Message');
const { body, validationResult, sanitize } = require('express-validator');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const async = require('async');

exports.index = function (req, res, next) {
  const getMessages= {
    messages: function(cb) { Message.find().populate('user').exec(cb); }
  }
  const afterGet = function(err,results) {
    if(err) next(err);
    else {
      if(!res.locals.currentUser) 
        results.messages.forEach(message => { message.user = undefined })
      else
        results.messages.forEach(message => { message.user = (message.user.firstName + ' ' + message.user.lastName) })
      res.render('index', { title: 'Message Board', messages: results.messages })
    }
  }
  async.parallel(getMessages, afterGet);
};

exports.signUpGet = function (req, res, next) {
  res.render('sign-up', { title: 'Sign Up' });
};

exports.signUpPost = [
  sanitize('*').escape(),

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
          next()
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
  sanitize('*').escape(),

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

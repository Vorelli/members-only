const mongoose = require('mongoose');
const User = mongoose.model('User');
const Message = mongoose.model('Message');
const { sanitizeBody } = require('express-validator/filter');
const { body, validationResult } = require('express-validator/check');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const async = require('async');
const moment = require('moment');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const user = require('../models/user');
const { raw } = require('express');

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
    const emailValidator = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (!emailValidator.test(username)) {
      res.locals.errors.push({ msg: 'You must enter a valid email address.' });
    }
    if (await User.findOne({ username: username })) {
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

    const user = new User({
      username: req.body.username,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      password: await req.body.hashedPass,
      isMember: true,
      isAdmin: false
    });

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
          user: user
        });
      }
    } else {
      user.save({}, (err, theUser) => {
        if (err) next(err);
        else {
          const files = res.locals.files;
          const oldPath = files.picture.path;
          const newPath = path.join(
            path.join(__dirname, '../'),
            'public/images/' + req.body.username + '.jpg'
          );
          const rawData = fs.readFileSync(oldPath);
          console.log('done reading file');
          fs.writeFileSync(newPath, rawData);
          next();
        }
      });
    }
  },
  (req, res, next) => {
    console.log('next!');
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

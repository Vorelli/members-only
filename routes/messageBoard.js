const express = require('express');
const router = express.Router();

const messageBoardController = require('../controllers/messageBoardController.js');

router.get('/', messageBoardController.index);

router.get('/sign-up', messageBoardController.signUpGet);
router.post('/sign-up', messageBoardController.signUpPost);

router.get('/sign-in', messageBoardController.signInGet);
router.post('/sign-in', messageBoardController.signInPost);

router.get('/sign-out', messageBoardController.signOutGet);

router.get('/post', messageBoardController.postGet);
router.post('/post', messageBoardController.postPost);

module.exports = router;

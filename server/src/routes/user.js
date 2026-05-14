const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const followController = require('../controllers/followController');
const auth = require('../middlewares/auth');
const optionalAuth = require('../middlewares/optionalAuth');

// Search (must be before /:id to avoid param conflict)
router.get('/search', userController.searchUsers);

// Protected (/me routes must be before /:id to avoid param conflict)
router.get('/me/stats', auth, userController.getStats);
router.put('/me', auth, userController.updateProfile);

// Public (optionalAuth attaches req.user if logged in, for isFollowing)
router.get('/:id', optionalAuth, userController.getProfile);
router.get('/:id/articles', userController.getUserArticles);
router.get('/:id/followers', followController.getFollowers);
router.get('/:id/following', followController.getFollowing);

// Protected
router.post('/:id/follow', auth, followController.toggleFollow);

module.exports = router;

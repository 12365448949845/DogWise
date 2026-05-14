const express = require('express');
const router = express.Router();
const articleController = require('../controllers/articleController');
const auth = require('../middlewares/auth');

// Public
router.get('/tags/popular', articleController.getTags);
router.get('/trending', articleController.getTrending);
router.get('/feed/following', auth, articleController.getFeed);
router.get('/', articleController.getList);
router.get('/:id', articleController.getById);

// Protected
router.post('/', auth, articleController.create);
router.put('/:id', auth, articleController.update);
router.delete('/:id', auth, articleController.remove);
router.post('/:id/like', auth, articleController.like);
router.post('/:id/favorite', auth, articleController.favorite);

module.exports = router;

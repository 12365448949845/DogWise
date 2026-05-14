const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const auth = require('../middlewares/auth');

// Public
router.get('/article/:articleId', commentController.getByArticle);

// Protected
router.post('/article/:articleId', auth, commentController.create);
router.delete('/:id', auth, commentController.remove);
router.post('/:id/like', auth, commentController.like);

module.exports = router;

const express = require('express');
const router = express.Router();
const knowledgeController = require('../controllers/knowledgeController');
const auth = require('../middlewares/auth');
const admin = require('../middlewares/admin');

// Public
router.get('/categories', knowledgeController.getCategories);
router.get('/counts', knowledgeController.getCategoryCounts);
router.get('/', knowledgeController.getList);
router.get('/:id', knowledgeController.getById);

// Admin only
router.post('/', auth, admin, knowledgeController.create);
router.put('/:id', auth, admin, knowledgeController.update);
router.delete('/:id', auth, admin, knowledgeController.remove);

module.exports = router;

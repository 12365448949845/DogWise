const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { chatStream } = require('../controllers/aiController');

// POST /api/ai/chat — streaming chat with DeepSeek
router.post('/chat', auth, chatStream);

module.exports = router;

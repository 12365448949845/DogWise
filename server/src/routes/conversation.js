const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const conversationController = require('../controllers/conversationController');

// GET /api/ai/conversations - 获取对话列表
router.get('/conversations', auth, conversationController.getConversations);

// GET /api/ai/conversations/:id - 获取单个对话详情
router.get('/conversations/:id', auth, conversationController.getConversationById);

// PUT /api/ai/conversations/:id - 更新对话标题
router.put('/conversations/:id', auth, conversationController.updateConversation);

// DELETE /api/ai/conversations/:id - 删除对话
router.delete('/conversations/:id', auth, conversationController.deleteConversation);

module.exports = router;

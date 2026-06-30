const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { chatStream } = require('../controllers/aiController');
const conversationController = require('../controllers/conversationController');
const fs = require('fs');

// POST /api/ai/chat — streaming chat with LangChain Agent (阿里云通义千问 + Tool Calling)
router.post('/chat', (req, res, next) => {
  fs.appendFileSync('C:\\Users\\ccp\\Desktop\\vue\\DogWise\\server\\debug.log', `[${new Date().toISOString()}] POST /api/ai/chat received\n`);
  console.log('[AI Route] POST /api/ai/chat received');
  console.log('[AI Route] Authorization header:', req.headers.authorization ? 'Present' : 'Missing');
  next();
}, auth, chatStream);

// 对话管理路由
router.get('/conversations', auth, conversationController.getConversations);
router.get('/conversations/:id', auth, conversationController.getConversationById);
router.put('/conversations/:id', auth, conversationController.updateConversation);
router.delete('/conversations/:id', auth, conversationController.deleteConversation);

module.exports = router;

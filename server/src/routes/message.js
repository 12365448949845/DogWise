const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const auth = require('../middlewares/auth');

router.use(auth);

router.get('/conversations', messageController.getConversations);
router.get('/unread-count', messageController.getUnreadCount);
router.get('/:userId', messageController.getMessages);
router.post('/:userId', messageController.sendMessage);
router.put('/:userId/read', messageController.markAsRead);
router.delete('/msg/:messageId', messageController.deleteMessage);
router.put('/msg/:messageId/recall', messageController.recallMessage);

module.exports = router;

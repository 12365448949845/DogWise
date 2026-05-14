const messageService = require('../services/messageService');
const { success } = require('../utils/response');

const getConversations = async (req, res, next) => {
  try {
    const conversations = await messageService.getConversations(req.user._id);
    success(res, { conversations }, 'Conversations retrieved');
  } catch (err) {
    next(err);
  }
};

const getMessages = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page, limit } = req.query;
    const result = await messageService.getMessages(req.user._id, userId, { page, limit });
    success(res, result, 'Messages retrieved');
  } catch (err) {
    next(err);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { content, msgType = 'text' } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Content is required' });
    }
    const message = await messageService.sendMessage(req.user._id, userId, content.trim(), msgType);
    success(res, { message }, 'Message sent', 201);
  } catch (err) {
    next(err);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const { userId } = req.params;
    await messageService.markAsRead(req.user._id, userId);
    success(res, null, 'Messages marked as read');
  } catch (err) {
    next(err);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const count = await messageService.getUnreadCount(req.user._id);
    success(res, { unreadCount: count }, 'Unread count retrieved');
  } catch (err) {
    next(err);
  }
};

const deleteMessage = async (req, res, next) => {
  try {
    await messageService.deleteMessage(req.user._id, req.params.messageId);
    success(res, null, 'Message deleted');
  } catch (err) {
    next(err);
  }
};

const recallMessage = async (req, res, next) => {
  try {
    await messageService.recallMessage(req.user._id, req.params.messageId);
    success(res, null, 'Message recalled');
  } catch (err) {
    next(err);
  }
};

module.exports = { getConversations, getMessages, sendMessage, markAsRead, getUnreadCount, deleteMessage, recallMessage };

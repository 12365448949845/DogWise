const notificationService = require('../services/notificationService');
const messageService = require('../services/messageService');
const { success } = require('../utils/response');

const getList = async (req, res, next) => {
  try {
    const { page, limit, types } = req.query;
    const typesArr = types ? types.split(',') : undefined;
    const result = await notificationService.getByUser(req.user._id, { page, limit, types: typesArr });
    success(res, result, 'Notifications retrieved');
  } catch (err) {
    next(err);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const count = await notificationService.getUnreadCount(req.user._id);
    success(res, { unreadCount: count }, 'Unread count retrieved');
  } catch (err) {
    next(err);
  }
};

const getUnreadCounts = async (req, res, next) => {
  try {
    const [categoryCounts, msgCount] = await Promise.all([
      notificationService.getUnreadCountByCategory(req.user._id),
      messageService.getUnreadCount(req.user._id),
    ]);
    success(res, { ...categoryCounts, message: msgCount }, 'Unread counts retrieved');
  } catch (err) {
    next(err);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    await notificationService.markAsRead(req.params.id, req.user._id);
    success(res, null, 'Notification marked as read');
  } catch (err) {
    next(err);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    await notificationService.markAllAsRead(req.user._id);
    success(res, null, 'All notifications marked as read');
  } catch (err) {
    next(err);
  }
};

module.exports = { getList, getUnreadCount, getUnreadCounts, markAsRead, markAllAsRead };

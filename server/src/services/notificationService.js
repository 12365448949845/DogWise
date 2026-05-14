const Notification = require('../models/Notification');
const cache = require('../utils/redis');

const create = async ({ recipient, sender, type, article, comment }) => {
  if (recipient.toString() === sender.toString()) return null;

  const notification = await Notification.create({
    recipient,
    sender,
    type,
    article,
    comment,
  });
  // Invalidate notification caches for recipient
  if (recipient) await cache.delByPattern(`notifications:${recipient}:*`);
  return notification;
};

const getByUser = async (userId, { page = 1, limit = 20, types }) => {
  const typesKey = types && types.length > 0 ? types.sort().join(',') : 'all';
  const cacheKey = `notifications:${userId}:${typesKey}:${page}:${limit}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const skip = (page - 1) * limit;
  const query = { recipient: userId };
  if (types && types.length > 0) {
    query.type = { $in: types };
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .populate('sender', 'username avatar')
      .populate('article', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ ...query, read: false }),
  ]);

  const result = {
    notifications,
    unreadCount,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  };

  await cache.set(cacheKey, result, 15);
  return result;
};

const getUnreadCount = async (userId) => {
  const cacheKey = `notifications:${userId}:unread`;
  const cached = await cache.get(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  const count = await Notification.countDocuments({ recipient: userId, read: false });
  await cache.set(cacheKey, count, 15);
  return count;
};

const getUnreadCountByCategory = async (userId) => {
  const cacheKey = `notifications:${userId}:unreadCats`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const result = await Notification.aggregate([
    { $match: { recipient: new (require('mongoose').Types.ObjectId)(userId), read: false } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
  ]);
  const map = {};
  result.forEach((r) => { map[r._id] = r.count; });
  const counts = {
    comment: (map.comment || 0) + (map.reply || 0),
    like: (map.like || 0) + (map.favorite || 0),
    follow: map.follow || 0,
  };
  await cache.set(cacheKey, counts, 15);
  return counts;
};

const markAsRead = async (notificationId, userId) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { read: true },
    { new: true }
  );
  await cache.delByPattern(`notifications:${userId}:*`);
  return notification;
};

const markAllAsRead = async (userId) => {
  await Notification.updateMany(
    { recipient: userId, read: false },
    { read: true }
  );
  await cache.delByPattern(`notifications:${userId}:*`);
};

module.exports = { create, getByUser, getUnreadCount, getUnreadCountByCategory, markAsRead, markAllAsRead };

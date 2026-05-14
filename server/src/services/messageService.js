const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const cache = require('../utils/redis');

/**
 * Send a message to another user
 */
const sendMessage = async (senderId, receiverId, content, msgType = 'text') => {
  if (senderId.toString() === receiverId.toString()) {
    throw Object.assign(new Error('Cannot send message to yourself'), { status: 400 });
  }

  const receiverExists = await User.exists({ _id: receiverId });
  if (!receiverExists) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const message = await Message.create({
    sender: senderId,
    receiver: receiverId,
    msgType,
    content,
  });

  const populated = await Message.findById(message._id)
    .populate('sender', 'username avatar')
    .populate('receiver', 'username avatar')
    .lean();

  // Invalidate sender & receiver conversation caches
  await Promise.all([
    cache.delByPattern(`messages:${senderId}:*`),
    cache.delByPattern(`messages:${receiverId}:*`),
  ]);

  return populated;
};

/**
 * Get conversation list for a user.
 * Returns unique contacts with last message + unread count.
 */
const getConversations = async (userId) => {
  const uid = new mongoose.Types.ObjectId(userId);

  const conversations = await Message.aggregate([
    { $match: { $or: [{ sender: uid }, { receiver: uid }] } },
    {
      $addFields: {
        partner: {
          $cond: [{ $eq: ['$sender', uid] }, '$receiver', '$sender'],
        },
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$partner',
        lastMessage: { $first: { $substrCP: ['$content', 0, 50] } },
        lastTime: { $first: '$createdAt' },
        lastSender: { $first: '$sender' },
        unreadCount: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$receiver', uid] }, { $eq: ['$read', false] }] },
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: { lastTime: -1 } },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
        pipeline: [{ $project: { username: 1, avatar: 1 } }],
      },
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: 0,
        userId: '$_id',
        username: '$user.username',
        avatar: '$user.avatar',
        lastMessage: 1,
        lastTime: 1,
        lastSender: 1,
        unreadCount: 1,
      },
    },
  ]);

  return conversations;
};

/**
 * Get messages between current user and another user, paginated
 */
const getMessages = async (userId, partnerId, { page = 1, limit = 50 }) => {
  const cacheKey = `messages:${userId}:${partnerId}:${page}:${limit}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;
  const uid = new mongoose.Types.ObjectId(userId);
  const pid = new mongoose.Types.ObjectId(partnerId);

  const query = {
    $or: [
      { sender: uid, receiver: pid },
      { sender: pid, receiver: uid },
    ],
  };

  const [messages, total] = await Promise.all([
    Message.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('sender', 'username avatar')
      .populate('receiver', 'username avatar')
      .lean(),
    Message.countDocuments(query),
  ]);

  const result = {
    messages: messages.reverse(),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  };

  await cache.set(cacheKey, result, 10);
  return result;
};

/**
 * Mark all messages from a partner as read
 */
const markAsRead = async (userId, partnerId) => {
  await Message.updateMany(
    {
      sender: new mongoose.Types.ObjectId(partnerId),
      receiver: new mongoose.Types.ObjectId(userId),
      read: false,
    },
    { read: true }
  );
  await cache.delByPattern(`messages:${userId}:*`);
};

/**
 * Get total unread message count for a user
 */
const getUnreadCount = async (userId) => {
  const cacheKey = `messages:${userId}:unread`;
  const cached = await cache.get(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  const count = await Message.countDocuments({
    receiver: new mongoose.Types.ObjectId(userId),
    read: false,
  });
  await cache.set(cacheKey, count, 10);
  return count;
};

const RECALL_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Delete a message (only participants can delete)
 */
const deleteMessage = async (userId, messageId) => {
  const msg = await Message.findById(messageId);
  if (!msg) throw Object.assign(new Error('Message not found'), { status: 404 });
  const uid = userId.toString();
  if (msg.sender.toString() !== uid && msg.receiver.toString() !== uid) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  await Message.findByIdAndDelete(messageId);
  await Promise.all([
    cache.delByPattern(`messages:${msg.sender}:*`),
    cache.delByPattern(`messages:${msg.receiver}:*`),
  ]);
};

/**
 * Recall a message (only sender, within 5 minutes)
 */
const recallMessage = async (userId, messageId) => {
  const msg = await Message.findById(messageId);
  if (!msg) throw Object.assign(new Error('Message not found'), { status: 404 });
  if (msg.sender.toString() !== userId.toString()) {
    throw Object.assign(new Error('Only sender can recall'), { status: 403 });
  }
  if (Date.now() - new Date(msg.createdAt).getTime() > RECALL_WINDOW_MS) {
    throw Object.assign(new Error('Recall window expired'), { status: 400 });
  }
  msg.recalled = true;
  await msg.save();
  await Promise.all([
    cache.delByPattern(`messages:${msg.sender}:*`),
    cache.delByPattern(`messages:${msg.receiver}:*`),
  ]);
};

module.exports = { sendMessage, getConversations, getMessages, markAsRead, getUnreadCount, deleteMessage, recallMessage };

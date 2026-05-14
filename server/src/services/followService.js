const User = require('../models/User');
const notificationService = require('./notificationService');
const cache = require('../utils/redis');

const toggleFollow = async (currentUserId, targetUserId) => {
  if (currentUserId.toString() === targetUserId.toString()) {
    throw new Error('Cannot follow yourself');
  }

  const [currentUser, targetUser] = await Promise.all([
    User.findById(currentUserId),
    User.findById(targetUserId),
  ]);

  if (!targetUser) throw new Error('User not found');

  const isFollowing = currentUser.following.includes(targetUserId);

  if (isFollowing) {
    currentUser.following.pull(targetUserId);
    targetUser.followers.pull(currentUserId);
  } else {
    currentUser.following.push(targetUserId);
    targetUser.followers.push(currentUserId);

    try {
      await notificationService.create({
        recipient: targetUserId,
        sender: currentUserId,
        type: 'follow',
      });
    } catch { /* silent */ }
  }

  await Promise.all([currentUser.save(), targetUser.save()]);

  // Invalidate profile + stats cache for both users (followers/following counts changed)
  await Promise.all([
    cache.del(`profile:${currentUserId}`),
    cache.del(`profile:${targetUserId}`),
    cache.del(`user:stats:${currentUserId}`),
    cache.del(`user:stats:${targetUserId}`),
    cache.delByPattern('feed:*'),
  ]);

  return {
    following: !isFollowing,
    followersCount: targetUser.followers.length,
  };
};

const getFollowers = async (userId, { page = 1, limit = 20 }) => {
  const user = await User.findById(userId)
    .populate('followers', 'username avatar bio')
    .lean();

  if (!user) throw new Error('User not found');

  const total = user.followers.length;
  const start = (page - 1) * limit;
  const followers = user.followers.slice(start, start + limit);

  return {
    users: followers,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
  };
};

const getFollowing = async (userId, { page = 1, limit = 20 }) => {
  const user = await User.findById(userId)
    .populate('following', 'username avatar bio')
    .lean();

  if (!user) throw new Error('User not found');

  const total = user.following.length;
  const start = (page - 1) * limit;
  const following = user.following.slice(start, start + limit);

  return {
    users: following,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
  };
};

module.exports = { toggleFollow, getFollowers, getFollowing };

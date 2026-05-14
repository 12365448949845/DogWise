const mongoose = require('mongoose');
const User = require('../models/User');
const Article = require('../models/Article');
const cache = require('../utils/redis');

const getProfile = async (userId, currentUserId) => {
  // Cache the heavy part (user + articleCount), compute isFollowing per-request
  const cacheKey = `profile:${userId}`;
  let userData = await cache.get(cacheKey);

  if (!userData) {
    const [user, articleCount] = await Promise.all([
      User.findById(userId).select('-password').lean(),
      Article.countDocuments({ author: userId, status: 'published' }),
    ]);

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    userData = { user, articleCount };
    await cache.set(cacheKey, userData, 60);
  }

  // isFollowing is user-specific — always computed fresh
  const isFollowing = currentUserId
    ? userData.user.followers.some((f) => f.toString() === currentUserId.toString())
    : false;

  return { ...userData, isFollowing };
};

const updateProfile = async (userId, data) => {
  const allowed = ['username', 'bio', 'avatar'];
  const updates = {};
  for (const key of allowed) {
    if (data[key] !== undefined) updates[key] = data[key];
  }

  if (updates.username) {
    const existing = await User.findOne({
      username: updates.username,
      _id: { $ne: userId },
    });
    if (existing) {
      const error = new Error('Username already taken');
      error.statusCode = 409;
      throw error;
    }
  }

  const user = await User.findByIdAndUpdate(userId, updates, {
    new: true,
    runValidators: true,
  }).select('-password');

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  await cache.del(`profile:${userId}`);
  return user;
};

const SUMMARY_LENGTH = 200;

const extractImages = (text) => {
  const regex = /!\[[^\]]*\]\(([^)]+)\)/g;
  const imgs = [];
  let m;
  while ((m = regex.exec(text)) !== null) imgs.push(m[1]);
  return imgs;
};

const getUserArticles = async (userId, { page = 1, limit = 10 }) => {
  const skip = (page - 1) * limit;
  const query = { author: userId, status: 'published' };

  const [rawArticles, total] = await Promise.all([
    Article.find(query)
      .populate('author', 'username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Article.countDocuments(query),
  ]);

  return {
    articles: rawArticles.map(({ content, ...rest }) => {
      const images = content ? extractImages(content) : [];
      const textOnly = content ? content.replace(/!\[[^\]]*\]\([^)]+\)/g, '').trim() : '';
      return { ...rest, summary: textOnly.slice(0, SUMMARY_LENGTH), images };
    }),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get user stats for sidebar card
 * totalViews: sum of viewCount across all user's published articles (excluding self-views)
 * totalLikes: sum of likes.length across all user's published articles
 * followingCount / followersCount from User doc
 * Cached 60s
 */
const getUserStats = async (userId) => {
  const cacheKey = `user:stats:${userId}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const [user, agg] = await Promise.all([
    User.findById(userId).select('following followers avatar username').lean(),
    Article.aggregate([
      { $match: { author: new mongoose.Types.ObjectId(userId), status: 'published' } },
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$viewCount' },
          totalLikes: { $sum: { $size: '$likes' } },
        },
      },
    ]),
  ]);

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const stats = {
    username: user.username,
    avatar: user.avatar,
    totalViews: agg[0]?.totalViews || 0,
    totalLikes: agg[0]?.totalLikes || 0,
    followingCount: user.following?.length || 0,
    followersCount: user.followers?.length || 0,
  };

  await cache.set(cacheKey, stats, 60);
  return stats;
};

const searchUsers = async (query, { page = 1, limit = 10 }) => {
  const p = Math.max(1, page);
  const l = Math.min(20, Math.max(1, limit));

  const filter = {
    $or: [
      { username: { $regex: query, $options: 'i' } },
      { bio: { $regex: query, $options: 'i' } },
    ],
  };

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('username avatar bio followers following createdAt')
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean(),
    User.countDocuments(filter),
  ]);

  const mapped = users.map((u) => ({
    ...u,
    followersCount: u.followers?.length || 0,
    followingCount: u.following?.length || 0,
    followers: undefined,
    following: undefined,
  }));

  return { users: mapped, total, page: p, totalPages: Math.ceil(total / l) };
};

module.exports = { getProfile, updateProfile, getUserArticles, getUserStats, searchUsers };

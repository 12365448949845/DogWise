const userService = require('../services/userService');
const { success } = require('../utils/response');

const getProfile = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id || null;
    const result = await userService.getProfile(req.params.id, currentUserId);
    success(res, result, 'Profile retrieved');
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const user = await userService.updateProfile(req.user._id, req.body);
    success(res, { user }, 'Profile updated');
  } catch (err) {
    next(err);
  }
};

const getUserArticles = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await userService.getUserArticles(req.params.id, { page, limit });
    success(res, result, 'User articles retrieved');
  } catch (err) {
    next(err);
  }
};

const getStats = async (req, res, next) => {
  try {
    const stats = await userService.getUserStats(req.user._id);
    success(res, stats, 'User stats retrieved');
  } catch (err) {
    next(err);
  }
};

const searchUsers = async (req, res, next) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    if (!q || !q.trim()) {
      return res.json({ code: 200, message: 'OK', data: { users: [], total: 0, page: 1, totalPages: 0 } });
    }
    const result = await userService.searchUsers(q.trim(), { page: Number(page), limit: Number(limit) });
    success(res, result, 'Users found');
  } catch (err) {
    next(err);
  }
};

module.exports = { getProfile, updateProfile, getUserArticles, getStats, searchUsers };

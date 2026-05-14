const followService = require('../services/followService');
const { success } = require('../utils/response');

const toggleFollow = async (req, res, next) => {
  try {
    const result = await followService.toggleFollow(req.user._id, req.params.id);
    success(res, result, result.following ? 'Followed' : 'Unfollowed');
  } catch (err) {
    next(err);
  }
};

const getFollowers = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await followService.getFollowers(req.params.id, { page, limit });
    success(res, result, 'Followers retrieved');
  } catch (err) {
    next(err);
  }
};

const getFollowing = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await followService.getFollowing(req.params.id, { page, limit });
    success(res, result, 'Following retrieved');
  } catch (err) {
    next(err);
  }
};

module.exports = { toggleFollow, getFollowers, getFollowing };

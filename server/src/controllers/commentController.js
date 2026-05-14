const commentService = require('../services/commentService');
const { success } = require('../utils/response');

const create = async (req, res, next) => {
  try {
    const { content, parentCommentId, images } = req.body;
    const { articleId } = req.params;

    if (!content && (!images || images.length === 0)) {
      return res.status(400).json({
        code: 400,
        message: 'Content or images required',
        data: null,
      });
    }

    const comment = await commentService.createComment({
      content: content || '',
      articleId,
      userId: req.user._id,
      parentCommentId,
      images,
    });
    success(res, { comment }, 'Comment created', 201);
  } catch (err) {
    next(err);
  }
};

const getByArticle = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await commentService.getCommentsByArticle(req.params.articleId, { page, limit });
    success(res, result, 'Comments retrieved');
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await commentService.deleteComment(req.params.id, req.user._id);
    success(res, result, 'Comment deleted');
  } catch (err) {
    next(err);
  }
};

const like = async (req, res, next) => {
  try {
    const result = await commentService.toggleCommentLike(req.params.id, req.user._id);
    success(res, result, result.liked ? 'Liked' : 'Unliked');
  } catch (err) {
    next(err);
  }
};

module.exports = { create, getByArticle, remove, like };

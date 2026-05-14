const Comment = require('../models/Comment');
const Article = require('../models/Article');
const notificationService = require('./notificationService');
const cache = require('../utils/redis');

const createComment = async ({ content, articleId, userId, parentCommentId, images }) => {
  const comment = await Comment.create({
    content,
    article: articleId,
    author: userId,
    parentComment: parentCommentId || null,
    images: images || [],
  });
  const populated = await comment.populate('author', 'username avatar');

  // Update commentCount + invalidate caches
  await Promise.all([
    Article.findByIdAndUpdate(articleId, { $inc: { commentCount: 1 } }),
    cache.delByPattern(`comments:${articleId}:*`),
    cache.del('articles:trending'),
  ]);

  // Trigger notification
  try {
    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId);
      if (parentComment) {
        await notificationService.create({
          recipient: parentComment.author,
          sender: userId,
          type: 'reply',
          article: articleId,
          comment: comment._id,
        });
      }
    } else {
      const article = await Article.findById(articleId);
      if (article) {
        await notificationService.create({
          recipient: article.author,
          sender: userId,
          type: 'comment',
          article: articleId,
          comment: comment._id,
        });
      }
    }
  } catch {
    // notification failure should not block comment creation
  }

  return populated;
};

const getCommentsByArticle = async (articleId, { page = 1, limit = 20 } = {}) => {
  const cacheKey = `comments:${articleId}:${page}:${limit}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const skip = (page - 1) * limit;
  const query = { article: articleId, parentComment: null };

  const [comments, total] = await Promise.all([
    Comment.find(query)
      .populate('author', 'username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Comment.countDocuments(query),
  ]);

  const commentIds = comments.map((c) => c._id);

  // Fetch all replies for the current page of comments in one query
  const replies = commentIds.length > 0
    ? await Comment.find({ parentComment: { $in: commentIds } })
        .populate('author', 'username avatar')
        .sort({ createdAt: 1 })
        .lean()
    : [];

  const replyMap = {};
  for (const reply of replies) {
    const pid = reply.parentComment.toString();
    if (!replyMap[pid]) replyMap[pid] = [];
    replyMap[pid].push(reply);
  }

  const result = {
    comments: comments.map((comment) => ({
      ...comment,
      replies: replyMap[comment._id.toString()] || [],
    })),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  };

  await cache.set(cacheKey, result, 30);
  return result;
};

const deleteComment = async (commentId, userId) => {
  const comment = await Comment.findById(commentId);
  if (!comment) {
    const error = new Error('Comment not found');
    error.statusCode = 404;
    throw error;
  }
  if (comment.author.toString() !== userId.toString()) {
    const error = new Error('Not authorized');
    error.statusCode = 403;
    throw error;
  }

  const articleId = comment.article.toString();

  // Count how many comments (including replies) will be deleted
  const deleteCount = await Comment.countDocuments({
    $or: [{ _id: commentId }, { parentComment: commentId }],
  });

  await Comment.deleteMany({
    $or: [{ _id: commentId }, { parentComment: commentId }],
  });

  await Promise.all([
    Article.findByIdAndUpdate(articleId, { $inc: { commentCount: -deleteCount } }),
    cache.delByPattern(`comments:${articleId}:*`),
    cache.del('articles:trending'),
  ]);

  return { id: commentId };
};

const toggleCommentLike = async (commentId, userId) => {
  const comment = await Comment.findById(commentId);
  if (!comment) {
    const error = new Error('Comment not found');
    error.statusCode = 404;
    throw error;
  }

  const index = comment.likes.indexOf(userId);
  if (index === -1) {
    comment.likes.push(userId);
  } else {
    comment.likes.splice(index, 1);
  }

  await comment.save();
  await cache.delByPattern(`comments:${comment.article}:*`);
  return { liked: index === -1, likesCount: comment.likes.length };
};

module.exports = {
  createComment,
  getCommentsByArticle,
  deleteComment,
  toggleCommentLike,
};

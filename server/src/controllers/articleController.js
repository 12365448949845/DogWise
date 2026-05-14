const articleService = require('../services/articleService');
const { success } = require('../utils/response');

const create = async (req, res, next) => {
  try {
    const { title, content, summary, cover, tags } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        code: 400,
        message: 'Title and content are required',
        data: null,
      });
    }

    const article = await articleService.createArticle(
      { title, content, summary, cover, tags },
      req.user._id
    );
    success(res, { article }, 'Article created', 201);
  } catch (err) {
    next(err);
  }
};

const getList = async (req, res, next) => {
  try {
    const { page, limit, tag, search, author, sort } = req.query;
    const result = await articleService.getArticles({ page, limit, tag, search, author, sort });
    success(res, result, 'Articles retrieved');
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const article = await articleService.getArticleById(req.params.id);
    success(res, { article }, 'Article retrieved');
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const article = await articleService.updateArticle(
      req.params.id,
      req.user._id,
      req.body
    );
    success(res, { article }, 'Article updated');
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await articleService.deleteArticle(req.params.id, req.user._id);
    success(res, result, 'Article deleted');
  } catch (err) {
    next(err);
  }
};

const like = async (req, res, next) => {
  try {
    const result = await articleService.toggleLike(req.params.id, req.user._id);
    success(res, result, result.liked ? 'Liked' : 'Unliked');
  } catch (err) {
    next(err);
  }
};

const favorite = async (req, res, next) => {
  try {
    const result = await articleService.toggleFavorite(req.params.id, req.user._id);
    success(res, result, result.favorited ? 'Favorited' : 'Unfavorited');
  } catch (err) {
    next(err);
  }
};

const getTags = async (req, res, next) => {
  try {
    const tags = await articleService.getPopularTags();
    success(res, { tags }, 'Tags retrieved');
  } catch (err) {
    next(err);
  }
};

const getFeed = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await articleService.getFeed(req.user._id, { page, limit });
    success(res, result, 'Feed retrieved');
  } catch (err) {
    next(err);
  }
};

const getTrending = async (req, res, next) => {
  try {
    const articles = await articleService.getTrendingArticles();
    success(res, { articles }, 'Trending articles retrieved');
  } catch (err) {
    next(err);
  }
};

module.exports = { create, getList, getById, update, remove, like, favorite, getTags, getFeed, getTrending };

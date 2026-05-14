const knowledgeService = require('../services/knowledgeService');
const { success } = require('../utils/response');

const getList = async (req, res, next) => {
  try {
    const { category, page, limit, search } = req.query;
    const result = await knowledgeService.getArticles({ category, page, limit, search });
    success(res, result, 'Knowledge articles retrieved');
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const article = await knowledgeService.getArticleById(req.params.id);
    success(res, { article }, 'Knowledge article retrieved');
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { title, content, summary, cover, category, tags } = req.body;
    if (!title || !content || !category) {
      return res.status(400).json({
        code: 400,
        message: 'Title, content and category are required',
        data: null,
      });
    }
    const article = await knowledgeService.createArticle(
      { title, content, summary, cover, category, tags },
      req.user._id
    );
    success(res, { article }, 'Knowledge article created', 201);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const article = await knowledgeService.updateArticle(req.params.id, req.body);
    success(res, { article }, 'Knowledge article updated');
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await knowledgeService.deleteArticle(req.params.id);
    success(res, result, 'Knowledge article deleted');
  } catch (err) {
    next(err);
  }
};

const getCategories = async (req, res, next) => {
  try {
    success(res, { categories: knowledgeService.CATEGORY_MAP }, 'Categories retrieved');
  } catch (err) {
    next(err);
  }
};

const getCategoryCounts = async (req, res, next) => {
  try {
    const counts = await knowledgeService.getCategoryCounts();
    success(res, { counts }, 'Category counts retrieved');
  } catch (err) {
    next(err);
  }
};

module.exports = { getList, getById, create, update, remove, getCategories, getCategoryCounts };

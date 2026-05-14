const KnowledgeArticle = require('../models/KnowledgeArticle');
const User = require('../models/User');
const cache = require('../utils/redis');

const addSummary = (doc) => {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  if (obj.content && obj.content.length > 200) {
    obj.content = obj.content.slice(0, 200);
  }
  return obj;
};

const CATEGORY_MAP = {
  breeds: { icon: '🐕', label: '品种百科' },
  health: { icon: '🏥', label: '健康护理' },
  training: { icon: '🎓', label: '训练教程' },
  nutrition: { icon: '🥩', label: '饮食营养' },
  daily: { icon: '🏠', label: '日常养护' },
};

const getArticles = async ({ category, page = 1, limit = 20, search }) => {
  const p = Math.max(1, Number(page));
  const l = Math.min(50, Math.max(1, Number(limit)));

  const cacheKey = !search ? `knowledge:${category || 'all'}:${p}:${l}` : null;

  if (cacheKey) {
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
  }

  const filter = { status: 'published' };
  if (category) filter.category = category;
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matchingAuthors = await User.find({ username: { $regex: escaped, $options: 'i' } }).select('_id').lean();
    const authorIds = matchingAuthors.map(u => u._id);
    filter.$or = [
      { title: { $regex: escaped, $options: 'i' } },
      { content: { $regex: escaped, $options: 'i' } },
      { tags: { $regex: escaped, $options: 'i' } },
      ...(authorIds.length ? [{ author: { $in: authorIds } }] : []),
    ];
  }

  const [articles, total] = await Promise.all([
    KnowledgeArticle.find(filter)
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .populate('author', 'username avatar role')
      .lean(),
    KnowledgeArticle.countDocuments(filter),
  ]);

  const result = {
    articles: articles.map(addSummary),
    total,
    page: p,
    totalPages: Math.ceil(total / l),
    categories: CATEGORY_MAP,
  };

  if (cacheKey) {
    await cache.set(cacheKey, result, 30);
  }
  return result;
};

const getArticleById = async (id) => {
  const cacheKey = `knowledge:article:${id}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const article = await KnowledgeArticle.findById(id)
    .populate('author', 'username avatar role')
    .lean();

  if (!article) {
    const error = new Error('Knowledge article not found');
    error.statusCode = 404;
    throw error;
  }

  // Increment view count (fire-and-forget)
  KnowledgeArticle.updateOne({ _id: id }, { $inc: { viewCount: 1 } }).catch(() => {});

  await cache.set(cacheKey, article, 60);
  return article;
};

const createArticle = async (data, userId) => {
  const article = await KnowledgeArticle.create({
    ...data,
    author: userId,
  });

  // Invalidate list caches
  await cache.delByPattern('knowledge:*');

  return article.populate('author', 'username avatar role');
};

const updateArticle = async (id, data) => {
  const article = await KnowledgeArticle.findByIdAndUpdate(id, data, { new: true })
    .populate('author', 'username avatar role');

  if (!article) {
    const error = new Error('Knowledge article not found');
    error.statusCode = 404;
    throw error;
  }

  await cache.delByPattern('knowledge:*');
  return article;
};

const deleteArticle = async (id) => {
  const article = await KnowledgeArticle.findByIdAndDelete(id);
  if (!article) {
    const error = new Error('Knowledge article not found');
    error.statusCode = 404;
    throw error;
  }

  await cache.delByPattern('knowledge:*');
  return { deleted: true };
};

const getCategoryCounts = async () => {
  const cacheKey = 'knowledge:categoryCounts';
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const counts = await KnowledgeArticle.aggregate([
    { $match: { status: 'published' } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);

  const result = {};
  counts.forEach((c) => { result[c._id] = c.count; });

  await cache.set(cacheKey, result, 60);
  return result;
};

module.exports = { getArticles, getArticleById, createArticle, updateArticle, deleteArticle, getCategoryCounts, CATEGORY_MAP };

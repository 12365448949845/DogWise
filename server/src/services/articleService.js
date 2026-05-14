const Article = require('../models/Article');
const User = require('../models/User');
const notificationService = require('./notificationService');
const cache = require('../utils/redis');

const createArticle = async (data, userId) => {
  const article = await Article.create({ ...data, author: userId });
  await Promise.all([
    cache.delByPattern('articles:*'),
    cache.delByPattern('feed:*'),
    cache.del('tags:popular'),
  ]);
  return article.populate('author', 'username avatar');
};

// Max chars for content preview on list/card views
const SUMMARY_LENGTH = 200;

// Extract markdown image urls
const extractImages = (text) => {
  const regex = /!\[[^\]]*\]\(([^)]+)\)/g;
  const imgs = [];
  let m;
  while ((m = regex.exec(text)) !== null) imgs.push(m[1]);
  return imgs;
};

// Post-process: replace heavy content with a short summary + extracted images
const addSummary = (articles) =>
  articles.map(({ content, ...rest }) => {
    const images = content ? extractImages(content) : [];
    const textOnly = content ? content.replace(/!\[[^\]]*\]\([^)]+\)/g, '').trim() : '';
    return {
      ...rest,
      summary: textOnly.slice(0, SUMMARY_LENGTH),
      images,
    };
  });

const getArticles = async ({ page = 1, limit = 10, tag, search, author, sort = 'newest' }) => {
  // Cache all non-search list queries (including tag filter & sort)
  const cacheKey = !search
    ? `articles:page:${page}:limit:${limit}:sort:${sort}${tag ? `:tag:${tag}` : ''}${author ? `:author:${author}` : ''}`
    : null;

  if (cacheKey) {
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
  }

  const query = { status: 'published' };

  if (tag) query.tags = tag;
  if (author) query.author = author;
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matchingAuthors = await User.find({ username: { $regex: escaped, $options: 'i' } }).select('_id').lean();
    const authorIds = matchingAuthors.map(u => u._id);
    query.$or = [
      { title: { $regex: escaped, $options: 'i' } },
      { tags: { $regex: escaped, $options: 'i' } },
      ...(authorIds.length ? [{ author: { $in: authorIds } }] : []),
    ];
  }

  // Sort strategy: newest = by time, hot = by likes+commentCount
  const sortOption = sort === 'hot'
    ? { hotScore: -1, createdAt: -1 }
    : { createdAt: -1 };

  // For hot sort, we need to compute hotScore via aggregation
  let total, rawArticles;
  if (sort === 'hot') {
    const [countResult, aggResult] = await Promise.all([
      Article.countDocuments(query),
      Article.aggregate([
        { $match: query },
        { $addFields: { hotScore: { $add: [{ $size: '$likes' }, '$commentCount'] } } },
        { $sort: { hotScore: -1, createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: Number(limit) },
      ]),
    ]);
    total = countResult;
    // Populate author after aggregation
    rawArticles = await Article.populate(aggResult, { path: 'author', select: 'username avatar bio' });
  } else {
    [total, rawArticles] = await Promise.all([
      Article.countDocuments(query),
      Article.find(query)
        .populate('author', 'username avatar bio')
        .sort(sortOption)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);
  }

  const result = {
    articles: addSummary(rawArticles),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  };

  if (cacheKey) await cache.set(cacheKey, result, 30);

  return result;
};

const getArticleById = async (id) => {
  // Increment view count (atomic, always hits DB — fire-and-forget)
  Article.findByIdAndUpdate(id, { $inc: { viewCount: 1 } }).exec();

  // Read from cache first
  const cacheKey = `article:${id}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const article = await Article.findById(id)
    .populate('author', 'username avatar bio')
    .lean();

  if (!article) {
    const error = new Error('Article not found');
    error.statusCode = 404;
    throw error;
  }

  // Cache 60s — detail page is read-heavy
  await cache.set(cacheKey, article, 60);
  return article;
};

const updateArticle = async (id, userId, data) => {
  const article = await Article.findById(id);

  if (!article) {
    const error = new Error('Article not found');
    error.statusCode = 404;
    throw error;
  }

  if (article.author.toString() !== userId.toString()) {
    const error = new Error('Not authorized');
    error.statusCode = 403;
    throw error;
  }

  Object.assign(article, data);
  await article.save();
  await Promise.all([cache.del(`article:${id}`), cache.delByPattern('articles:*'), cache.delByPattern('feed:*')]);
  return article.populate('author', 'username avatar');
};

const deleteArticle = async (id, userId) => {
  const article = await Article.findById(id);

  if (!article) {
    const error = new Error('Article not found');
    error.statusCode = 404;
    throw error;
  }

  if (article.author.toString() !== userId.toString()) {
    const error = new Error('Not authorized');
    error.statusCode = 403;
    throw error;
  }

  await article.deleteOne();
  await Promise.all([
    cache.del(`article:${id}`),
    cache.delByPattern('articles:*'),
    cache.delByPattern('feed:*'),
    cache.del('tags:popular'),
  ]);
  return { id };
};

const toggleLike = async (articleId, userId) => {
  const article = await Article.findById(articleId);
  if (!article) {
    const error = new Error('Article not found');
    error.statusCode = 404;
    throw error;
  }

  const index = article.likes.indexOf(userId);
  if (index === -1) {
    article.likes.push(userId);
  } else {
    article.likes.splice(index, 1);
  }

  await article.save();

  if (index === -1) {
    try {
      await notificationService.create({
        recipient: article.author,
        sender: userId,
        type: 'like',
        article: articleId,
      });
    } catch { /* silent */ }
  }

  await cache.del('articles:trending');
  return { liked: index === -1, likesCount: article.likes.length };
};

const toggleFavorite = async (articleId, userId) => {
  const article = await Article.findById(articleId);
  if (!article) {
    const error = new Error('Article not found');
    error.statusCode = 404;
    throw error;
  }

  const index = article.favorites.indexOf(userId);
  if (index === -1) {
    article.favorites.push(userId);
  } else {
    article.favorites.splice(index, 1);
  }

  await article.save();

  if (index === -1) {
    try {
      await notificationService.create({
        recipient: article.author,
        sender: userId,
        type: 'favorite',
        article: articleId,
      });
    } catch { /* silent */ }
  }

  await cache.del('articles:trending');
  return { favorited: index === -1, favoritesCount: article.favorites.length };
};

/**
 * Feed — Pull model (Fan-in)
 *
 * How it works:
 *   1. Read user.following list (who I follow)
 *   2. Query articles WHERE author IN following, sorted by newest
 *   3. Cache result per user+page for 15s to absorb rapid refreshes
 *
 * Why pull over push?
 *   - Simple: no extra "inbox" collection, no fan-out on publish
 *   - Correct: always reflects latest follow/unfollow immediately
 *   - Efficient enough: compound index { author, status, createdAt } covers the query
 *   - Push (fan-out) only needed at Twitter scale (millions of followers)
 *
 * Trade-off: each feed request hits Article collection; mitigated by Redis cache + index.
 */
const getFeed = async (userId, { page = 1, limit = 10 }) => {
  const cacheKey = `feed:${userId}:${page}:${limit}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  // 1. Get following list (only need the IDs, select minimal fields)
  const user = await User.findById(userId).select('following').lean();
  if (!user || !user.following || user.following.length === 0) {
    return { articles: [], pagination: { page: Number(page), limit: Number(limit), total: 0, pages: 0 } };
  }

  // 2. Parallel: count + fetch (both hit index { author: 1, status: 1, createdAt: -1 })
  const query = { author: { $in: user.following }, status: 'published' };
  const [total, rawArticles] = await Promise.all([
    Article.countDocuments(query),
    Article.find(query)
      .populate('author', 'username avatar bio')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  const result = {
    articles: addSummary(rawArticles),
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
  };

  // 3. Cache 15s — short TTL because feed should feel real-time
  await cache.set(cacheKey, result, 15);

  return result;
};

const getPopularTags = async (limit = 20) => {
  const cached = await cache.get('tags:popular');
  if (cached) return cached;

  const tags = await Article.aggregate([
    { $match: { status: 'published' } },
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
    { $project: { tag: '$_id', count: 1, _id: 0 } },
  ]);

  await cache.set('tags:popular', tags, 120);
  return tags;
};

/**
 * Get top trending articles by hotScore = likes.length + commentCount
 * Cached 60s
 */
const getTrendingArticles = async (limit = 3) => {
  const cacheKey = 'articles:trending';
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const articles = await Article.find({ status: 'published' })
    .select('title likes commentCount author cover')
    .populate('author', 'username avatar')
    .lean();

  // Compute hotScore and pick top N; expose likesCount + commentCount for display
  const sorted = articles
    .map((a) => ({
      ...a,
      likesCount: a.likes?.length || 0,
      commentCount: a.commentCount || 0,
      hotScore: (a.likes?.length || 0) + (a.commentCount || 0),
    }))
    .sort((a, b) => b.hotScore - a.hotScore)
    .slice(0, limit);

  await cache.set(cacheKey, sorted, 60);
  return sorted;
};

module.exports = {
  createArticle,
  getArticles,
  getArticleById,
  updateArticle,
  deleteArticle,
  toggleLike,
  toggleFavorite,
  getPopularTags,
  getFeed,
  getTrendingArticles,
};

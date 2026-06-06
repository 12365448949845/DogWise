import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';
import { articleApi } from '@/features/article/services/articleApi';
import { useAppSelector } from '@/store/hooks';
import { getImageUrl } from '@/utils/image';
import ArticleCard from '@/components/ArticleCard';
import ArticleCardSkeleton from '@/components/ArticleCardSkeleton';
import type { Article, Pagination, ArticleQueryParams, TrendingArticle } from '@shared/types/article';

type SortMode = 'newest' | 'hot';

const Discover = () => {
  const navigate = useNavigate();
  const { user, token } = useAppSelector((state) => state.auth);

  const [articles, setArticles] = useState<Article[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState<SortMode>('newest');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [trending, setTrending] = useState<TrendingArticle[]>([]);

  const fetchArticles = useCallback(async (params: ArticleQueryParams, append = false) => {
    try {
      const res = await articleApi.getList(params);
      if (append) {
        setArticles((prev) => [...prev, ...res.data.articles]);
      } else {
        setArticles(res.data.articles);
      }
      setPagination(res.data.pagination);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const params: ArticleQueryParams = { page: 1, limit: 6, sort };
    if (activeTag) params.tag = activeTag;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchArticles(params);
  }, [sort, activeTag, fetchArticles]);

  const refreshTrending = useCallback(() => {
    articleApi.getTrending(true).then((res) => setTrending(res.data.articles)).catch(() => {});
  }, []);

  useEffect(() => {
    articleApi.getPopularTags().then((res) => setTags(res.data.tags)).catch(() => {});
    refreshTrending();
  }, [refreshTrending]);

  const hasMore = pagination ? pagination.page < pagination.pages : false;

  const paginationRef = useRef(pagination);
  const hasMoreRef = useRef(hasMore);
  const loadingMoreRef = useRef(loadingMore);
  useEffect(() => {
    paginationRef.current = pagination;
    hasMoreRef.current = hasMore;
    loadingMoreRef.current = loadingMore;
  });

  const loadNextPage = useCallback(() => {
    const pag = paginationRef.current;
    if (!pag || !hasMoreRef.current || loadingMoreRef.current) return;
    setLoadingMore(true);
    loadingMoreRef.current = true;
    const params: ArticleQueryParams = { page: pag.page + 1, limit: 6, sort };
    if (activeTag) params.tag = activeTag;
    fetchArticles(params, true);
  }, [sort, activeTag, fetchArticles]);

  const handleSortChange = (newSort: SortMode) => {
    if (newSort === sort) return;
    setLoading(true);
    setSort(newSort);
    setArticles([]);
  };

  const handleTagClick = (tag: string) => {
    setLoading(true);
    setActiveTag(activeTag === tag ? null : tag);
    setArticles([]);
  };


  const Footer = useMemo(() => {
    const FooterComponent = () => {
      if (loadingMore) {
        return (
          <div className="space-y-4 pt-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <ArticleCardSkeleton key={i} />
            ))}
          </div>
        );
      }
      if (!hasMore && articles.length > 0) {
        return (
          <div className="text-center py-8 text-sm text-gray-400">
            — 没有更多了 —
          </div>
        );
      }
      return null;
    };
    return FooterComponent;
  }, [loadingMore, hasMore, articles.length]);

  const renderItem = useCallback((_: number, article: Article) => (
    <div className="pb-4">
      <ArticleCard article={article} onLike={refreshTrending} />
    </div>
  ), [refreshTrending]);

  const sortButtons: { key: SortMode; icon: string; label: string }[] = [
    { key: 'newest', icon: '🕐', label: '最新' },
    { key: 'hot', icon: '🔥', label: '热门' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex gap-8">
        {/* ========= Left Sidebar ========= */}
        <aside className="w-48 shrink-0 hidden lg:block">
          <div className="sticky top-24 space-y-4">
            {/* User Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              {token && user ? (
                <div className="text-center">
                  <Link to={`/profile/${user._id}`}>
                    <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-lg font-bold text-amber-600 mx-auto overflow-hidden mb-3">
                      {user.avatar ? (
                        <img src={getImageUrl(user.avatar)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        user.username?.[0]?.toUpperCase()
                      )}
                    </div>
                  </Link>
                  <Link to={`/profile/${user._id}`} className="text-sm font-bold text-gray-900 dark:text-white hover:text-amber-600 transition-colors">
                    {user.username}
                  </Link>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{user.bio || '这个人很懒，什么都没写'}</p>
                  <button
                    onClick={() => navigate('/write')}
                    className="w-full mt-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all active:scale-[0.97]"
                  >
                    ✍️ 写文章
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-3xl mb-2">🐾</div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">登录后解锁更多功能</p>
                  <Link
                    to="/login"
                    className="block w-full py-2 bg-amber-500 text-white text-sm font-bold rounded-lg hover:bg-amber-600 transition-colors text-center"
                  >
                    登录 / 注册
                  </Link>
                </div>
              )}
            </div>

            {/* Sort */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mb-2">排序</h3>
              {sortButtons.map((btn) => (
                <button
                  key={btn.key}
                  onClick={() => handleSortChange(btn.key)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg mb-0.5 transition-colors ${
                    sort === btn.key
                      ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {btn.icon} {btn.label}
                </button>
              ))}
            </div>

            {/* Tags */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mb-2">热门标签</h3>
              {tags.length > 0 ? (
                <div className="space-y-0.5">
                  {tags.slice(0, 10).map((topic) => (
                    <button
                      key={topic.tag}
                      onClick={() => handleTagClick(topic.tag)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        activeTag === topic.tag
                          ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-medium'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span># {topic.tag}</span>
                      <span className="text-xs text-gray-400">{topic.count}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 px-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-5 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ========= Center: Feed ========= */}
        <div className="flex-1 min-w-0">
          {/* Mobile sort + tag tabs */}
          <div className="lg:hidden mb-4">
            <div className="flex gap-2 mb-2">
              {sortButtons.map((btn) => (
                <button
                  key={btn.key}
                  onClick={() => handleSortChange(btn.key)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    sort === btn.key
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {btn.icon} {btn.label}
                </button>
              ))}
            </div>
            {tags.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {tags.slice(0, 8).map((t) => (
                  <button
                    key={t.tag}
                    onClick={() => handleTagClick(t.tag)}
                    className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                      activeTag === t.tag
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    #{t.tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active tag filter indicator */}
          {activeTag && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <span className="text-sm text-amber-700 dark:text-amber-300">
                正在筛选：<strong>#{activeTag}</strong>
              </span>
              <button
                onClick={() => { setActiveTag(null); setArticles([]); }}
                className="ml-auto text-amber-500 hover:text-amber-700 text-sm font-bold"
              >
                ✕ 清除
              </button>
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <ArticleCardSkeleton key={i} />
              ))}
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-4xl mb-4">🐕</p>
              <p className="text-gray-500 dark:text-gray-400 mb-2">暂无文章</p>
              <Link to="/write" className="text-amber-600 hover:underline text-sm">
                成为第一个发布者
              </Link>
            </div>
          ) : (
            <Virtuoso
              useWindowScroll
              data={articles}
              endReached={loadNextPage}
              overscan={2}
              itemContent={renderItem}
              components={{ Footer }}
            />
          )}
        </div>

        {/* ========= Right Sidebar ========= */}
        <aside className="w-56 shrink-0 hidden xl:block">
          <div className="sticky top-24 space-y-4">
            {/* Trending Articles */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">🔥 热门文章</h3>
              {trending.length > 0 ? (
                <div className="space-y-3">
                  {trending.map((item, idx) => (
                    <Link
                      key={item._id}
                      to={`/article/${item._id}`}
                      className="block group rounded-lg p-2 -mx-1 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex gap-2.5">
                        <span className={`text-base font-extrabold shrink-0 w-5 text-center mt-0.5 ${
                          idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-gray-400' : 'text-amber-700/40'
                        }`}>
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-amber-600 transition-colors line-clamp-2 leading-snug">
                            {item.title}
                          </p>
                          {item.summary && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                              {item.summary}
                            </p>
                          )}
                          {item.images && item.images.length > 0 && (
                            <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                              {item.images.slice(0, 3).map((img, i) => (
                                <img
                                  key={i}
                                  src={img.startsWith('http') ? img : getImageUrl(img)}
                                  alt=""
                                  className="w-full h-12 rounded-md object-cover"
                                />
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-400">
                            <span className="flex items-center gap-1">
                              {item.author.avatar ? (
                                <img src={getImageUrl(item.author.avatar)} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
                              ) : null}
                              {item.author.username}
                            </span>
                            <span>❤️ {item.likesCount}</span>
                            <span>💬 {item.commentCount}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-5 h-5 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded animate-pulse w-3/4" />
                        <div className="h-3 w-1/2 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                      </div>
                      <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Links */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">🐾 快捷入口</h3>
              <div className="space-y-2">
                <Link to="/knowledge" className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                  📚 狗狗知识库
                </Link>
                <Link to="/ai" className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                  🤖 AI 智能问答
                </Link>
                <Link to="/write" className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                  ✍️ 发布内容
                </Link>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Discover;

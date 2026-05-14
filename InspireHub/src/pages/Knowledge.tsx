import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { knowledgeApi, type KnowledgeArticle } from '@/services/knowledgeApi';
import { getImageUrl } from '@/utils/image';
import LazyImage from '@/components/LazyImage';
interface KArticle {
  id: number;
  _id?: string;
  title: string;
  summary: string;
  tag?: string;
  author?: string;
  date?: string;
  content?: string;
  cover?: string;
}

const tagColors: Record<string, string> = {
  品种: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  健康: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  训练: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  饮食: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  养护: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const CATEGORY_TABS = [
  { id: 'breeds', icon: '🐕', label: '品种百科' },
  { id: 'health', icon: '🏥', label: '健康护理' },
  { id: 'training', icon: '🎓', label: '训练教程' },
  { id: 'nutrition', icon: '🥩', label: '饮食营养' },
  { id: 'daily', icon: '🏠', label: '日常养护' },
];

const TAG_BY_CATEGORY: Record<string, string> = {
  breeds: '品种', health: '健康', training: '训练', nutrition: '饮食', daily: '养护',
};

/* Convert API article to card-friendly shape */
const toCardArticle = (a: KnowledgeArticle): KArticle => ({
  id: 0,
  _id: a._id,
  title: a.title,
  summary: a.summary,
  tag: TAG_BY_CATEGORY[a.category] || a.category,
  author: a.author?.username || 'DogWorld',
  date: a.createdAt?.slice(0, 10),
  cover: a.cover ? getImageUrl(a.cover) : '',
});

/* ── Placeholder for articles without cover ── */
const CoverPlaceholder = ({ className = '', label }: { className?: string; label?: string }) => (
  <div className={`bg-gradient-to-br from-amber-100 via-orange-50 to-amber-200 dark:from-amber-900/40 dark:via-gray-800 dark:to-orange-900/30 flex items-center justify-center ${className}`}>
    <div className="text-center">
      <span className="text-4xl">🐕</span>
      {label && <p className="text-xs text-amber-600/60 dark:text-amber-400/50 mt-1 px-2 line-clamp-1">{label}</p>}
    </div>
  </div>
);

/* ── Article Card Component ── */
const ArticleCard = ({ article, size = 'normal' }: { article: KArticle; size?: 'hero' | 'normal' | 'small' }) => {
  const cover = article.cover || '';
  const tagClass = tagColors[article.tag || ''] || 'bg-gray-100 text-gray-600';
  const linkTo = `/knowledge/${article._id}`;

  if (size === 'hero') {
    return (
      <Link to={linkTo} className="group relative rounded-2xl overflow-hidden cursor-pointer block">
        {cover ? (
          <LazyImage src={cover} alt={article.title} className="w-full h-[340px] object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <CoverPlaceholder className="w-full h-[340px]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          {article.tag && <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full mb-3 ${tagClass}`}>{article.tag}</span>}
          <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-amber-300 transition-colors">{article.title}</h2>
          <p className="text-sm text-gray-200 line-clamp-2 mb-3">{article.summary}</p>
          <div className="flex items-center gap-3 text-xs text-gray-300">
            {article.author && <span>{article.author}</span>}
            {article.date && <span>· {article.date}</span>}
          </div>
        </div>
      </Link>
    );
  }

  if (size === 'small') {
    return (
      <Link to={linkTo} className="group flex gap-3 cursor-pointer">
        {cover ? (
          <LazyImage src={cover} alt={article.title} className="w-20 h-14 rounded-lg object-cover shrink-0 group-hover:opacity-80 transition-opacity" />
        ) : (
          <CoverPlaceholder className="w-20 h-14 rounded-lg shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors leading-snug">
            {article.title}
          </h4>
          <span className="text-xs text-gray-400 mt-1 block">{article.date}</span>
        </div>
      </Link>
    );
  }

  return (
    <Link to={linkTo} className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all cursor-pointer block">
      <div className="relative overflow-hidden">
        {cover ? (
          <LazyImage src={cover} alt={article.title} className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <CoverPlaceholder className="w-full h-44" label={article.tag} />
        )}
        {article.tag && (
          <span className={`absolute top-3 left-3 px-2.5 py-1 text-xs font-semibold rounded-full ${tagClass}`}>{article.tag}</span>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors line-clamp-2">
          {article.title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2 mb-3">{article.summary}</p>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{article.author}</span>
          <span>{article.date}</span>
        </div>
      </div>
    </Link>
  );
};

const Knowledge = () => {
  const [searchParams] = useSearchParams();
  const [activeCat, setActiveCat] = useState(searchParams.get('cat') || 'all');
  const { user } = useAppSelector((state) => state.auth);
  const isAdmin = user?.role === 'admin';

  /* API articles */
  const [apiArticles, setApiArticles] = useState<KArticle[]>([]);
  const [pagination, setPagination] = useState<{ page: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [catCounts, setCatCounts] = useState<Record<string, number>>({});

  const fetchArticles = useCallback(async (category?: string, page = 1, append = false) => {
    if (!append) setLoading(true);
    try {
      const res = await knowledgeApi.getList({ category: category === 'all' ? undefined : category, page, limit: 6 });
      const mapped = res.data.articles.map(toCardArticle);
      if (append) {
        setApiArticles((prev) => [...prev, ...mapped]);
      } else {
        setApiArticles(mapped);
      }
      setPagination({ page: res.data.page, totalPages: res.data.totalPages });
    } catch { /* ignore */ } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  /* Fetch counts per category once */
  useEffect(() => {
    knowledgeApi.getCategoryCounts()
      .then((res) => setCatCounts(res.data.counts))
      .catch(() => { /* ignore */ });
  }, []);

  useEffect(() => {
    setApiArticles([]);
    setPagination(null);
    fetchArticles(activeCat === 'all' ? undefined : activeCat);
  }, [activeCat, fetchArticles]);

  const hasMore = pagination ? pagination.page < pagination.totalPages : false;

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
    fetchArticles(activeCat === 'all' ? undefined : activeCat, pag.page + 1, true);
  }, [activeCat, fetchArticles]);

  /* Display data */
  const displayArticles = apiArticles;
  const latestDisplay = apiArticles.slice(0, 5);

  const heroArticle = displayArticles[0];
  const gridArticles = displayArticles.slice(1);

  // Window scroll listener for infinite loading
  useEffect(() => {
    const handleScroll = () => {
      const pag = paginationRef.current;
      if (!pag || !hasMoreRef.current || loadingMoreRef.current) return;
      const scrollBottom = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      if (scrollBottom < 300) {
        loadNextPage();
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadNextPage]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* ── Top Nav: DogTime-style category tabs ── */}
      <nav className="flex items-center gap-1 mb-6 overflow-x-auto pb-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveCat('all')}
          className={`shrink-0 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-[1px] ${
            activeCat === 'all'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          🔥 全部
        </button>
        {CATEGORY_TABS.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCat(cat.id)}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-[1px] ${
              activeCat === cat.id
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            {cat.icon} {cat.label}
          </button>
        ))}

        {/* Admin: add article button */}
        {isAdmin && (
          <Link
            to="/write"
            className="shrink-0 ml-auto px-3 py-1.5 text-xs font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
          >
            + 添加知识文章
          </Link>
        )}
      </nav>

      <div className="flex gap-6">
        {/* ── Main Content ── */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <>
              {/* Hero skeleton */}
              <div className="mb-6 rounded-2xl overflow-hidden animate-pulse">
                <div className="w-full h-[340px] bg-gray-200 dark:bg-gray-700" />
              </div>
              {/* Grid skeleton */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse">
                    <div className="w-full h-44 bg-gray-200 dark:bg-gray-700" />
                    <div className="p-4 space-y-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                      <div className="flex justify-between">
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Hero featured article */}
              {heroArticle && <div className="mb-6"><ArticleCard article={heroArticle} size="hero" /></div>}

              {/* Article grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {gridArticles.map((article) => (
                  <ArticleCard key={article._id || article.id} article={article} size="normal" />
                ))}
              </div>
            </>
          )}

          {displayArticles.length === 0 && !loading && (
            <div className="text-center py-20 text-gray-400">
              <div className="text-4xl mb-3">📭</div>
              <p>该分类暂无文章</p>
              {isAdmin && <Link to="/write" className="text-amber-600 hover:underline text-sm mt-2 inline-block">去发布第一篇 →</Link>}
            </div>
          )}

          {loadingMore && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse">
                  <div className="w-full h-44 bg-gray-200 dark:bg-gray-700" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!hasMore && apiArticles.length > 0 && (
            <div className="text-center py-10 text-sm text-gray-400">
              — 更多知识内容持续更新中 —
            </div>
          )}
        </div>

        {/* ── Right Sidebar ── */}
        <aside className="w-72 shrink-0 hidden lg:block">
          <div className="sticky top-20 space-y-6">
            {/* Latest articles */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                📰 最新文章
              </h3>
              <div className="space-y-4">
                {latestDisplay.map((article) => (
                  <ArticleCard key={article._id || article.id} article={article} size="small" />
                ))}
              </div>
            </div>

            {/* Quick category links */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                📂 知识分类
              </h3>
              <div className="space-y-1.5">
                {CATEGORY_TABS.map((cat) => {
                  const count = catCounts[cat.id] ?? 0;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCat(cat.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
                        activeCat === cat.id
                          ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-medium'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </span>
                      <span className="text-xs text-gray-400">{count}篇</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* About section */}
            <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl p-5 text-white">
              <h3 className="font-bold mb-2">🐶 DogWorld 知识库</h3>
              <p className="text-sm text-amber-100 leading-relaxed">
                汇集养狗必备知识，从品种介绍到健康护理，让你成为最懂狗狗的铲屎官。
              </p>
              <div className="mt-3 text-xs text-amber-200">
                📧 投稿: knowledge@dogworld.com
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Knowledge;

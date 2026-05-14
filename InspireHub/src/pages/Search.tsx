import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { articleApi } from '@/features/article/services/articleApi';
import { knowledgeApi } from '@/services/knowledgeApi';
import { userApi } from '@/features/user/services/userApi';
import useDebounce from '@/hooks/useDebounce';
import ArticleCard from '@/components/ArticleCard';
import ArticleCardSkeleton from '@/components/ArticleCardSkeleton';
import { getImageUrl } from '@/utils/image';
import LazyImage from '@/components/LazyImage';
import type { Article } from '@shared/types/article';
import type { KnowledgeArticle } from '@/services/knowledgeApi';
import Highlight from '@/components/Highlight';

/* ─── Types ─── */
type TabKey = 'articles' | 'knowledge' | 'users';

interface UserResult {
  _id: string;
  username: string;
  avatar: string;
  bio: string;
  followersCount: number;
  followingCount: number;
}

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'articles', label: '发现文章', icon: '📝' },
  { key: 'knowledge', label: '知识文章', icon: '📚' },
  { key: 'users', label: '用户', icon: '👥' },
];

/* ─── Skeletons ─── */
const CardSkeleton = () => (
  <div className="space-y-4">
    {Array.from({ length: 3 }).map((_, i) => (
      <ArticleCardSkeleton key={i} />
    ))}
  </div>
);

const SmallSkeleton = () => (
  <div className="space-y-3">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 animate-pulse">
        <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-3 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    ))}
  </div>
);

/* ─── Component ─── */
const Search = () => {
  const [searchParams] = useSearchParams();
  const rawQ = searchParams.get('q') || '';
  const q = useDebounce(rawQ.trim(), 400);

  const [activeTab, setActiveTab] = useState<TabKey>('articles');

  // Article state
  const [articles, setArticles] = useState<Article[]>([]);
  const [articleTotal, setArticleTotal] = useState(0);
  const [articleLoading, setArticleLoading] = useState(false);

  // Knowledge state
  const [knowledgeArticles, setKnowledgeArticles] = useState<KnowledgeArticle[]>([]);
  const [knowledgeTotal, setKnowledgeTotal] = useState(0);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);

  // User state
  const [users, setUsers] = useState<UserResult[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userLoading, setUserLoading] = useState(false);

  // Fetch all three in parallel on query change
  useEffect(() => {
    if (!q.trim()) {
      setArticles([]); setArticleTotal(0);
      setKnowledgeArticles([]); setKnowledgeTotal(0);
      setUsers([]); setUserTotal(0);
      return;
    }

    let cancelled = false;

    const fetchAll = async () => {
      setArticleLoading(true);
      setKnowledgeLoading(true);
      setUserLoading(true);

      try {
        const [artRes, knowRes, userRes] = await Promise.all([
          articleApi.getList({ page: 1, limit: 10, search: q }).catch(() => null),
          knowledgeApi.getList({ page: 1, limit: 10, search: q }).catch(() => null),
          userApi.searchUsers({ q, page: 1, limit: 10 }).catch(() => null),
        ]);
        if (cancelled) return;

        if (artRes) {
          setArticles(artRes.data.articles);
          setArticleTotal(artRes.data.pagination.total);
        }
        if (knowRes) {
          setKnowledgeArticles(knowRes.data.articles);
          setKnowledgeTotal(knowRes.data.total);
        }
        if (userRes) {
          setUsers(userRes.data.users);
          setUserTotal(userRes.data.total);
        }
      } finally {
        if (!cancelled) {
          setArticleLoading(false);
          setKnowledgeLoading(false);
          setUserLoading(false);
        }
      }
    };
    fetchAll();
    return () => { cancelled = true; };
  }, [q]);

  const totalCount = articleTotal + knowledgeTotal + userTotal;
  const isLoading = articleLoading || knowledgeLoading || userLoading;

  const renderTabCount = useCallback((key: TabKey) => {
    const count = key === 'articles' ? articleTotal : key === 'knowledge' ? knowledgeTotal : userTotal;
    return count;
  }, [articleTotal, knowledgeTotal, userTotal]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {rawQ ? `搜索："${rawQ}"` : '搜索'}
        </h1>
        {q && !isLoading && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            共找到 {totalCount} 条结果
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === tab.key
                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            }`}>
              {renderTabCount(tab.key)}
            </span>
          </button>
        ))}
      </div>

      {!q ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-gray-400 dark:text-gray-500">输入关键词开始搜索</p>
        </div>
      ) : (
        <>
          {/* ═══ Articles Tab ═══ */}
          {activeTab === 'articles' && (
            <div>
              {articleLoading ? <CardSkeleton /> : articles.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">📝</div>
                  <p className="text-gray-400">没有找到相关文章</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {articles.map((article) => (
                    <ArticleCard key={article._id} article={article} highlightQuery={q} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ Knowledge Tab ═══ */}
          {activeTab === 'knowledge' && (
            <div>
              {knowledgeLoading ? <CardSkeleton /> : knowledgeArticles.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">📚</div>
                  <p className="text-gray-400">没有找到相关知识文章</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {knowledgeArticles.map((article) => (
                    <Link
                      key={article._id}
                      to={`/knowledge/${article._id}`}
                      className="block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700 transition-all duration-200 group"
                    >
                      <div className="flex gap-4">
                        {article.cover && (
                          <LazyImage
                            src={getImageUrl(article.cover)}
                            alt=""
                            className="w-20 h-20 rounded-lg object-cover shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-amber-600 transition-colors line-clamp-1">
                            <Highlight text={article.title} query={q} />
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            <Highlight text={article.summary || article.content?.slice(0, 100) || ''} query={q} />
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-[11px] text-gray-400">{article.author?.username}</span>
                            <span className="text-[11px] text-gray-400">👁 {article.viewCount}</span>
                            {article.category && (
                              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                                {article.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ Users Tab ═══ */}
          {activeTab === 'users' && (
            <div>
              {userLoading ? <SmallSkeleton /> : users.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">👥</div>
                  <p className="text-gray-400">没有找到相关用户</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map((u) => (
                    <Link
                      key={u._id}
                      to={`/profile/${u._id}`}
                      className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700 transition-all duration-200 group"
                    >
                      <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-lg font-bold text-amber-600 overflow-hidden shrink-0">
                        {u.avatar ? (
                          <img src={getImageUrl(u.avatar)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          u.username?.[0]?.toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-amber-600 transition-colors">
                          <Highlight text={u.username} query={q} />
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                          <Highlight text={u.bio || '这个人很懒，什么都没写'} query={q} />
                        </p>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-400 shrink-0">
                        <span>{u.followersCount} 粉丝</span>
                        <span>{u.followingCount} 关注</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Search;

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { knowledgeApi, type KnowledgeArticle } from '@/services/knowledgeApi';
import { getImageUrl } from '@/utils/image';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import LazyImage from '@/components/LazyImage';

const tagColors: Record<string, string> = {
  品种: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  健康: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  训练: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  饮食: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  养护: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const TAG_BY_CATEGORY: Record<string, string> = {
  breeds: '品种', health: '健康', training: '训练', nutrition: '饮食', daily: '养护',
};

const CATEGORY_META: Record<string, { icon: string; label: string; id: string }> = {
  breeds: { icon: '🐕', label: '品种百科', id: 'breeds' },
  health: { icon: '🏥', label: '健康护理', id: 'health' },
  training: { icon: '🎓', label: '训练教程', id: 'training' },
  nutrition: { icon: '🥩', label: '饮食营养', id: 'nutrition' },
  daily: { icon: '🏠', label: '日常养护', id: 'daily' },
};

const KnowledgeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const isAdmin = user?.role === 'admin';

  const [apiArticle, setApiArticle] = useState<KnowledgeArticle | null>(null);
  const [apiRelated, setApiRelated] = useState<KnowledgeArticle[]>([]);
  const [apiLoaded, setApiLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArticle = async () => {
      setLoading(true);
      try {
        const res = await knowledgeApi.getById(id!);
        setApiArticle(res.data.article);
        setApiLoaded(true);
        // Fetch related articles from same category (non-critical)
        try {
          const relRes = await knowledgeApi.getList({ category: res.data.article.category, limit: 5 });
          setApiRelated(relRes.data.articles.filter((a) => a._id !== id));
        } catch {
          // Related articles are non-critical, ignore errors
        }
      } catch {
        setApiLoaded(false);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchArticle();
  }, [id]);

  if (!apiLoaded && !loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-4">📄</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">文章不存在</h1>
        <p className="text-gray-500 mb-6">找不到对应的知识文章</p>
        <Link to="/knowledge" className="text-amber-600 hover:underline">← 返回知识库</Link>
      </div>
    );
  }

  if (loading || !apiArticle) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-2/3 bg-gray-200 dark:bg-gray-700 rounded mx-auto" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
          <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  /* Build view model */
  const article = {
    title: apiArticle.title,
    content: apiArticle.content,
    summary: apiArticle.summary,
    tag: TAG_BY_CATEGORY[apiArticle.category] || apiArticle.category,
    author: apiArticle.author?.username || 'DogWorld',
    date: apiArticle.createdAt?.slice(0, 10),
    _id: apiArticle._id,
  };

  const cover = apiArticle.cover ? getImageUrl(apiArticle.cover) : '';
  const categoryMeta = CATEGORY_META[apiArticle.category] || { icon: '📚', label: '知识', id: '' };
  const tagClass = tagColors[article.tag || ''] || 'bg-gray-100 text-gray-600';

  const related = apiRelated.map((a) => ({
    _id: a._id,
    title: a.title,
    date: a.createdAt?.slice(0, 10),
    tag: TAG_BY_CATEGORY[a.category],
    cover: a.cover ? getImageUrl(a.cover) : '',
  }));

  const handleDelete = async () => {
    if (!apiArticle || !confirm('确定要删除这篇知识文章吗？')) return;
    try {
      await knowledgeApi.delete(apiArticle._id);
      navigate('/knowledge');
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
        <Link to="/knowledge" className="hover:text-amber-600 transition-colors">知识库</Link>
        <span>›</span>
        <Link to={`/knowledge?cat=${categoryMeta.id}`} className="hover:text-amber-600 transition-colors">
          {categoryMeta.icon} {categoryMeta.label}
        </Link>
        <span>›</span>
        <span className="text-gray-900 dark:text-white font-medium truncate">{article.title}</span>
      </nav>

      <div className="flex gap-8">
        {/* ── Main Content ── */}
        <article className="flex-1 min-w-0">
          {/* Tag */}
          {article.tag && (
            <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full mb-4 ${tagClass}`}>
              {article.tag}
            </span>
          )}

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
            {article.title}
          </h1>

          {/* Author & date */}
          <div className="flex items-center gap-4 mb-6 text-sm text-gray-500 dark:text-gray-400">
            {article.author && (
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center text-xs font-bold text-amber-600">
                  {article.author[0]}
                </span>
                {article.author}
              </span>
            )}
            {article.date && <span>· {article.date}</span>}
            {isAdmin && apiArticle && (
              <>
                <Link to={`/knowledge/${apiArticle._id}/edit`} className="ml-4 text-amber-600 hover:text-amber-700 text-xs border border-amber-300 px-2 py-0.5 rounded">编辑</Link>
                <button onClick={handleDelete} className="text-red-500 hover:text-red-700 text-xs border border-red-300 px-2 py-0.5 rounded">删除</button>
              </>
            )}
          </div>

          {/* Hero image */}
          {cover && (
            <div className="rounded-2xl overflow-hidden mb-8">
              <LazyImage src={cover} alt={article.title} className="w-full h-[360px] object-cover" />
            </div>
          )}

          {/* Summary highlight */}
          <div className="bg-amber-50 dark:bg-amber-900/10 border-l-4 border-amber-500 px-5 py-4 rounded-r-xl mb-8">
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{article.summary}</p>
          </div>

          {/* Article body */}
          {article.content && (
            <div className="prose prose-lg dark:prose-invert max-w-none
              prose-headings:text-gray-900 dark:prose-headings:text-white
              prose-h2:text-xl prose-h2:font-bold prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-gray-200 dark:prose-h2:border-gray-700
              prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-3
              prose-p:text-gray-600 dark:prose-p:text-gray-300 prose-p:leading-relaxed
              prose-li:text-gray-600 dark:prose-li:text-gray-300
              prose-strong:text-gray-900 dark:prose-strong:text-white
              prose-blockquote:border-amber-400 prose-blockquote:bg-gray-50 dark:prose-blockquote:bg-gray-800 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:px-2
              prose-table:text-sm
              prose-th:bg-gray-100 dark:prose-th:bg-gray-800 prose-th:px-4 prose-th:py-2
              prose-td:px-4 prose-td:py-2 prose-td:border-gray-200 dark:prose-td:border-gray-700
            ">
              <MarkdownRenderer content={article.content} />
            </div>
          )}

          {/* Tags & Share */}
          <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">标签：</span>
                {article.tag && <span className={`px-3 py-1 text-xs font-medium rounded-full ${tagClass}`}>{article.tag}</span>}
                <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">知识库</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <span>分享：</span>
                <button className="hover:text-amber-600 transition-colors" title="分享到微信">💬</button>
                <button className="hover:text-amber-600 transition-colors" title="分享到微博">📢</button>
                <button className="hover:text-amber-600 transition-colors" title="复制链接">🔗</button>
              </div>
            </div>
          </div>

        </article>

        {/* ── Right Sidebar ── */}
        <aside className="w-72 shrink-0 hidden lg:block">
          <div className="sticky top-20 space-y-6">
            {/* Related in same category */}
            {related.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  {categoryMeta.icon} {categoryMeta.label}相关
                </h3>
                <div className="space-y-3">
                  {related.map((a) => (
                    <Link key={a._id} to={`/knowledge/${a._id}`} className="group flex gap-3">
                      {a.cover ? (
                        <LazyImage src={a.cover} alt={a.title} className="w-20 h-14 rounded-lg object-cover shrink-0 group-hover:opacity-80 transition-opacity" />
                      ) : (
                        <div className="w-20 h-14 rounded-lg shrink-0 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/30 flex items-center justify-center text-lg">🐕</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors leading-snug">
                          {a.title}
                        </h4>
                        <span className="text-xs text-gray-400 mt-1 block">{a.date}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Category quick nav */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                📂 知识分类
              </h3>
              <div className="space-y-1.5">
                {Object.entries(CATEGORY_META).map(([catId, cat]) => (
                  <Link
                    key={catId}
                    to={`/knowledge?cat=${catId}`}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                      catId === categoryMeta.id
                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default KnowledgeDetail;

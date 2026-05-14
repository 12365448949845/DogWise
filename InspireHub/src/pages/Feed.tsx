import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';
import { articleApi } from '@/features/article/services/articleApi';
import ArticleCard from '@/components/ArticleCard';
import ArticleCardSkeleton from '@/components/ArticleCardSkeleton';
import type { Article, Pagination } from '@shared/types/article';

const Feed = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await articleApi.getFeed({ page: 1, limit: 10 });
        setArticles(res.data.articles);
        setPagination(res.data.pagination);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const hasMore = pagination ? pagination.page < pagination.pages : false;

  const handleEndReached = useCallback(async () => {
    if (!pagination || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await articleApi.getFeed({ page: pagination.page + 1, limit: 10 });
      setArticles((prev) => [...prev, ...res.data.articles]);
      setPagination(res.data.pagination);
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  }, [pagination, hasMore, loadingMore]);

  const Footer = useMemo(() => {
    const FooterComponent = () => {
      if (loadingMore) {
        return (
          <div className="space-y-6 pt-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <ArticleCardSkeleton key={i} />
            ))}
          </div>
        );
      }
      if (!hasMore && articles.length > 0) {
        return (
          <div className="text-center py-8 text-sm text-gray-400">
            — All caught up —
          </div>
        );
      }
      return null;
    };
    return FooterComponent;
  }, [loadingMore, hasMore, articles.length]);

  const renderItem = useCallback((_: number, article: Article) => (
    <div className="pb-6">
      <ArticleCard article={article} />
    </div>
  ), []);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-6" />
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <ArticleCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Following Feed
        </h1>
        <div className="text-center py-16">
          <p className="text-gray-400 mb-4">No articles from people you follow yet.</p>
          <Link to="/" className="text-indigo-600 hover:underline text-sm">
            Discover articles on the home page
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Following Feed
      </h1>

      <Virtuoso
        useWindowScroll
        data={articles}
        endReached={handleEndReached}
        overscan={2}
        itemContent={renderItem}
        components={{ Footer }}
      />
    </div>
  );
};

export default Feed;

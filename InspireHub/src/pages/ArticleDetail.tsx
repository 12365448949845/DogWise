import { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchArticleById, clearCurrentArticle } from '@/features/article/slices/articleSlice';
import { articleApi } from '@/features/article/services/articleApi';
import CommentSection from '@/components/CommentSection';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import ImageGallery from '@/components/ImageGallery';
import { getImageUrl } from '@/utils/image';
import UserHoverCard from '@/components/UserHoverCard';

/* Extract markdown image urls from content */
const extractImages = (text: string) => {
  const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  const images: string[] = [];
  let match;
  while ((match = imgRegex.exec(text)) !== null) {
    images.push(match[1]);
  }
  const textOnly = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '').trim();
  return { images, textOnly };
};

const ArticleDetail = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const { currentArticle: article, loading, error } = useAppSelector((state) => state.article);
  const { token, user } = useAppSelector((state) => state.auth);
  const navigate = useNavigate();

  const isAuthor = user && article?.author?._id === user._id;

  useEffect(() => {
    if (id) {
      dispatch(fetchArticleById(id));
    }
    return () => {
      dispatch(clearCurrentArticle());
    };
  }, [dispatch, id]);

  const handleLike = async () => {
    if (!id || !token) return;
    await articleApi.toggleLike(id);
    dispatch(fetchArticleById(id));
  };

  const handleFavorite = async () => {
    if (!id || !token) return;
    await articleApi.toggleFavorite(id);
    dispatch(fetchArticleById(id));
  };

  const handleDelete = async () => {
    if (!id || !confirm('确定要删除这篇文章吗？')) return;
    try {
      await articleApi.delete(id);
      navigate(user ? `/profile/${user._id}` : '/');
    } catch {
      // silent
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">Loading article...</div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-500">{error || 'Article not found'}</p>
        <Link to="/" className="text-indigo-600 hover:underline">Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        {article.title}
      </h1>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <UserHoverCard userId={article.author._id}>
            <Link to={`/profile/${article.author._id}`} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-sm font-bold text-indigo-600">
                {article.author.username?.[0]?.toUpperCase()}
              </div>
              <span className="font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 transition-colors">
                {article.author.username}
              </span>
            </Link>
          </UserHoverCard>
          <span>·</span>
          <span>{new Date(article.createdAt).toLocaleDateString()}</span>
          <span>·</span>
          <span>👁 {article.viewCount}</span>
        </div>
        {isAuthor && (
          <div className="flex items-center gap-2">
            <Link
              to={`/article/${article._id}/edit`}
              className="text-xs px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              ✏️ Edit
            </Link>
            <button
              onClick={handleDelete}
              className="text-xs px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              🗑️ Delete
            </button>
          </div>
        )}
      </div>

      {/* Tags */}
      {article.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {article.tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Content (text only, images extracted) */}
      {(() => {
        const { images: inlineImages, textOnly } = extractImages(article.content || '');
        const allImages = article.cover
          ? [article.cover, ...inlineImages]
          : inlineImages;
        const contentImages = [...new Set(allImages)].map((s) => s.startsWith('http') ? s : getImageUrl(s));
        return (
          <>
            {textOnly && (
              <div className="mb-6">
                <MarkdownRenderer content={textOnly} />
              </div>
            )}
            {contentImages.length > 0 && (
              <div className="mb-8">
                <ImageGallery images={contentImages} alt={article.title} />
              </div>
            )}
          </>
        );
      })()}

      {/* Actions */}
      <div className="flex items-center gap-4 py-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleLike}
          disabled={!token}
          className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          ❤️ <span className="text-sm">{article.likes.length}</span>
        </button>
        <button
          onClick={handleFavorite}
          disabled={!token}
          className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          ⭐ <span className="text-sm">{article.favorites.length}</span>
        </button>
      </div>

      {/* Comments */}
      <CommentSection articleId={article._id} />
    </div>
  );
};

export default ArticleDetail;

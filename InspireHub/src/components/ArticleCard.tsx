import { useState, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import type { Article } from '@shared/types/article';
import { getImageUrl } from '@/utils/image';
import { articleApi } from '@/features/article/services/articleApi';
import { useAppSelector } from '@/store/hooks';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import ImageGallery from '@/components/ImageGallery';
import UserHoverCard from '@/components/UserHoverCard';
import Highlight from '@/components/Highlight';

interface ArticleCardProps {
  article: Article;
  highlightQuery?: string;
}

const formatTime = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

const MAX_CONTENT_LENGTH = 300;
const MAX_VISIBLE_IMAGES = 4;

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


const ArticleCard = memo(({ article, highlightQuery }: ArticleCardProps) => {
  const { token, user } = useAppSelector((state) => state.auth);
  const likes = article.likes ?? [];
  const favorites = article.favorites ?? [];
  const [likesCount, setLikesCount] = useState(likes.length);
  const [liked, setLiked] = useState(user ? likes.includes(user._id) : false);
  const [favCount, setFavCount] = useState(favorites.length);
  const [faved, setFaved] = useState(user ? favorites.includes(user._id) : false);
  const [textExpanded, setTextExpanded] = useState(false);

  const rawContent = article.summary || article.content || '';
  const { textOnly } = extractImages(rawContent);
  const inlineImages: string[] = (article as any).images?.length
    ? (article as any).images
    : extractImages(article.content || rawContent).images;
  const allImages = article.cover
    ? [...inlineImages, article.cover]
    : inlineImages;
  const contentImages = [...new Set(allImages)];
  const isLong = textOnly.length > MAX_CONTENT_LENGTH;
  const displayText = textExpanded ? textOnly : textOnly.slice(0, MAX_CONTENT_LENGTH);
  const hasHiddenImages = contentImages.length > MAX_VISIBLE_IMAGES;
  const visibleImages = textExpanded ? contentImages : contentImages.slice(0, MAX_VISIBLE_IMAGES);

  const handleLike = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) return;
    try {
      const res = await articleApi.toggleLike(article._id);
      setLiked(res.data.liked);
      setLikesCount(res.data.likesCount);
    } catch { /* silent */ }
  }, [token, article._id]);

  const handleFavorite = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) return;
    try {
      const res = await articleApi.toggleFavorite(article._id);
      setFaved(res.data.favorited);
      setFavCount(res.data.favoritesCount);
    } catch { /* silent */ }
  }, [token, article._id]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex gap-4 p-5">
        {/* Left: Avatar */}
        <UserHoverCard userId={article.author._id}>
          <Link to={`/profile/${article.author._id}`} className="shrink-0">
            <div className="w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-sm font-bold text-indigo-600 overflow-hidden">
              {article.author.avatar ? (
                <img src={getImageUrl(article.author.avatar)} alt="" className="w-full h-full object-cover" />
              ) : (
                article.author.username?.[0]?.toUpperCase()
              )}
            </div>
          </Link>
        </UserHoverCard>

        {/* Right: Everything else */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-0.5 line-clamp-2">
            <Link to={`/article/${article._id}`} className="hover:text-indigo-600 transition-colors">
              <Highlight text={article.title} query={highlightQuery} />
            </Link>
          </h2>

          {/* Author + time */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mb-2">
            <Link
              to={`/profile/${article.author._id}`}
              className="font-medium text-gray-600 dark:text-gray-300 hover:underline"
            >
              {article.author.username}
            </Link>
            <span>·</span>
            <span>{formatTime(article.createdAt)}</span>
          </div>

          {/* Content preview (text only, images extracted) */}
          {textOnly && (
            <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {highlightQuery ? (
                <Highlight text={displayText + (isLong && !textExpanded ? '...' : '')} query={highlightQuery} />
              ) : (
                <MarkdownRenderer content={displayText + (isLong && !textExpanded ? '...' : '')} />
              )}
            </div>
          )}

          {/* Image gallery */}
          {contentImages.length > 0 && (
            <div className="mt-3">
              <ImageGallery
                images={visibleImages.map((s) => s.startsWith('http') ? s : getImageUrl(s))}
                alt={article.title}
              />
              {hasHiddenImages && !textExpanded && (
                <button
                  onClick={() => setTextExpanded(true)}
                  className="mt-2 text-sm text-indigo-500 hover:text-indigo-600 font-medium"
                >
                  +{contentImages.length - MAX_VISIBLE_IMAGES} 张图片
                </button>
              )}
            </div>
          )}

          {/* Expand/collapse for long text */}
          {isLong && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTextExpanded(!textExpanded); }}
              className="text-sm text-indigo-500 hover:text-indigo-600 mt-1 font-medium"
            >
              {textExpanded ? '收起' : '展开全文'}
            </button>
          )}

          {/* Tags */}
          {article.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {article.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500">
            <span>👁 {article.viewCount}</span>
            <button
              onClick={handleLike}
              disabled={!token}
              className={`hover:text-red-500 transition-colors disabled:opacity-50 ${liked ? 'text-red-500' : ''}`}
            >
              ❤️ {likesCount}
            </button>
            <button
              onClick={handleFavorite}
              disabled={!token}
              className={`hover:text-yellow-500 transition-colors disabled:opacity-50 ${faved ? 'text-yellow-500' : ''}`}
            >
              ⭐ {favCount}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

ArticleCard.displayName = 'ArticleCard';
export default ArticleCard;

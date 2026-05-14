import { useState, useCallback, memo } from 'react';
import { useAppSelector } from '@/store/hooks';
import { commentApi } from '@/features/comment/services/commentApi';
import { getImageUrl } from '@/utils/image';
import ImageGallery from '@/components/ImageGallery';
import type { Comment } from '@shared/types/comment';

interface CommentItemProps {
  comment: Comment;
  onReply: (parentId: string) => void;
  onRefresh: () => void;
}

const CommentItem = memo(({ comment, onReply, onRefresh }: CommentItemProps) => {
  const { user, token } = useAppSelector((state) => state.auth);
  const [likesCount, setLikesCount] = useState(comment.likes.length);
  const [liked, setLiked] = useState(user ? comment.likes.includes(user._id) : false);

  const handleLike = useCallback(async () => {
    if (!token) return;
    const res = await commentApi.toggleLike(comment._id);
    setLiked(res.data.liked);
    setLikesCount(res.data.likesCount);
  }, [token, comment._id]);

  const handleDelete = useCallback(async () => {
    if (!token) return;
    await commentApi.delete(comment._id);
    onRefresh();
  }, [token, comment._id, onRefresh]);

  const isOwner = user && user._id === comment.author._id;

  return (
    <div className="py-3">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
          {comment.author.username?.[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {comment.author.username}
            </span>
            <span className="text-xs text-gray-400">
              {new Date(comment.createdAt).toLocaleDateString()}
            </span>
          </div>
          {comment.content && (
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {comment.content}
            </p>
          )}
          {comment.images && comment.images.length > 0 && (
            <div className="mt-2">
              <ImageGallery
                images={comment.images.map((s) => s.startsWith('http') ? s : getImageUrl(s))}
                alt="comment"
              />
            </div>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            <button
              onClick={handleLike}
              disabled={!token}
              className={`hover:text-red-500 transition-colors disabled:opacity-50 ${liked ? 'text-red-500' : ''}`}
            >
              ❤️ {likesCount}
            </button>
            {!comment.parentComment && (
              <button
                onClick={() => onReply(comment._id)}
                disabled={!token}
                className="hover:text-indigo-500 transition-colors disabled:opacity-50"
              >
                Reply
              </button>
            )}
            {isOwner && (
              <button
                onClick={handleDelete}
                className="hover:text-red-500 transition-colors"
              >
                Delete
              </button>
            )}
          </div>

          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-3 pl-4 border-l-2 border-gray-100 dark:border-gray-700 space-y-2">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply._id}
                  comment={reply}
                  onReply={onReply}
                  onRefresh={onRefresh}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

CommentItem.displayName = 'CommentItem';
export default CommentItem;

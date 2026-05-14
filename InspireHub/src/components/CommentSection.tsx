import { useState, useEffect, useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { useAppSelector } from '@/store/hooks';
import { commentApi } from '@/features/comment/services/commentApi';
import EmojiPicker from '@/components/EmojiPicker';
import MultiImagePicker from '@/components/MultiImagePicker';
import CommentItem from '@/components/CommentItem';
import type { Comment } from '@shared/types/comment';

interface CommentSectionProps {
  articleId: string;
}

const CommentSection = ({ articleId }: CommentSectionProps) => {
  const { token } = useAppSelector((state) => state.auth);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [images, setImages] = useState<string[]>([]);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await commentApi.getByArticle(articleId);
      setComments(res.data.comments);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await commentApi.getByArticle(articleId);
        setComments(res.data.comments);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [articleId]);

  const handleSubmit = async () => {
    if ((!content.trim() && images.length === 0) || submitting) return;
    setSubmitting(true);
    try {
      await commentApi.create(articleId, {
        content: content.trim(),
        parentCommentId: replyTo || undefined,
        images: images.length > 0 ? images : undefined,
      });
      setContent('');
      setImages([]);
      setReplyTo(null);
      fetchComments();
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = useCallback((parentId: string) => {
    setReplyTo(parentId);
  }, []);

  const replyComment = replyTo
    ? comments.find((c) => c._id === replyTo)
    : null;

  return (
    <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Comments ({comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)})
      </h3>

      {/* Input */}
      {token ? (
        <div className="mb-6">
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 text-sm text-gray-500">
              <span>Replying to {replyComment?.author.username || 'comment'}</span>
              <button
                onClick={() => setReplyTo(null)}
                className="text-red-400 hover:text-red-500"
              >
                ✕
              </button>
            </div>
          )}
          <div className="flex gap-3">
            <div className="flex-1">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onFocus={() => setShowEmoji(false)}
                rows={2}
                maxLength={1000}
                placeholder={replyTo ? 'Write a reply...' : 'Write a comment...'}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition resize-none text-sm"
              />

              {/* Toolbar: emoji + image upload */}
              <div className="flex items-center gap-1 mt-2 relative flex-wrap">
                <MultiImagePicker images={images} onChange={setImages} max={9} />
                <button
                  type="button"
                  onClick={() => setShowEmoji((v) => !v)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors text-base"
                  title="表情"
                >
                  😊
                </button>

                {showEmoji && (
                  <EmojiPicker
                    onSelect={(emoji) => { setContent((p) => p + emoji); setShowEmoji(false); }}
                    className="absolute bottom-full left-0 mb-1"
                  />
                )}
              </div>
            </div>
            <button
              onClick={handleSubmit}
              disabled={(!content.trim() && images.length === 0) || submitting}
              className="self-end px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? '...' : 'Send'}
            </button>
          </div>
        </div>
      ) : (
        <p className="mb-6 text-sm text-gray-400">Please login to comment.</p>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-4 text-gray-400 text-sm">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">No comments yet.</div>
      ) : comments.length < 20 ? (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {comments.map((comment) => (
            <CommentItem
              key={comment._id}
              comment={comment}
              onReply={handleReply}
              onRefresh={fetchComments}
            />
          ))}
        </div>
      ) : (
        <Virtuoso
          useWindowScroll
          data={comments}
          overscan={2}
          itemContent={(_, comment) => (
            <div className="border-b border-gray-100 dark:border-gray-800">
              <CommentItem
                comment={comment}
                onReply={handleReply}
                onRefresh={fetchComments}
              />
            </div>
          )}
        />
      )}
    </div>
  );
};

export default CommentSection;

import api from '@/services/api';
import type { ApiResponse } from '@/services/api';
import type { Comment, CreateCommentPayload } from '@shared/types/comment';
import requestCache from '@/utils/requestCache';

export const commentApi = {
  getByArticle(articleId: string) {
    return requestCache.dedupe(`comments:${articleId}`, () =>
      api.get(`/comments/article/${articleId}`) as unknown as Promise<ApiResponse<{ comments: Comment[] }>>,
      15
    );
  },

  create(articleId: string, data: CreateCommentPayload) {
    requestCache.invalidate(`comments:${articleId}`);
    return api.post(`/comments/article/${articleId}`, data) as unknown as Promise<ApiResponse<{ comment: Comment }>>;
  },

  delete(id: string) {
    requestCache.invalidate('comments:');
    return api.delete(`/comments/${id}`) as unknown as Promise<ApiResponse<{ id: string }>>;
  },

  toggleLike(id: string) {
    return api.post(`/comments/${id}/like`) as unknown as Promise<ApiResponse<{ liked: boolean; likesCount: number }>>;
  },
};

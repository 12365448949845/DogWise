import api from '@/services/api';
import type { ApiResponse } from '@/services/api';
import type {
  Article,
  ArticleListResponse,
  ArticleQueryParams,
  CreateArticlePayload,
  UpdateArticlePayload,
  TrendingArticle,
} from '@shared/types/article';
import requestCache from '@/utils/requestCache';

export const articleApi = {
  getList(params?: ArticleQueryParams) {
    const key = `articles:list:${JSON.stringify(params || {})}`;
    return requestCache.dedupe(key, () =>
      api.get('/articles', { params }) as unknown as Promise<ApiResponse<ArticleListResponse>>,
      30
    );
  },

  getById(id: string) {
    const key = `articles:detail:${id}`;
    return requestCache.dedupe(key, () =>
      api.get(`/articles/${id}`) as unknown as Promise<ApiResponse<{ article: Article }>>,
      60
    );
  },

  create(data: CreateArticlePayload) {
    return (api.post('/articles', data) as unknown as Promise<ApiResponse<{ article: Article }>>)
      .then((res) => { requestCache.invalidate('articles:'); return res; });
  },

  update(id: string, data: UpdateArticlePayload) {
    return (api.put(`/articles/${id}`, data) as unknown as Promise<ApiResponse<{ article: Article }>>)
      .then((res) => { requestCache.invalidate('articles:'); return res; });
  },

  delete(id: string) {
    return (api.delete(`/articles/${id}`) as unknown as Promise<ApiResponse<{ id: string }>>)
      .then((res) => { requestCache.invalidate('articles:'); return res; });
  },

  toggleLike(id: string) {
    requestCache.invalidate(`articles:detail:${id}`);
    return api.post(`/articles/${id}/like`) as unknown as Promise<ApiResponse<{ liked: boolean; likesCount: number }>>;
  },

  toggleFavorite(id: string) {
    requestCache.invalidate(`articles:detail:${id}`);
    return api.post(`/articles/${id}/favorite`) as unknown as Promise<ApiResponse<{ favorited: boolean; favoritesCount: number }>>;
  },

  getPopularTags() {
    return requestCache.dedupe('tags:popular', () =>
      api.get('/articles/tags/popular') as unknown as Promise<ApiResponse<{ tags: { tag: string; count: number }[] }>>,
      120
    );
  },

  getFeed(params?: { page?: number; limit?: number }) {
    const key = `articles:feed:${JSON.stringify(params || {})}`;
    return requestCache.dedupe(key, () =>
      api.get('/articles/feed/following', { params }) as unknown as Promise<ApiResponse<ArticleListResponse>>,
      30
    );
  },

  getTrending(skipCache = false) {
    if (skipCache) requestCache.invalidate('articles:trending');
    return requestCache.dedupe('articles:trending', () =>
      api.get('/articles/trending') as unknown as Promise<ApiResponse<{ articles: TrendingArticle[] }>>,
      60
    );
  },
};

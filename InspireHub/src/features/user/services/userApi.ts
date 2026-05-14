import api from '@/services/api';
import type { ApiResponse } from '@/services/api';
import type { User, UpdateProfilePayload } from '@shared/types/user';
import type { Article, Pagination } from '@shared/types/article';

export const userApi = {
  getProfile(id: string) {
    return api.get(`/users/${id}`) as unknown as Promise<ApiResponse<{ user: User; articleCount: number; isFollowing: boolean }>>;
  },

  updateProfile(data: UpdateProfilePayload) {
    return api.put('/users/me', data) as unknown as Promise<ApiResponse<{ user: User }>>;
  },

  getUserArticles(id: string, params?: { page?: number; limit?: number }) {
    return api.get(`/users/${id}/articles`, { params }) as unknown as Promise<ApiResponse<{ articles: Article[]; pagination: Pagination }>>;
  },

  toggleFollow(id: string) {
    return api.post(`/users/${id}/follow`) as unknown as Promise<ApiResponse<{ following: boolean; followersCount: number }>>;
  },

  getMyStats() {
    return api.get('/users/me/stats') as unknown as Promise<ApiResponse<{
      username: string;
      avatar: string;
      totalViews: number;
      totalLikes: number;
      followingCount: number;
      followersCount: number;
    }>>;
  },

  searchUsers(params: { q: string; page?: number; limit?: number }) {
    return api.get('/users/search', { params }) as unknown as Promise<ApiResponse<{
      users: { _id: string; username: string; avatar: string; bio: string; followersCount: number; followingCount: number }[];
      total: number;
      page: number;
      totalPages: number;
    }>>;
  },
};
